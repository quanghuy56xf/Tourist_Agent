from app.modules.content.personas import language_to_edge_voice
from app.modules.content.tts import (
    TTS_ENGINE_ID,
    TTS_TIMEOUT_SECONDS,
    build_audio_mime,
    is_current_audio_mime,
)


def test_tts_timeout_allows_long_llm_content():
    assert TTS_TIMEOUT_SECONDS >= 30


def test_vietnamese_voice_is_hoai_my():
    assert language_to_edge_voice("Tiếng Việt") == "vi-VN-HoaiMyNeural"


def test_short_vi_code_maps_to_hoai_my():
    assert language_to_edge_voice("vi") == "vi-VN-HoaiMyNeural"


def test_english_voice_is_jenny():
    assert language_to_edge_voice("Tiếng Anh") == "en-US-JennyNeural"


def test_short_en_code_maps_to_jenny():
    assert language_to_edge_voice("en") == "en-US-JennyNeural"


def test_stale_audio_mime_is_not_current():
    assert not is_current_audio_mime("audio/mpeg")
    assert is_current_audio_mime(build_audio_mime())
    assert TTS_ENGINE_ID in build_audio_mime()
