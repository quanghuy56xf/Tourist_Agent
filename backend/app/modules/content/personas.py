PERSONAS = ("Mặc định", "Gen Z Explorer", "Family Visitor")
LANGUAGES = ("Tiếng Việt", "Tiếng Anh")

DEFAULT_PERSONA = PERSONAS[0]
DEFAULT_LANGUAGE = LANGUAGES[0]
PRIORITY_VARIANT = (DEFAULT_PERSONA, DEFAULT_LANGUAGE)


def all_variants() -> list[tuple[str, str]]:
    return [(persona, language) for persona in PERSONAS for language in LANGUAGES]


def normalize_persona(persona: str) -> str:
    if persona in PERSONAS:
        return persona
    return DEFAULT_PERSONA


def normalize_language(language: str) -> str:
    if language in LANGUAGES:
        return language
    return DEFAULT_LANGUAGE


def language_to_tts_code(language: str) -> str:
    return "vi" if language == "Tiếng Việt" else "en"
