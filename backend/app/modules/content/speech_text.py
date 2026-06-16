import re

# Emoji, pictographs, dingbats, and decorative symbols/icons (not letters/digits).
_SYMBOLS_PATTERN = re.compile(
    "["
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U0001F300-\U0001FAFF"  # pictographs & supplemental symbols
    "\U0001F600-\U0001F64F"  # emoticons
    "\U00002600-\U000027BF"  # misc symbols & dingbats (e.g. ✦ ★ →)
    "\U00002190-\U000021FF"  # arrows
    "\U00002300-\U000023FF"  # misc technical (e.g. ⏸)
    "\U0000200D"             # zero-width joiner (emoji sequences)
    "\U0000FE0E-\U0000FE0F"  # variation selectors
    "]+",
    flags=re.UNICODE,
)

_LEADING_DECOR_PATTERN = re.compile(
    r"^[\s•●○▪▫◦‣⁃\-–—*+>]+",
    re.MULTILINE,
)


def prepare_text_for_speech(text: str) -> str:
    """Remove emoji and decorative icons before text-to-speech."""
    cleaned = _SYMBOLS_PATTERN.sub(" ", text)
    cleaned = _LEADING_DECOR_PATTERN.sub("", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()
