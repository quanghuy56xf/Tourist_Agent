from app.modules.content.language_support import (
    EDGE_TTS_VOICES,
    LANGUAGES,
    language_to_edge_voice as _language_to_edge_voice,
    language_to_tts_code as _language_to_tts_code,
    normalize_language_label,
)

PERSONAS = ("Mặc định", "Gen Z Explorer", "Family Visitor")
COMPANION_PERSONA = "Companion"

DEFAULT_PERSONA = PERSONAS[0]
DEFAULT_LANGUAGE = LANGUAGES[0]
PRIORITY_VARIANT = (DEFAULT_PERSONA, DEFAULT_LANGUAGE)


def all_variants() -> list[tuple[str, str]]:
    return [(persona, language) for persona in PERSONAS for language in LANGUAGES]


def normalize_persona(persona: str) -> str:
    if persona in PERSONAS:
        return persona
    if persona == COMPANION_PERSONA:
        return COMPANION_PERSONA
    return DEFAULT_PERSONA


def normalize_language(language: str) -> str:
    return normalize_language_label(language)


def language_to_tts_code(language: str) -> str:
    return _language_to_tts_code(language)


def language_to_edge_voice(language: str, persona: str | None = None) -> str:
    return _language_to_edge_voice(language, persona)
