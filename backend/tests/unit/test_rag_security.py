import pytest
from langchain_core.documents import Document

from app.modules.rag.security import (
    build_governance_result,
    detect_sensitive_data,
    normalize_trust_level,
    normalize_visibility,
    sanitize_filename,
)
from app.modules.rag.retriever import HybridRetriever


def test_sanitize_filename_removes_path_and_unsafe_chars():
    assert sanitize_filename("../secret/tài liệu<>.txt") == "tài liệu_.txt"


def test_detect_sensitive_data_flags_common_patterns():
    warnings = detect_sensitive_data(
        "Liên hệ admin@example.com, token=abcd1234secret, -----BEGIN PRIVATE KEY-----"
    )

    assert "sensitive_email" in warnings
    assert "sensitive_api_key" in warnings
    assert "sensitive_private_key" in warnings


def test_build_governance_result_warns_for_public_sensitive_document():
    result = build_governance_result(
        filename="doc.txt",
        text="Email: user@example.com",
        visibility="public",
        trust_level="official",
    )

    assert result.visibility == "public"
    assert result.trust_level == "official"
    assert "sensitive_email" in result.warnings
    assert "public_document_contains_sensitive_patterns" in result.warnings


@pytest.mark.parametrize("value", ["secret", "PUBLIC "])
def test_invalid_visibility_is_rejected(value):
    if value == "PUBLIC ":
        assert normalize_visibility(value) == "public"
    else:
        with pytest.raises(ValueError, match="invalid_visibility"):
            normalize_visibility(value)


def test_invalid_trust_level_is_rejected():
    with pytest.raises(ValueError, match="invalid_trust_level"):
        normalize_trust_level("random")


def test_group_scope_rejects_draft_group_docs():
    doc = Document(
        page_content="Draft knowledge",
        metadata={"source": "group_doc", "group_id": 2, "visibility": "draft"},
    )

    assert HybridRetriever._matches_group_scope(doc, group_id=2) is False
