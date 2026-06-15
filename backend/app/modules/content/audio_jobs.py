import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.core.config import CONTENT_TTS_MAX_WORKERS
from app.core.database import SessionLocal
from app.models.content_variant import ItemContentVariant
from app.models.item import Item
from app.modules.content.service import get_item_content_service
from app.modules.content.tts import is_current_audio_mime

logger = logging.getLogger(__name__)

# (item_id, persona, language)
AudioTarget = tuple[int, str, str]


def find_audio_gaps(db) -> list[AudioTarget]:
    """Return variants that have text but are missing current audio."""
    rows = (
        db.query(
            ItemContentVariant.item_id,
            ItemContentVariant.persona,
            ItemContentVariant.language,
            ItemContentVariant.audio_mime,
            ItemContentVariant.audio_data.is_(None).label("audio_missing"),
        )
        .filter(
            ItemContentVariant.status == "ready",
            ItemContentVariant.text_content != "",
        )
        .all()
    )

    gaps: list[AudioTarget] = []
    for item_id, persona, language, audio_mime, audio_missing in rows:
        if audio_missing or not is_current_audio_mime(audio_mime):
            gaps.append((item_id, persona, language))
    return gaps


def _ensure_audio_for_target(target: AudioTarget) -> bool:
    item_id, persona, language = target
    db = SessionLocal()
    try:
        item = db.query(Item).filter(Item.id == item_id).first()
        if item is None:
            return False
        variant = get_item_content_service().ensure_audio(db, item, persona, language)
        return variant is not None and variant.audio_data is not None
    except Exception:
        logger.exception(
            "Audio synthesis failed for item %s (%s, %s)", item_id, persona, language
        )
        return False
    finally:
        db.close()


def ensure_audio_parallel(
    targets: list[AudioTarget],
    max_workers: int | None = None,
) -> int:
    """Synthesize audio for the given variants concurrently.

    TTS runs only after each variant's text exists; callers should invoke this
    after the text-generation phase completes.
    """
    unique = list(dict.fromkeys(targets))
    if not unique:
        return 0

    workers = max_workers or CONTENT_TTS_MAX_WORKERS
    done = 0
    with ThreadPoolExecutor(max_workers=min(workers, len(unique))) as executor:
        futures = {
            executor.submit(_ensure_audio_for_target, target): target
            for target in unique
        }
        for future in as_completed(futures):
            if future.result():
                done += 1
    return done


def sweep_missing_audio(max_workers: int | None = None) -> int:
    """Find every description missing audio and synthesize it in parallel."""
    db = SessionLocal()
    try:
        gaps = find_audio_gaps(db)
    finally:
        db.close()

    if not gaps:
        return 0

    logger.info("Audio sweep: synthesizing %s missing description audio(s)", len(gaps))
    produced = ensure_audio_parallel(gaps, max_workers=max_workers)
    logger.info("Audio sweep: produced audio for %s/%s description(s)", produced, len(gaps))
    return produced
