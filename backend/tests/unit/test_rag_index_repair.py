from app.modules.rag.index_repair import find_surplus_vector_ids


def test_find_surplus_vector_ids_preserves_expected_multiplicity():
    ids = ["a1", "a2", "b1", "unknown"]
    documents = ["A", "A", "B", "C"]
    expected_documents = ["A", "B"]

    assert find_surplus_vector_ids(
        ids=ids,
        documents=documents,
        metadatas=[{}, {}, {}, {}],
        expected_documents=expected_documents,
        expected_metadatas=[{}, {}],
    ) == ["a2", "unknown"]


def test_find_surplus_vector_ids_keeps_duplicate_expected_chunks():
    ids = ["a1", "a2", "a3"]
    documents = ["A", "A", "A"]
    expected_documents = ["A", "A"]

    assert find_surplus_vector_ids(
        ids=ids,
        documents=documents,
        metadatas=[{}, {}, {}],
        expected_documents=expected_documents,
        expected_metadatas=[{}, {}],
    ) == ["a3"]


def test_find_surplus_vector_ids_preserves_canonical_item_id():
    metadata = {"source": "item", "page": "item-7", "item_id": 7}

    assert find_surplus_vector_ids(
        ids=["legacy-uuid", "item-7"],
        documents=["same", "same"],
        metadatas=[metadata, metadata],
        expected_documents=["same"],
        expected_metadatas=[metadata],
    ) == ["legacy-uuid"]


def test_find_surplus_vector_ids_matches_normalized_source_metadata():
    assert find_surplus_vector_ids(
        ids=["keep", "wrong-page"],
        documents=["same", "same"],
        metadatas=[
            {"source": "data/reference.pdf", "page": 2},
            {"source": "reference.pdf", "page": 3},
        ],
        expected_documents=["same"],
        expected_metadatas=[{"source": "reference.pdf", "page": 2}],
    ) == ["wrong-page"]
