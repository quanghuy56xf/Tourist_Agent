PERSONAS = ("Mặc định", "Gen Z Explorer", "Family Visitor")
COMPANION_PERSONA = "Companion"
LANGUAGES = ("Tiếng Việt", "Tiếng Anh")

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
    if language in LANGUAGES:
        return language
    return DEFAULT_LANGUAGE


def language_to_tts_code(language: str) -> str:
    return "vi" if language == "Tiếng Việt" else "en"


EDGE_TTS_VOICES: dict[str, str] = {
    "Tiếng Việt": "vi-VN-HoaiMyNeural",
    "Tiếng Anh": "en-US-JennyNeural",
}


def language_to_edge_voice(language: str, persona: str | None = None) -> str:
    if persona == "Companion":
        return "en-US-AndrewNeural" if language == "Tiếng Anh" else "vi-VN-NamMinhNeural"

    raw = (language or "").strip()
    lowered = raw.lower()
    if raw in EDGE_TTS_VOICES:
        return EDGE_TTS_VOICES[raw]
    if lowered in ("vi", "vi-vn") or raw == "Tiếng Việt":
        return EDGE_TTS_VOICES["Tiếng Việt"]
    if lowered in ("en", "en-us", "en-gb") or raw == "Tiếng Anh":
        return EDGE_TTS_VOICES["Tiếng Anh"]
    normalized = normalize_language(raw)
    return EDGE_TTS_VOICES[normalized]
