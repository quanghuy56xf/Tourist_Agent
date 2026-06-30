from langchain_core.documents import Document


def normalize_text(value: str) -> str:
    return " ".join((value or "").split()).strip().lower()


def _query_terms(query: str) -> set[str]:
    return {term for term in normalize_text(query).split() if len(term) >= 3}


def _text_mentions_item(item_name: str, item_description: str, text: str) -> bool:
    lowered = normalize_text(text)
    name = normalize_text(item_name)
    if name and name in lowered:
        return True
    description = normalize_text(item_description)
    if description and len(description) >= 8 and description in lowered:
        return True
    return any(term in lowered for term in name.split() if len(term) >= 3)


def rerank_documents(
    *,
    query: str,
    item_name: str,
    item_description: str,
    documents: list[Document],
) -> list[Document]:
    terms = _query_terms(query)
    item_name_norm = normalize_text(item_name)

    scored: list[tuple[float, int, Document]] = []
    for index, document in enumerate(documents):
        metadata = dict(document.metadata or {})
        text = normalize_text(document.page_content)
        section = normalize_text(str(metadata.get("section_title") or ""))
        score = 0.0
        reasons: list[str] = []

        if metadata.get("source") == "item":
            score += 0.4
            reasons.append("official_item_source")
        if item_name_norm and item_name_norm in text:
            score += 0.35
            reasons.append("item_name_match")
        elif _text_mentions_item(item_name, item_description, document.page_content):
            score += 0.22
            reasons.append("item_term_match")
        if terms:
            overlap = len([term for term in terms if term in text or term in section])
            if overlap:
                score += min(0.25, overlap * 0.04)
                reasons.append("query_term_overlap")
        if section and any(term in section for term in terms):
            score += 0.08
            reasons.append("section_overlap")
        quality_score = metadata.get("quality_score")
        if isinstance(quality_score, (int, float)):
            score += min(0.08, max(0.0, float(quality_score)) * 0.08)
        score += max(0.0, 0.1 - index * 0.01)

        metadata["rerank_score"] = round(score, 4)
        metadata["rerank_reasons"] = ",".join(reasons)
        scored.append((score, index, Document(page_content=document.page_content, metadata=metadata)))

    scored.sort(key=lambda item: (-item[0], item[1]))
    return [document for _, _, document in scored]
