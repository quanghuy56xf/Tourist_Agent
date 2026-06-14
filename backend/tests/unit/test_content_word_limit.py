from app.modules.content.text_utils import limit_words


def make_words(count: int) -> str:
    return " ".join(f"word{i}" for i in range(count))


def test_limit_words_keeps_300_words_unchanged():
    text = make_words(300)
    assert limit_words(text) == text


def test_limit_words_truncates_301_words():
    result = limit_words(make_words(301))
    assert len(result.removesuffix("...").split()) == 300
    assert result.endswith("...")


def test_limit_words_supports_vietnamese_whitespace_words():
    text = " ".join(["di tích"] * 151)
    result = limit_words(text)
    assert len(result.removesuffix("...").split()) == 300
