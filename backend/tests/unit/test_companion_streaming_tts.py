from app.modules.llm.chat_router import _extract_tts_segments


def test_extract_tts_segments_splits_complete_sentence():
    segments, remaining, stop_tts = _extract_tts_segments(
        "Xin chào bạn. Đây là câu hai",
        first_segment=True,
    )

    assert segments == ["Xin chào bạn."]
    assert remaining == "Đây là câu hai"
    assert stop_tts is False


def test_extract_tts_segments_soft_splits_first_segment_at_comma():
    segments, remaining, stop_tts = _extract_tts_segments(
        "Đây là một chi tiết rất thú vị, bởi nó cho thấy tinh thần hiếu học.",
        first_segment=True,
    )

    assert segments[0] == "Đây là một chi tiết rất thú vị,"
    assert remaining.startswith("bởi nó")
    assert stop_tts is False


def test_extract_tts_segments_avoids_tiny_segments():
    segments, remaining, stop_tts = _extract_tts_segments(
        "Ừm,",
        first_segment=True,
    )

    assert segments == []
    assert remaining == "Ừm,"
    assert stop_tts is False


def test_extract_tts_segments_hard_splits_long_text_without_punctuation():
    text = " ".join(["di sản"] * 40)
    segments, remaining, stop_tts = _extract_tts_segments(text, first_segment=True)

    assert len(segments) >= 1
    assert len(segments[0]) <= 150
    assert remaining
    assert stop_tts is False


def test_extract_tts_segments_stops_before_question_marker():
    segments, remaining, stop_tts = _extract_tts_segments(
        "Nội dung này nên được đọc. ||Q: Bạn muốn hỏi gì?||",
        first_segment=True,
    )

    assert segments == ["Nội dung này nên được đọc."]
    assert remaining == ""
    assert stop_tts is True
