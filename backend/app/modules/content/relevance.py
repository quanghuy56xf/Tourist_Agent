import logging

from sqlalchemy.orm import Session

from app.models.group_document import GroupDocument
from app.models.item import Item
from app.modules.rag.retriever import try_get_rag_retriever

logger = logging.getLogger(__name__)


def _item_mentions_in_text(item: Item, text: str) -> bool:
    lowered = text.lower()
    name = item.name.strip().lower()
    if name and name in lowered:
        return True
    description = (item.description or "").strip().lower()
    return bool(description and len(description) >= 8 and description in lowered)


def _name_in_documents(
    db: Session,
    item: Item,
    document_ids: list[int] | None,
) -> bool:
    if item.group_id is None:
        return False

    query = db.query(GroupDocument).filter(GroupDocument.group_id == item.group_id)
    if document_ids:
        query = query.filter(GroupDocument.id.in_(document_ids))

    for document in query.all():
        if _item_mentions_in_text(item, document.extracted_text or ""):
            return True
    return False


def is_item_related_to_documents(
    db: Session,
    item: Item,
    document_ids: list[int] | None = None,
) -> bool:
    if item.group_id is None:
        return False

    if _name_in_documents(db, item, document_ids):
        return True

    retriever = try_get_rag_retriever()
    if retriever is None:
        return False

    query = f"Giới thiệu chi tiết về {item.name}. {item.description}"
    try:
        docs = retriever.retrieve(query, top_k=5, group_id=item.group_id)
    except Exception:
        logger.exception("RAG retrieve failed for item %s relevance check", item.id)
        return False

    try:
        retrieved_docs = list(docs)
    except TypeError:
        return False

    for document in retrieved_docs:
        if document.metadata.get("source") != "group_doc":
            continue
        doc_id = document.metadata.get("document_id")
        if document_ids and doc_id not in document_ids:
            continue
        if _item_mentions_in_text(item, document.page_content):
            return True

    return False
