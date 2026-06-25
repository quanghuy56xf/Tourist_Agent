import threading
from typing import Literal

from sqlalchemy.orm import Session

from app.models.content_variant import ItemContentVariant
from app.models.item import Item
from app.modules.content.bulk_update import regenerate_items_parallel
from app.modules.content.personas import all_variants
from app.modules.content.service import compute_content_hash
from app.modules.content.tts import is_current_audio_mime
from app.modules.content.text_utils import is_no_information_content

ItemContentState = Literal["synced", "partial", "missing", "syncing"]

_active_group_syncs: set[int] = set()
_sync_lock = threading.Lock()


def mark_group_sync_started(group_id: int) -> None:
    with _sync_lock:
        _active_group_syncs.add(group_id)


def mark_group_sync_finished(group_id: int) -> None:
    with _sync_lock:
        _active_group_syncs.discard(group_id)


def is_group_sync_active(group_id: int) -> bool:
    with _sync_lock:
        return group_id in _active_group_syncs


def _variant_is_ready(item: Item, variant: ItemContentVariant | None) -> bool:
    if variant is None:
        return False
    if variant.status != "ready":
        return False
    if not (variant.text_content or "").strip():
        return False
    if is_no_information_content(variant.text_content):
        expected_hash = compute_content_hash(item.description, source=variant.source)
        return variant.content_hash == expected_hash
    if variant.audio_data is None:
        return False
    if not is_current_audio_mime(variant.audio_mime):
        return False
    expected_hash = compute_content_hash(item.description, source=variant.source)
    return variant.content_hash == expected_hash


def evaluate_item_content_status(
    item: Item,
    variants: list[ItemContentVariant],
    *,
    group_sync_active: bool = False,
) -> dict:
    variant_map = {
        (variant.persona, variant.language): variant for variant in variants
    }
    required = all_variants()
    ready_count = 0
    for persona, language in required:
        if _variant_is_ready(item, variant_map.get((persona, language))):
            ready_count += 1

    total = len(required)
    needs_regeneration = ready_count < total

    if ready_count == total:
        state: ItemContentState = "synced"
    elif ready_count == 0:
        state = "missing"
    else:
        state = "partial"

    if group_sync_active and needs_regeneration:
        state = "syncing"

    return {
        "item_id": item.id,
        "state": state,
        "variants_ready": ready_count,
        "variants_total": total,
        "needs_regeneration": needs_regeneration,
    }


def evaluate_group_content_status(db: Session, group_id: int) -> dict:
    items = db.query(Item).filter(Item.group_id == group_id).order_by(Item.id).all()
    if not items:
        return {
            "group_id": group_id,
            "is_sync_active": is_group_sync_active(group_id),
            "summary": {
                "total": 0,
                "synced": 0,
                "needs_update": 0,
                "in_progress": 0,
            },
            "items": [],
        }

    item_ids = [item.id for item in items]
    variants = (
        db.query(ItemContentVariant)
        .filter(ItemContentVariant.item_id.in_(item_ids))
        .all()
    )
    variants_by_item: dict[int, list[ItemContentVariant]] = {}
    for variant in variants:
        variants_by_item.setdefault(variant.item_id, []).append(variant)

    sync_active = is_group_sync_active(group_id)
    item_states = [
        evaluate_item_content_status(
            item,
            variants_by_item.get(item.id, []),
            group_sync_active=sync_active,
        )
        for item in items
    ]

    synced = sum(1 for row in item_states if row["state"] == "synced")
    needs_update = sum(1 for row in item_states if row["needs_regeneration"])
    in_progress = sum(1 for row in item_states if row["state"] == "syncing")

    return {
        "group_id": group_id,
        "is_sync_active": sync_active,
        "summary": {
            "total": len(items),
            "synced": synced,
            "needs_update": needs_update,
            "in_progress": in_progress,
        },
        "items": item_states,
    }


def find_items_needing_regeneration(db: Session, group_id: int) -> list[int]:
    status = evaluate_group_content_status(db, group_id)
    return [
        row["item_id"]
        for row in status["items"]
        if row["needs_regeneration"]
    ]


def sync_missing_items_task(group_id: int, item_ids: list[int]) -> None:
    mark_group_sync_started(group_id)
    try:
        regenerate_items_parallel(item_ids)
    finally:
        mark_group_sync_finished(group_id)
