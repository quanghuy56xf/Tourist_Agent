from sqlalchemy.orm import Session

from app.models.item import Item
from app.modules.content.bulk_update import (
    regenerate_items_task,
    regenerate_related_items_task,
)
from app.modules.content.service import get_item_content_service


def invalidate_item_content_for_group(
    db: Session,
    group_id: int,
    document_ids: list[int] | None = None,
) -> list[int]:
    """Any RAG document change invalidates every cached text/audio variant."""
    item_ids = [item_id for (item_id,) in db.query(Item.id).all()]
    get_item_content_service().delete_all_variants(db)
    return item_ids


def invalidate_and_regenerate_related_item_content(
    group_id: int,
    document_ids: list[int] | None = None,
    item_ids: list[int] | None = None,
) -> None:
    regenerate_related_items_task(group_id, document_ids, item_ids)
