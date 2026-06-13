import logging

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.item import Item
from app.modules.content.relevance import is_item_related_to_documents
from app.modules.content.service import get_item_content_service

logger = logging.getLogger(__name__)


def regenerate_related_items_for_group(
    db: Session,
    group_id: int,
    document_ids: list[int] | None = None,
) -> dict[str, list[int] | int]:
    service = get_item_content_service()
    items = db.query(Item).filter(Item.group_id == group_id).all()

    updated_item_ids: list[int] = []
    skipped_item_ids: list[int] = []

    for item in items:
        if not is_item_related_to_documents(db, item, document_ids):
            skipped_item_ids.append(item.id)
            continue

        service.delete_variants_for_item(db, item.id)
        try:
            service.regenerate_all_variants_from_rag(db, item)
            updated_item_ids.append(item.id)
        except Exception:
            logger.exception("Bulk content regenerate failed for item %s", item.id)

    return {
        "updated_item_ids": updated_item_ids,
        "skipped_item_ids": skipped_item_ids,
        "updated_count": len(updated_item_ids),
        "skipped_count": len(skipped_item_ids),
    }


def regenerate_related_items_task(
    group_id: int,
    document_ids: list[int] | None = None,
) -> None:
    db = SessionLocal()
    try:
        regenerate_related_items_for_group(db, group_id, document_ids)
    finally:
        db.close()


def invalidate_related_item_variants(
    db: Session,
    group_id: int,
    document_ids: list[int] | None = None,
) -> list[int]:
    service = get_item_content_service()
    items = db.query(Item).filter(Item.group_id == group_id).all()
    invalidated: list[int] = []
    for item in items:
        if is_item_related_to_documents(db, item, document_ids):
            service.delete_variants_for_item(db, item.id)
            invalidated.append(item.id)
    return invalidated
