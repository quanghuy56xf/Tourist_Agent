import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from sqlalchemy.orm import Session

from app.core.config import CONTENT_REGEN_MAX_WORKERS
from app.core.database import SessionLocal
from app.models.item import Item
from app.modules.content.audio_jobs import ensure_audio_parallel
from app.modules.content.content_analytics import (
    CONTENT_EVENT_TEXT_ERROR,
    record_content_issue,
)
from app.modules.content.personas import (
    DEFAULT_LANGUAGE,
    DEFAULT_PERSONA,
    all_variants,
)
from app.modules.content.relevance import items_affected_by_documents
from app.modules.content.service import get_item_content_service
from app.modules.content.text_utils import is_no_information_content

logger = logging.getLogger(__name__)


def _other_variants() -> list[tuple[str, str]]:
    return [
        (persona, language)
        for persona, language in all_variants()
        if not (persona == DEFAULT_PERSONA and language == DEFAULT_LANGUAGE)
    ]


def _regenerate_base_variant(item_id: int) -> tuple[int, str | None]:
    db = SessionLocal()
    item = None
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if item is None:
            return item_id, None
        service = get_item_content_service()
        service.delete_variants_for_item(db, item.id)
        result = service.generate_and_persist(
            db,
            item,
            DEFAULT_PERSONA,
            DEFAULT_LANGUAGE,
            source="generated",
        )
        return item_id, result.content
    except Exception as exc:
        logger.exception("Base content regenerate failed for item %s", item_id)
        record_content_issue(
            event_type=CONTENT_EVENT_TEXT_ERROR,
            item_id=item_id,
            group_id=item.group_id if item else None,
            persona=DEFAULT_PERSONA,
            language=DEFAULT_LANGUAGE,
            error_detail=str(exc)[:500],
            item_name=item.name if item else None,
        )
        return item_id, None
    finally:
        db.close()


def _regenerate_adapted_variant(
    item_id: int,
    persona: str,
    language: str,
    base_content: str,
) -> None:
    db = SessionLocal()
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if item is None:
            return
        get_item_content_service().generate_adapted_variant(
            db,
            item,
            persona,
            language,
            base_content,
        )
    except Exception as exc:
        logger.exception(
            "Adapted variant regenerate failed for item %s (%s, %s)",
            item_id,
            persona,
            language,
        )
        item = db.query(Item).filter(Item.id == item_id).first()
        record_content_issue(
            event_type=CONTENT_EVENT_TEXT_ERROR,
            item_id=item_id,
            group_id=item.group_id if item else None,
            persona=persona,
            language=language,
            error_detail=str(exc)[:500],
            item_name=item.name if item else None,
        )
    finally:
        db.close()


def regenerate_items_parallel(
    item_ids: list[int],
    max_workers: int | None = None,
) -> list[int]:
    """Regenerate all content variants for the given items concurrently.

    Phase 1: default persona/language text (RAG + LLM) in parallel.
    Phase 2: adapt remaining persona/language variants in parallel.
    Phase 3: synthesize TTS in parallel once text for each variant exists.
    """
    unique_ids = list(dict.fromkeys(int(item_id) for item_id in item_ids))
    if not unique_ids:
        return []

    workers = max_workers or CONTENT_REGEN_MAX_WORKERS

    base_contents: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=min(workers, len(unique_ids))) as executor:
        futures = {
            executor.submit(_regenerate_base_variant, item_id): item_id
            for item_id in unique_ids
        }
        for future in as_completed(futures):
            item_id, content = future.result()
            if content is not None:
                base_contents[item_id] = content

    adapt_tasks: list[tuple[int, str, str, str]] = []
    for item_id, content in base_contents.items():
        if not content.strip():
            continue
        for persona, language in _other_variants():
            adapt_tasks.append((item_id, persona, language, content))

    if adapt_tasks:
        with ThreadPoolExecutor(max_workers=min(workers, len(adapt_tasks))) as executor:
            futures = [
                executor.submit(_regenerate_adapted_variant, *task)
                for task in adapt_tasks
            ]
            for future in as_completed(futures):
                future.result()

    regenerated_ids = list(base_contents.keys())

    audio_targets: list[tuple[int, str, str]] = []
    for item_id in regenerated_ids:
        base_text = base_contents.get(item_id, "")
        if not base_text.strip() or is_no_information_content(base_text):
            continue
        audio_targets.append((item_id, DEFAULT_PERSONA, DEFAULT_LANGUAGE))
        for persona, language in _other_variants():
            audio_targets.append((item_id, persona, language))
    if audio_targets:
        ensure_audio_parallel(audio_targets)

    return regenerated_ids


def regenerate_items_task(item_ids: list[int]) -> None:
    """Background entry point: regenerate pre-resolved affected item ids."""
    regenerate_items_parallel(item_ids)


def regenerate_related_items_for_group(
    db: Session,
    group_id: int,
    document_ids: list[int] | None = None,
) -> dict[str, list[int] | int]:
    items = db.query(Item).filter(Item.group_id == group_id).all()
    all_item_ids = [item.id for item in items]

    affected_ids = items_affected_by_documents(db, group_id, document_ids)
    updated_item_ids = regenerate_items_parallel(affected_ids)

    updated_set = set(updated_item_ids)
    skipped_item_ids = [item_id for item_id in all_item_ids if item_id not in updated_set]

    return {
        "updated_item_ids": updated_item_ids,
        "skipped_item_ids": skipped_item_ids,
        "updated_count": len(updated_item_ids),
        "skipped_count": len(skipped_item_ids),
    }


def regenerate_related_items_task(
    group_id: int,
    document_ids: list[int] | None = None,
    item_ids: list[int] | None = None,
) -> None:
    if item_ids is not None:
        target_item_ids = item_ids
    else:
        db = SessionLocal()
        try:
            target_item_ids = items_affected_by_documents(db, group_id, document_ids)
        finally:
            db.close()
            
    if target_item_ids:
        regenerate_items_task(target_item_ids)


def invalidate_related_item_variants(
    db: Session,
    group_id: int,
    document_ids: list[int] | None = None,
) -> list[int]:
    """Delete cached variants for items affected by the changed documents."""
    service = get_item_content_service()
    affected_ids = items_affected_by_documents(db, group_id, document_ids)
    for item_id in affected_ids:
        service.delete_variants_for_item(db, item_id)
    return affected_ids
