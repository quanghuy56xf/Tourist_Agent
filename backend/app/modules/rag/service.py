import logging
from typing import Protocol

from langchain_core.documents import Document

logger = logging.getLogger(__name__)


class Retriever(Protocol):
    def retrieve(
        self,
        query: str,
        top_k: int,
        group_id: int | None = ...,
    ) -> list[Document]: ...


def build_item_context(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 5,
    group_id: int | None = None,
) -> list[Document]:
    docs = [
        Document(
            page_content=item_description,
            metadata={"source": "item", "page": f"item-{item_id}"},
        )
    ]
    if retriever is None:
        return docs

    try:
        retrieved = retriever.retrieve(
            f"Giới thiệu chi tiết về {item_name}.",
            top_k=top_k,
            group_id=group_id,
        )
    except (MemoryError, OSError, RuntimeError, FileNotFoundError) as exc:
        logger.warning("RAG unavailable; using item description: %s", exc)
        return docs

    seen = {item_description.strip()}
    for document in retrieved:
        content = document.page_content.strip()
        if content and content not in seen:
            docs.append(document)
            seen.add(content)
    return docs
