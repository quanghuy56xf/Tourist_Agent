import logging
from typing import Protocol

from langchain_core.documents import Document

logger = logging.getLogger(__name__)

NO_ITEM_KNOWLEDGE_VI = (
    "Hiện chưa có đủ thông tin xác thực về hiện vật này trong tài liệu. "
    "Vui lòng bổ sung mô tả hoặc tài liệu khu di tích có nhắc đến hiện vật."
)
NO_ITEM_KNOWLEDGE_EN = (
    "There is not enough verified information about this artifact in the documents. "
    "Please add a description or heritage-site documents that mention this artifact."
)


class Retriever(Protocol):
    def retrieve(
        self,
        query: str,
        top_k: int,
        group_id: int | None = ...,
    ) -> list[Document]: ...


def normalize_text(value: str) -> str:
    return " ".join((value or "").split()).strip().lower()


def is_substantive_item_description(description: str, item_name: str) -> bool:
    desc = " ".join((description or "").split()).strip()
    name = " ".join((item_name or "").split()).strip()
    if not desc:
        return False
    if normalize_text(desc) == normalize_text(name):
        return False

    remainder = normalize_text(desc)
    for word in normalize_text(name).split():
        remainder = remainder.replace(word, " ", 1).strip()
    remainder = " ".join(remainder.split())

    if len(remainder) < 15:
        return False
    return True


def text_mentions_item(item_name: str, item_description: str, text: str) -> bool:
    lowered = text.lower()
    name = item_name.strip().lower()
    if name and name in lowered:
        return True
    description = (item_description or "").strip().lower()
    return bool(description and len(description) >= 8 and description in lowered)


def no_item_knowledge_message(language: str) -> str:
    if language == "Tiếng Anh":
        return NO_ITEM_KNOWLEDGE_EN
    return NO_ITEM_KNOWLEDGE_VI


def build_item_context(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 5,
    group_id: int | None = None,
    query: str | None = None,
) -> list[Document]:
    docs = [
        Document(
            page_content=item_description,
            metadata={"source": "item", "page": f"item-{item_id}"},
        )
    ]
    if retriever is None or group_id is None:
        return docs

    try:
        retrieved = retriever.retrieve(
            query or f"Giới thiệu chi tiết về {item_name}.",
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


def filter_group_docs_for_item(
    item_name: str,
    item_description: str,
    documents: list[Document],
) -> list[Document]:
    return [
        document
        for document in documents
        if document.metadata.get("source") == "group_doc"
        and text_mentions_item(item_name, item_description, document.page_content)
    ]


def build_verified_item_context(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 5,
    group_id: int | None = None,
    query: str | None = None,
) -> tuple[list[Document], bool]:
    all_docs = build_item_context(
        item_id=item_id,
        item_name=item_name,
        item_description=item_description,
        retriever=retriever,
        top_k=top_k,
        group_id=group_id,
        query=query,
    )
    relevant_group_docs = filter_group_docs_for_item(
        item_name,
        item_description,
        all_docs,
    )
    has_substantive_description = is_substantive_item_description(
        item_description,
        item_name,
    )
    has_verified_knowledge = has_substantive_description or bool(relevant_group_docs)

    verified_docs: list[Document] = []
    if has_substantive_description and all_docs:
        verified_docs.append(all_docs[0])
    verified_docs.extend(relevant_group_docs)
    return verified_docs, has_verified_knowledge


def build_chat_context(
    *,
    item_id: int,
    item_name: str,
    item_description: str,
    retriever: Retriever | None,
    top_k: int = 6,
    group_id: int | None = None,
    query: str | None = None,
) -> tuple[list[Document], bool]:
    all_docs = build_item_context(
        item_id=item_id,
        item_name=item_name,
        item_description=item_description,
        retriever=retriever,
        top_k=top_k,
        group_id=group_id,
        query=query,
    )
    group_docs = [
        document
        for document in all_docs
        if document.metadata.get("source") == "group_doc"
    ]
    item_related_docs = filter_group_docs_for_item(
        item_name,
        item_description,
        group_docs,
    )
    item_related_contents = {
        document.page_content
        for document in item_related_docs
    }
    expanded_docs = [
        document
        for document in group_docs
        if document.page_content not in item_related_contents
    ]

    chat_docs: list[Document] = []
    has_substantive_description = is_substantive_item_description(
        item_description,
        item_name,
    )
    if has_substantive_description and all_docs:
        chat_docs.append(all_docs[0])
    chat_docs.extend(item_related_docs)
    chat_docs.extend(expanded_docs)

    return chat_docs, bool(chat_docs)
