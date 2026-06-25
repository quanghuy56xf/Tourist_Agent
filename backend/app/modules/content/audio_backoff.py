import logging
import threading
import time
from collections import deque

from app.core.config import (
    CONTENT_AUDIO_BACKOFF_FAILURES,
    CONTENT_AUDIO_BACKOFF_SECONDS,
    CONTENT_AUDIO_FAILURE_WINDOW_SECONDS,
    CONTENT_AUDIO_RETRY_DELAY_SECONDS,
    CONTENT_TTS_MAX_WORKERS,
    CONTENT_TTS_MIN_WORKERS,
)

logger = logging.getLogger(__name__)

AudioTarget = tuple[int, str, str]

_lock = threading.Lock()
_failure_times: dict[AudioTarget, deque[float]] = {}
_recent_failures: deque[float] = deque()


def _prune_deque(times: deque[float], *, window_seconds: float) -> None:
    cutoff = time.time() - window_seconds
    while times and times[0] < cutoff:
        times.popleft()


def _target_failures(target: AudioTarget) -> deque[float]:
    with _lock:
        times = _failure_times.setdefault(target, deque())
        _prune_deque(times, window_seconds=CONTENT_AUDIO_BACKOFF_SECONDS)
        return times


def failure_count(target: AudioTarget) -> int:
    return len(_target_failures(target))


def is_in_backoff(target: AudioTarget) -> bool:
    times = _target_failures(target)
    if len(times) < CONTENT_AUDIO_BACKOFF_FAILURES:
        return False
    return time.time() - times[-1] < CONTENT_AUDIO_BACKOFF_SECONDS


def filter_backoff_targets(targets: list[AudioTarget]) -> list[AudioTarget]:
    allowed: list[AudioTarget] = []
    skipped = 0
    for target in targets:
        if is_in_backoff(target):
            skipped += 1
            continue
        allowed.append(target)
    if skipped:
        logger.info(
            "Skipping %s audio target(s) in backoff (%ss after %s failures)",
            skipped,
            CONTENT_AUDIO_BACKOFF_SECONDS,
            CONTENT_AUDIO_BACKOFF_FAILURES,
        )
    return allowed


def record_audio_failure(target: AudioTarget) -> None:
    now = time.time()
    with _lock:
        times = _failure_times.setdefault(target, deque())
        times.append(now)
        _prune_deque(times, window_seconds=CONTENT_AUDIO_BACKOFF_SECONDS)
        _recent_failures.append(now)
        _prune_deque(_recent_failures, window_seconds=CONTENT_AUDIO_FAILURE_WINDOW_SECONDS)


def clear_audio_backoff(target: AudioTarget) -> None:
    with _lock:
        _failure_times.pop(target, None)


def recent_failure_count() -> int:
    with _lock:
        _prune_deque(_recent_failures, window_seconds=CONTENT_AUDIO_FAILURE_WINDOW_SECONDS)
        return len(_recent_failures)


def resolve_parallel_workers(requested: int | None = None) -> int:
    max_workers = requested or CONTENT_TTS_MAX_WORKERS
    if recent_failure_count() >= 2:
        return min(max_workers, max(CONTENT_TTS_MIN_WORKERS, max_workers // 2))
    return max_workers


def pre_attempt_delay(target: AudioTarget) -> None:
    count = failure_count(target)
    if count <= 0:
        return
    delay = min(
        CONTENT_AUDIO_RETRY_DELAY_SECONDS * count,
        CONTENT_AUDIO_RETRY_DELAY_SECONDS * 3,
    )
    time.sleep(delay)


def reset_audio_backoff_for_tests() -> None:
    with _lock:
        _failure_times.clear()
        _recent_failures.clear()
