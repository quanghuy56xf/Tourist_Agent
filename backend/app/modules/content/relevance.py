import logging

from sqlalchemy.orm import Session

from app.core.config import CONTENT_REGEN_TOP_K
from app.models.group_document import GroupDocument
from app.models.item import Item
from app.modules.rag.retriever import try_get_rag_retriever
from app.modules.rag.service import build_item_retrieval_query, text_mentions_item

logger = logging.getLogger(__name__)


def _item_mentions_in_text(item: Item, text: str) -> bool:
    return text_mentions_item(item.name, item.description or "", text)


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


def _item_has_changed_doc_in_top_k(
    item: Item,
    document_ids: set[int] | None,
    *,
    top_k: int = CONTENT_REGEN_TOP_K,
) -> bool:
    """True when a changed document contributes at least one top-k chunk for this item."""
    retriever = try_get_rag_retriever()
    if retriever is None or item.group_id is None:
        return False

    query = build_item_retrieval_query(item.name, item.description or "")
    try:
        docs = retriever.retrieve(query, top_k=top_k, group_id=item.group_id)
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
        if doc_id is None:
            continue
        if document_ids is not None and doc_id not in document_ids:
            continue
        return True

    return False


def items_affected_by_documents(
    db: Session,
    group_id: int,
    document_ids: list[int] | None = None,
) -> list[int]:
    """Return item ids whose content should refresh after document changes.

    An item is affected when the changed document(s) appear in the item's
    top-k retrieved chunks, or when the item name appears in the changed
    document text (fast path when RAG is unavailable).
    """
    items = db.query(Item).filter(Item.group_id == group_id).all()
    if not items:
        return []

    doc_id_set = set(document_ids) if document_ids else None
    affected: list[int] = []

    for item in items:
        if _name_in_documents(db, item, document_ids):
            affected.append(item.id)
            continue
        if _item_has_changed_doc_in_top_k(item, doc_id_set):
            affected.append(item.id)

    return affected


def is_item_related_to_documents(
    db: Session,
    item: Item,
    document_ids: list[int] | None = None,
) -> bool:
    """Backward-compatible single-item check."""
    if item.group_id is None:
        return False
    if _name_in_documents(db, item, document_ids):
        return True
    doc_id_set = set(document_ids) if document_ids else None
    return _item_has_changed_doc_in_top_k(item, doc_id_set)
