from app.modules.content.speech_text import prepare_text_for_speech


def test_strips_emoji():
    assert prepare_text_for_speech("Xin chào 😀 các bạn!") == "Xin chào các bạn!"


def test_strips_decorative_icons():
    assert prepare_text_for_speech("✦ Chào mừng đến Văn Miếu") == "Chào mừng đến Văn Miếu"


def test_strips_emoji_sequences_with_zwj():
    assert prepare_text_for_speech("Khám phá 🏛️ di tích") == "Khám phá di tích"


def test_preserves_measurements_and_numbers():
    text = "Diện tích khoảng 120 m² và nhiệt độ 25°C."
    assert prepare_text_for_speech(text) == text


def test_strips_leading_bullets():
    assert prepare_text_for_speech("• Điểm thứ nhất\n• Điểm thứ hai") == (
        "Điểm thứ nhất\nĐiểm thứ hai"
    )


def test_empty_after_strip_returns_empty():
    assert prepare_text_for_speech("😀 🎉 ✦") == ""
