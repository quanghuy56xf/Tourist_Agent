import argparse
import pickle
import shutil
from datetime import datetime
from pathlib import Path

import chromadb
from rank_bm25 import BM25Okapi

from app.modules.rag.index_repair import (
    find_missing_documents,
    find_surplus_vector_ids,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit and repair duplicate vectors in the RAG index.",
    )
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--collection", default="langchain")
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    data_dir = args.data_dir.resolve()
    chunks_path = data_dir / "rag" / "chunks.pkl"
    bm25_path = data_dir / "rag" / "bm25_index.pkl"
    chroma_path = data_dir / "rag_chroma"

    with chunks_path.open("rb") as file:
        chunks = pickle.load(file)
    expected_documents = [chunk.page_content for chunk in chunks]
    expected_metadatas = [chunk.metadata for chunk in chunks]

    client = chromadb.PersistentClient(path=str(chroma_path))
    collection = client.get_collection(args.collection)
    result = collection.get(include=["documents", "metadatas"])
    ids = list(result.get("ids") or [])
    documents = list(result.get("documents") or [])
    metadatas = list(result.get("metadatas") or [])

    surplus_ids = find_surplus_vector_ids(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
        expected_documents=expected_documents,
        expected_metadatas=expected_metadatas,
    )
    missing_documents = find_missing_documents(
        documents=documents,
        metadatas=metadatas,
        expected_documents=expected_documents,
        expected_metadatas=expected_metadatas,
    )

    print(f"Chunks: {len(expected_documents)}")
    print(f"Vectors: {len(ids)}")
    print(f"Surplus vectors: {len(surplus_ids)}")
    print(f"Missing vectors: {len(missing_documents)}")

    if missing_documents:
        print(
            "Cannot repair without re-embedding because some chunks "
            "have no vector."
        )
        return 2

    if not args.apply:
        print("Dry run only. Use --apply to remove surplus vectors.")
        return 0

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = data_dir / "backups" / f"rag-{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    shutil.copytree(chroma_path, backup_dir / "rag_chroma")
    shutil.copy2(chunks_path, backup_dir / "chunks.pkl")
    shutil.copy2(bm25_path, backup_dir / "bm25_index.pkl")

    if surplus_ids:
        collection.delete(ids=surplus_ids)

    tokenized_corpus = [
        chunk.page_content.lower().split()
        for chunk in chunks
    ]
    with bm25_path.open("wb") as file:
        pickle.dump(BM25Okapi(tokenized_corpus), file)

    print(f"Backup: {backup_dir}")
    print(f"Vectors after repair: {collection.count()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
