from dataclasses import dataclass

import chromadb

from app.core.config import CHROMA_PATH, SEARCH_TOP_K, SEARCH_TOP_N

COLLECTION_NAME = "object_search_collection"

_client = None
_collection = None


def get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_PATH)
    return _client


def get_collection():
    global _collection
    if _collection is None:
        client = get_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def add_embedding(item_id: int, angle: str, vector: list[float]) -> None:
    collection = get_collection()
    doc_id = f"{item_id}_{angle}"
    collection.upsert(
        ids=[doc_id],
        embeddings=[vector],
        metadatas=[{"item_id": int(item_id), "angle": str(angle)}],
        documents=[f"item_{item_id}_{angle}"],
    )


def _embedding_ids_for_item(item_id: int) -> list[str]:
    collection = get_collection()
    prefix = f"{item_id}_"

    try:
        results = collection.get(where={"item_id": int(item_id)}, include=[])
        ids = list(results.get("ids") or [])
        if ids:
            return ids
    except Exception:
        pass

    results = collection.get(include=[])
    return [
        doc_id
        for doc_id in (results.get("ids") or [])
        if doc_id.startswith(prefix)
    ]


@dataclass
class SearchResult:
    item_id: int
    angle: str
    similarity: float


def _merge_results(
    best_per_item: dict[int, SearchResult],
    metadatas: list,
    distances: list,
) -> None:
    for metadata, distance in zip(metadatas, distances):
        item_id = int(metadata["item_id"])
        similarity = 1.0 - distance
        angle = str(metadata["angle"])
        current = best_per_item.get(item_id)
        if current is None or similarity > current.similarity:
            best_per_item[item_id] = SearchResult(
                item_id=item_id,
                angle=angle,
                similarity=similarity,
            )


def search_best_item(
    vectors: list[list[float]],
    n_results: int | None = None,
) -> SearchResult | None:
    """
    Tìm vật thể tốt nhất bằng cách:
    1. Query top-K vector gần nhất
    2. Gộp theo item_id, lấy similarity cao nhất mỗi vật
    3. Hỗ trợ nhiều query vector (augmentation)
    """
    collection = get_collection()
    count = collection.count()
    if count == 0:
        return None

    k = n_results or SEARCH_TOP_K
    k = min(k, count)

    best_per_item: dict[int, SearchResult] = {}

    for vector in vectors:
        results = collection.query(
            query_embeddings=[vector],
            n_results=k,
            include=["metadatas", "distances"],
        )
        if not results["ids"] or not results["ids"][0]:
            continue
        _merge_results(
            best_per_item,
            results["metadatas"][0],
            results["distances"][0],
        )

    if not best_per_item:
        return None

    return max(best_per_item.values(), key=lambda r: r.similarity)


def search_top_items(
    vectors: list[list[float]],
    top_n: int | None = None,
    n_results: int | None = None,
) -> list[SearchResult]:
    """Trả về top N vật thể có similarity cao nhất (đã gộp theo item_id)."""
    collection = get_collection()
    count = collection.count()
    if count == 0:
        return []

    k = n_results or SEARCH_TOP_K
    k = min(k, count)
    limit = top_n or SEARCH_TOP_N

    best_per_item: dict[int, SearchResult] = {}

    for vector in vectors:
        results = collection.query(
            query_embeddings=[vector],
            n_results=k,
            include=["metadatas", "distances"],
        )
        if not results["ids"] or not results["ids"][0]:
            continue
        _merge_results(
            best_per_item,
            results["metadatas"][0],
            results["distances"][0],
        )

    ranked = sorted(best_per_item.values(), key=lambda r: r.similarity, reverse=True)
    return ranked[:limit]


def _embedding_ids_for_angle(item_id: int, angle: str) -> list[str]:
    ids: list[str] = []
    for doc_id in _embedding_ids_for_item(item_id):
        suffix = doc_id.removeprefix(f"{item_id}_")
        if suffix == angle or suffix.startswith(f"{angle}_aug"):
            ids.append(doc_id)
    return ids


def delete_embedding(item_id: int, angle: str) -> None:
    collection = get_collection()
    ids = _embedding_ids_for_angle(item_id, angle)
    if ids:
        collection.delete(ids=ids)


def delete_embeddings_for_item(item_id: int) -> None:
    collection = get_collection()
    ids = _embedding_ids_for_item(item_id)
    if ids:
        collection.delete(ids=ids)
