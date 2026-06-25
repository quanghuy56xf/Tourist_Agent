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

ItemContentState = Literal["synced", "outdated", "missing", "syncing"]

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

def evaluate_item_content_status(
    item: Item,
    variants: list[ItemContentVariant],
    group_knowledge_version: int,
    *,
    group_sync_active: bool = False,
) -> dict:
    variant_map = {
        (variant.persona, variant.language): variant for variant in variants
    }
    required = all_variants()
    ready_count = 0
    missing_any = False
    outdated_any = False

    for persona, language in required:
        variant = variant_map.get((persona, language))
        if variant is None or variant.status != "ready":
            missing_any = True
            continue

        if not (variant.text_content or "").strip():
            missing_any = True
            continue
            
        expected_hash = compute_content_hash(
            item.description, 
            group_knowledge_version=group_knowledge_version, 
            source=variant.source
        )

        if not is_no_information_content(variant.text_content):
            if variant.audio_data is None:
                missing_any = True
                continue
            if not is_current_audio_mime(variant.audio_mime, persona):
                outdated_any = True
                continue
        
        if variant.content_hash != expected_hash:
            outdated_any = True
            continue

        ready_count += 1

    total = len(required)
    needs_regeneration = ready_count < total

    if missing_any:
        state: ItemContentState = "missing"
    elif outdated_any:
        state = "outdated"
    else:
        state = "synced"

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
    from app.models.group import Group
    group = db.query(Group).filter(Group.id == group_id).first()
    group_knowledge_version = group.knowledge_version if group else 0

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
            group_knowledge_version=group_knowledge_version,
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
