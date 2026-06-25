import time

from app.modules.content.audio_backoff import (
    failure_count,
    filter_backoff_targets,
    is_in_backoff,
    record_audio_failure,
    reset_audio_backoff_for_tests,
    resolve_parallel_workers,
)
from app.core.config import (
    CONTENT_AUDIO_BACKOFF_FAILURES,
    CONTENT_TTS_MAX_WORKERS,
    CONTENT_TTS_MIN_WORKERS,
)


def setup_function():
    reset_audio_backoff_for_tests()


def test_backoff_starts_after_repeated_failures():
    target = (9, "Mặc định", "Tiếng Việt")
    for _ in range(CONTENT_AUDIO_BACKOFF_FAILURES):
        record_audio_failure(target)
    assert failure_count(target) == CONTENT_AUDIO_BACKOFF_FAILURES
    assert is_in_backoff(target) is True


def test_filter_backoff_targets_skips_paused_variants():
    target = (3, "Gen Z Explorer", "Tiếng Anh")
    for _ in range(CONTENT_AUDIO_BACKOFF_FAILURES):
        record_audio_failure(target)

    filtered = filter_backoff_targets(
        [
            target,
            (4, "Mặc định", "Tiếng Việt"),
        ]
    )
    assert filtered == [(4, "Mặc định", "Tiếng Việt")]


def test_resolve_parallel_workers_reduces_after_recent_failures():
    record_audio_failure((1, "Mặc định", "Tiếng Việt"))
    record_audio_failure((2, "Mặc định", "Tiếng Việt"))
    workers = resolve_parallel_workers(CONTENT_TTS_MAX_WORKERS)
    assert workers <= max(CONTENT_TTS_MIN_WORKERS, CONTENT_TTS_MAX_WORKERS // 2)
