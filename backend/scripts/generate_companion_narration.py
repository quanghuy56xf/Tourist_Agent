"""Generate and store the Vietnamese Companion narration for existing items."""

from __future__ import annotations

import argparse
import logging

from app.core.database import SessionLocal
from app.models.item import Item
from app.modules.content.personas import DEFAULT_LANGUAGE, DEFAULT_PERSONA
from app.modules.content.service import get_item_content_service

logger = logging.getLogger(__name__)
COMPANION_PERSONA = "Companion"


def generate_companion_narration(group_id: int | None = None) -> tuple[int, int]:
    db = SessionLocal()
    generated = 0
    failed = 0
    try:
        query = db.query(Item).order_by(Item.id.asc())
        if group_id is not None:
            query = query.filter(Item.group_id == group_id)

        service = get_item_content_service()
        for item in query.all():
            try:
                base = service.get_valid_variant(
                    db,
                    item,
                    DEFAULT_PERSONA,
                    DEFAULT_LANGUAGE,
                )
                if base is None:
                    base_result = service.get_or_generate(
                        db,
                        item,
                        DEFAULT_PERSONA,
                        DEFAULT_LANGUAGE,
                    )
                    base_content = base_result.content
                else:
                    base_content = base.text_content

                service.generate_adapted_variant(
                    db,
                    item,
                    COMPANION_PERSONA,
                    DEFAULT_LANGUAGE,
                    base_content,
                )
                audio_variant = service.ensure_audio(
                    db,
                    item,
                    COMPANION_PERSONA,
                    DEFAULT_LANGUAGE,
                )
                if audio_variant is None or audio_variant.audio_data is None:
                    raise RuntimeError("Companion audio was not generated")
                generated += 1
                logger.info("Generated Companion narration for item %s", item.id)
            except Exception:
                failed += 1
                logger.exception(
                    "Failed Companion narration for item %s (%s)",
                    item.id,
                    item.name,
                )
        return generated, failed
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--group-id",
        type=int,
        default=None,
        help="Only generate narration for one heritage group.",
    )
    args = parser.parse_args()
    generated, failed = generate_companion_narration(args.group_id)
    print(f"Generated: {generated}; failed: {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
