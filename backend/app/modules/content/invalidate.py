from sqlalchemy.orm import Session

from app.modules.content.bulk_update import (
    invalidate_related_item_variants,
    regenerate_related_items_task,
)


def invalidate_item_content_for_group(
    db: Session,
    group_id: int,
    document_ids: list[int] | None = None,
) -> None:
    invalidate_related_item_variants(db, group_id, document_ids)


def invalidate_and_regenerate_related_item_content(
    group_id: int,
    document_ids: list[int] | None = None,
) -> None:
    regenerate_related_items_task(group_id, document_ids)
