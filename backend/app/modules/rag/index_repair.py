from collections.abc import Sequence
from pathlib import PurePath
from typing import Any


def _normalized_metadata(metadata: dict[str, Any] | None) -> tuple:
    metadata = metadata or {}
    source = metadata.get("source")
    normalized_source = (
        PurePath(str(source).replace("\\", "/")).name.casefold()
        if source
        else None
    )
    return (
        normalized_source,
        metadata.get("page"),
        metadata.get("item_id"),
    )


def _document_key(
    document: str,
    metadata: dict[str, Any] | None,
) -> tuple:
    return (document, *_normalized_metadata(metadata))


def find_surplus_vector_ids(
    *,
    ids: Sequence[str],
    documents: Sequence[str],
    metadatas: Sequence[dict[str, Any] | None],
    expected_documents: Sequence[str],
    expected_metadatas: Sequence[dict[str, Any] | None],
) -> list[str]:
    expected = [
        _document_key(document, metadata)
        for document, metadata in zip(
            expected_documents,
            expected_metadatas,
        )
    ]
    remaining_indices = set(range(len(ids)))

    # Item documents have a stable canonical ID. Preserve it before matching
    # legacy UUID vectors that may contain the same content and metadata.
    for expected_key in expected:
        item_id = expected_key[-1]
        if item_id is None:
            continue
        canonical_id = f"item-{item_id}"
        for index in tuple(remaining_indices):
            if (
                ids[index] == canonical_id
                and _document_key(documents[index], metadatas[index])
                == expected_key
            ):
                remaining_indices.remove(index)
                break

    for expected_key in expected:
        item_id = expected_key[-1]
        canonical_id = f"item-{item_id}" if item_id is not None else None
        if canonical_id and canonical_id not in {
            ids[index] for index in remaining_indices
        }:
            # The canonical item vector may already have been consumed above.
            if canonical_id in ids:
                continue
        for index in tuple(remaining_indices):
            if _document_key(documents[index], metadatas[index]) == expected_key:
                remaining_indices.remove(index)
                break

    return [ids[index] for index in sorted(remaining_indices)]


def find_missing_documents(
    *,
    documents: Sequence[str],
    metadatas: Sequence[dict[str, Any] | None],
    expected_documents: Sequence[str],
    expected_metadatas: Sequence[dict[str, Any] | None],
) -> list[str]:
    available = [
        _document_key(document, metadata)
        for document, metadata in zip(documents, metadatas)
    ]
    missing: list[str] = []

    for document, metadata in zip(expected_documents, expected_metadatas):
        key = _document_key(document, metadata)
        try:
            available.remove(key)
        except ValueError:
            missing.append(document)

    return missing
