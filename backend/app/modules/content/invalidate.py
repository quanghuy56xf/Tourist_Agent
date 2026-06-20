from sqlalchemy.orm import Session

from app.models.item import Item
from app.modules.content.bulk_update import (
    regenerate_items_task,
    regenerate_related_items_task,
)
from app.modules.content.service import get_item_content_service


from app.modules.content.relevance import items_affected_by_documents

def invalidate_item_content_for_group(
    db: Session,
    group_id: int,
    document_ids: list[int] | None = None,
) -> list[int]:
    """Any RAG document change invalidates cached text/audio variants of affected items."""
    affected_ids = items_affected_by_documents(db, group_id, document_ids)
    if affected_ids:
        get_item_content_service().delete_variants_for_items(db, affected_ids)
    return affected_ids


def invalidate_and_regenerate_related_item_content(
    group_id: int,
    document_ids: list[int] | None = None,
    item_ids: list[int] | None = None,
) -> None:
    regenerate_related_items_task(group_id, document_ids, item_ids)
