from app.modules.content.tts import TTS_TIMEOUT_SECONDS


def test_tts_timeout_allows_long_llm_content():
    assert TTS_TIMEOUT_SECONDS >= 30
