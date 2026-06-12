import pytest

from app.core import config


def test_read_bool_env_uses_default_when_unset(monkeypatch):
    monkeypatch.delenv("TEST_BOOL", raising=False)

    assert config._read_bool_env("TEST_BOOL", True) is True


@pytest.mark.parametrize(
    ("value", "expected"),
    [("true", True), (" TRUE ", True), ("false", False)],
)
def test_read_bool_env_accepts_explicit_values(monkeypatch, value, expected):
    monkeypatch.setenv("TEST_BOOL", value)

    assert config._read_bool_env("TEST_BOOL", False) is expected


def test_read_bool_env_rejects_typo(monkeypatch):
    monkeypatch.setenv("TEST_BOOL", "treu")

    with pytest.raises(ValueError, match="TEST_BOOL"):
        config._read_bool_env("TEST_BOOL", False)
