from unittest.mock import Mock, patch

from app.modules.content.audio_jobs import ensure_audio_parallel


def test_ensure_audio_parallel_deduplicates_targets():
    targets = [
        (1, "Mặc định", "Tiếng Việt"),
        (1, "Mặc định", "Tiếng Việt"),
        (2, "Gen Z Explorer", "Tiếng Anh"),
    ]

    with patch("app.modules.content.audio_jobs._ensure_audio_for_target") as ensure:
        ensure.return_value = True
        done = ensure_audio_parallel(targets, max_workers=2)

    assert done == 2
    assert ensure.call_count == 2


def test_ensure_audio_parallel_counts_successes():
    with patch("app.modules.content.audio_jobs._ensure_audio_for_target") as ensure:
        ensure.side_effect = [True, False]
        done = ensure_audio_parallel(
            [
                (1, "Mặc định", "Tiếng Việt"),
                (2, "Mặc định", "Tiếng Việt"),
            ],
            max_workers=2,
        )

    assert done == 1
