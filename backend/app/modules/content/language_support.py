"""Shared visitor language labels and helpers."""

from __future__ import annotations

LANGUAGE_VI = "Tiếng Việt"
LANGUAGE_EN = "Tiếng Anh"
LANGUAGE_FR = "Tiếng Pháp"
LANGUAGE_JA = "Tiếng Nhật"
LANGUAGE_KO = "Tiếng Hàn"
LANGUAGE_ZH = "Tiếng Trung"

LANGUAGES = (
    LANGUAGE_VI,
    LANGUAGE_EN,
    LANGUAGE_FR,
    LANGUAGE_JA,
    LANGUAGE_KO,
    LANGUAGE_ZH,
)

LOCALE_ALIASES: dict[str, str] = {
    "vi": LANGUAGE_VI,
    "vi-vn": LANGUAGE_VI,
    "en": LANGUAGE_EN,
    "en-us": LANGUAGE_EN,
    "en-gb": LANGUAGE_EN,
    "fr": LANGUAGE_FR,
    "fr-fr": LANGUAGE_FR,
    "ja": LANGUAGE_JA,
    "ja-jp": LANGUAGE_JA,
    "ko": LANGUAGE_KO,
    "ko-kr": LANGUAGE_KO,
    "zh": LANGUAGE_ZH,
    "zh-cn": LANGUAGE_ZH,
    "zh-hans": LANGUAGE_ZH,
}

DOCUMENT_NOT_FOUND_BY_LANGUAGE: dict[str, str] = {
    LANGUAGE_VI: "Tôi không tìm thấy thông tin trong tài liệu.",
    LANGUAGE_EN: "I could not find information about this in the documents.",
    LANGUAGE_FR: "Je n'ai pas trouvé d'informations à ce sujet dans les documents.",
    LANGUAGE_JA: "資料の中にその情報は見つかりませんでした。",
    LANGUAGE_KO: "문서에서 해당 정보를 찾을 수 없습니다.",
    LANGUAGE_ZH: "我在资料中没有找到相关信息。",
}

NO_ITEM_KNOWLEDGE_BY_LANGUAGE: dict[str, str] = {
    LANGUAGE_VI: "Hiện chưa có đủ thông tin xác thực về hiện vật này.",
    LANGUAGE_EN: "There is not enough verified information about this object yet.",
    LANGUAGE_FR: "Il n'y a pas encore assez d'informations vérifiées sur cet objet.",
    LANGUAGE_JA: "この資料について、まだ十分な確認情報がありません。",
    LANGUAGE_KO: "이 유물에 대한 검증된 정보가 아직 충분하지 않습니다.",
    LANGUAGE_ZH: "关于这件文物，目前还没有足够的核实信息。",
}

ANSWER_LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    LANGUAGE_VI: "BẮT BUỘC trả lời bằng Tiếng Việt.",
    LANGUAGE_EN: "BẮT BUỘC trả lời bằng Tiếng Anh (MUST ANSWER IN ENGLISH).",
    LANGUAGE_FR: "BẮT BUỘC trả lời bằng Tiếng Pháp (MUST ANSWER IN FRENCH).",
    LANGUAGE_JA: "BẮT BUỘC trả lời bằng Tiếng Nhật (MUST ANSWER IN JAPANESE).",
    LANGUAGE_KO: "BẮT BUỘC trả lời bằng Tiếng Hàn (MUST ANSWER IN KOREAN).",
    LANGUAGE_ZH: "BẮT BUỘC trả lời bằng Tiếng Trung giản thể (MUST ANSWER IN SIMPLIFIED CHINESE).",
}

WRITE_LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    LANGUAGE_VI: "BẮT BUỘC viết bằng Tiếng Việt.",
    LANGUAGE_EN: "BẮT BUỘC viết bằng Tiếng Anh (MUST WRITE IN ENGLISH).",
    LANGUAGE_FR: "BẮT BUỘC viết bằng Tiếng Pháp (MUST WRITE IN FRENCH).",
    LANGUAGE_JA: "BẮT BUỘC viết bằng Tiếng Nhật (MUST WRITE IN JAPANESE).",
    LANGUAGE_KO: "BẮT BUỘC viết bằng Tiếng Hàn (MUST WRITE IN KOREAN).",
    LANGUAGE_ZH: "BẮT BUỘC viết bằng Tiếng Trung giản thể (MUST WRITE IN SIMPLIFIED CHINESE).",
}

EDGE_TTS_VOICES: dict[str, str] = {
    LANGUAGE_VI: "vi-VN-HoaiMyNeural",
    LANGUAGE_EN: "en-US-JennyNeural",
    LANGUAGE_FR: "fr-FR-DeniseNeural",
    LANGUAGE_JA: "ja-JP-NanamiNeural",
    LANGUAGE_KO: "ko-KR-SunHiNeural",
    LANGUAGE_ZH: "zh-CN-XiaoxiaoNeural",
}

TTS_CODE_BY_LANGUAGE: dict[str, str] = {
    LANGUAGE_VI: "vi",
    LANGUAGE_EN: "en",
    LANGUAGE_FR: "fr",
    LANGUAGE_JA: "ja",
    LANGUAGE_KO: "ko",
    LANGUAGE_ZH: "zh",
}


def normalize_language_label(language: str) -> str:
    raw = (language or "").strip()
    if raw in LANGUAGES:
        return raw
    lowered = raw.lower()
    if lowered in LOCALE_ALIASES:
        return LOCALE_ALIASES[lowered]
    return LANGUAGE_VI


def answer_language_instruction(language: str) -> str:
    return ANSWER_LANGUAGE_INSTRUCTIONS.get(
        normalize_language_label(language),
        ANSWER_LANGUAGE_INSTRUCTIONS[LANGUAGE_VI],
    )


def write_language_instruction(language: str) -> str:
    return WRITE_LANGUAGE_INSTRUCTIONS.get(
        normalize_language_label(language),
        WRITE_LANGUAGE_INSTRUCTIONS[LANGUAGE_VI],
    )


def document_not_found_message(language: str) -> str:
    return DOCUMENT_NOT_FOUND_BY_LANGUAGE.get(
        normalize_language_label(language),
        DOCUMENT_NOT_FOUND_BY_LANGUAGE[LANGUAGE_VI],
    )


def no_item_knowledge_message(language: str) -> str:
    return NO_ITEM_KNOWLEDGE_BY_LANGUAGE.get(
        normalize_language_label(language),
        NO_ITEM_KNOWLEDGE_BY_LANGUAGE[LANGUAGE_VI],
    )


def language_to_tts_code(language: str) -> str:
    return TTS_CODE_BY_LANGUAGE.get(normalize_language_label(language), "vi")


def language_to_edge_voice(language: str, persona: str | None = None) -> str:
    normalized = normalize_language_label(language)
    if persona == "Companion":
        if normalized == LANGUAGE_EN:
            return "en-US-GuyNeural"
        if normalized == LANGUAGE_FR:
            return "fr-FR-HenriNeural"
        if normalized == LANGUAGE_JA:
            return "ja-JP-KeitaNeural"
        if normalized == LANGUAGE_KO:
            return "ko-KR-InJoonNeural"
        if normalized == LANGUAGE_ZH:
            return "zh-CN-YunxiNeural"
        return "vi-VN-NamMinhNeural"
    return EDGE_TTS_VOICES[normalized]
