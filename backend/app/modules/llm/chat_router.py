import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.item import Item
from app.modules.content.text_utils import limit_words
from app.modules.llm.client import LLMServiceUnavailableError
from app.modules.llm.generator import get_rag_generator
from app.modules.rag.retriever import try_get_rag_retriever
from app.modules.rag.service import build_item_context
from app.schemas.generate import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(
    request: ChatRequest,
    db: Session = Depends(get_db),
):
    item = db.query(Item).filter(Item.id == request.item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy vật thể.")

    docs = build_item_context(
        item_id=item.id,
        item_name=item.name,
        item_description=item.description,
        group_id=item.group_id,
        retriever=try_get_rag_retriever(),
        top_k=3,
        query=request.message,
    )
    history = [
        {"role": message.role, "content": message.content}
        for message in request.history
    ]

    try:
        content = get_rag_generator().generate_chat(
            message=request.message,
            history=history,
            retrieved_docs=docs,
            persona=request.persona,
            language=request.language,
        )
    except LLMServiceUnavailableError:
        logger.warning("LLM provider unavailable for chat item %s", item.id)
        raise HTTPException(
            status_code=503,
            detail="Dịch vụ AI tạm thời không khả dụng",
        )
    except Exception:
        logger.exception("Chat generation failed for item %s", item.id)
        raise HTTPException(
            status_code=502,
            detail="Không thể sinh nội dung lúc này",
        )

    return ChatResponse(content=limit_words(content))
