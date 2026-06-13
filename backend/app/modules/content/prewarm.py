import logging

from app.core.config import CONTENT_PREWARM_ALL_VARIANTS, CONTENT_PREWARM_ENABLED
from app.core.database import SessionLocal
from app.models.item import Item
from app.modules.content.personas import PRIORITY_VARIANT, all_variants
from app.modules.content.service import get_item_content_service

logger = logging.getLogger(__name__)


def prewarm_item_content(item_id: int) -> None:
    if not CONTENT_PREWARM_ENABLED:
        return

    db = SessionLocal()
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if item is None:
            return

        service = get_item_content_service()
        variants = all_variants() if CONTENT_PREWARM_ALL_VARIANTS else [PRIORITY_VARIANT]
        for persona, language in variants:
            try:
                if service.get_valid_variant(db, item, persona, language) is not None:
                    continue
                service.generate_and_persist(
                    db,
                    item,
                    persona,
                    language,
                    source="pregenerated",
                )
            except Exception as exc:
                logger.warning(
                    "Prewarm failed for item %s (%s, %s): %s",
                    item_id,
                    persona,
                    language,
                    exc,
                )
    finally:
        db.close()


def invalidate_and_prewarm_item_content(item_id: int) -> None:
    db = SessionLocal()
    try:
        get_item_content_service().delete_variants_for_item(db, item_id)
    finally:
        db.close()
    prewarm_item_content(item_id)
