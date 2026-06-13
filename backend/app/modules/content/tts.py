import io
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from gtts import gTTS

from app.modules.content.personas import language_to_tts_code

logger = logging.getLogger(__name__)

TTS_TIMEOUT_SECONDS = 5


def _synthesize_speech_inner(text: str, language: str) -> tuple[bytes, str]:
    tts = gTTS(
        text=text,
        lang=language_to_tts_code(language),
        slow=False,
    )
    output = io.BytesIO()
    tts.write_to_fp(output)
    return output.getvalue(), "audio/mpeg"


def synthesize_speech(text: str, language: str) -> tuple[bytes, str] | None:
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(_synthesize_speech_inner, text, language)
            return future.result(timeout=TTS_TIMEOUT_SECONDS)
    except FuturesTimeoutError:
        logger.warning("Text-to-speech synthesis timed out after %ss", TTS_TIMEOUT_SECONDS)
        return None
    except Exception:
        logger.exception("Text-to-speech synthesis failed")
        return None
