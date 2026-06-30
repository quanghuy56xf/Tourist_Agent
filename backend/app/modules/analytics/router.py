import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth import dependencies as auth_dependencies
from app.modules.analytics.access import resolve_allowed_analytics_groups
from app.modules.analytics.chat_logs import (
    build_cost_summary,
    export_chat_conversations_csv,
    export_chat_logs_csv,
    get_pricing_config,
    query_chat_conversations,
    query_chat_logs,
    update_pricing_config,
)
from app.modules.analytics.service import (
    ALLOWED_CLIENT_EVENT_TYPES,
    build_summary,
    get_client_ip,
    record_event,
)
from app.modules.auth.dependencies import resolve_current_user
from app.modules.auth.service import AuthUser
from app.schemas.analytics import (
    AnalyticsEventsRequest,
    AnalyticsSummaryResponse,
    ChatConversationsResponse,
    ChatCostSummaryResponse,
    ChatLogListResponse,
    LlmPricingConfigResponse,
    LlmPricingConfigUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _require_analytics_user(user: AuthUser | None) -> AuthUser | None:
    if auth_dependencies.ADMIN_AUTH_ENABLED and user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa đăng nhập hoặc phiên đã hết hạn",
        )
    return user


@router.post("/events", status_code=204)
def ingest_events(
    payload: AnalyticsEventsRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    for event in payload.events:
        if event.event_type not in ALLOWED_CLIENT_EVENT_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Loại sự kiện không hợp lệ: {event.event_type}",
            )
        try:
            record_event(
                db,
                event_type=event.event_type,
                group_id=event.group_id,
                item_id=event.item_id,
                session_id=event.session_id,
                search_session_id=event.search_session_id,
                client_ip=client_ip,
                metadata=event.metadata,
            )
        except Exception:
            logger.exception("Failed to record analytics event %s", event.event_type)
            raise HTTPException(status_code=500, detail="Không ghi được sự kiện thống kê")


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def analytics_summary(
    days: int = Query(default=30, ge=1, le=365),
    group_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(resolve_current_user),
):
    _require_analytics_user(user)
    allowed_group_ids = resolve_allowed_analytics_groups(db, user, group_id)
    return build_summary(db, days=days, allowed_group_ids=allowed_group_ids)


@router.get("/llm-pricing", response_model=LlmPricingConfigResponse)
def read_llm_pricing(
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(resolve_current_user),
):
    _require_analytics_user(user)
    return get_pricing_config(db)


@router.put("/llm-pricing", response_model=LlmPricingConfigResponse)
def save_llm_pricing(
    payload: LlmPricingConfigUpdate,
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(resolve_current_user),
):
    _require_analytics_user(user)
    return update_pricing_config(
        db,
        payload,
        updated_by=user.username if user else None,
    )


@router.get("/chat-logs", response_model=ChatLogListResponse)
def list_chat_logs(
    days: int = Query(default=30, ge=1, le=365),
    group_id: int | None = Query(default=None),
    item_id: int | None = Query(default=None),
    conversation_id: str | None = Query(default=None),
    turn_code: str | None = Query(default=None),
    status: str = Query(default="all", pattern="^(all|success|error)$"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(resolve_current_user),
):
    _require_analytics_user(user)
    allowed_group_ids = resolve_allowed_analytics_groups(db, user, group_id)
    return query_chat_logs(
        db,
        days=days,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        turn_code=turn_code,
        status=status,
        page=page,
        limit=limit,
    )


@router.get("/chat-conversations", response_model=ChatConversationsResponse)
def list_chat_conversations(
    days: int = Query(default=30, ge=1, le=365),
    group_id: int | None = Query(default=None),
    item_id: int | None = Query(default=None),
    conversation_id: str | None = Query(default=None),
    status: str = Query(default="all", pattern="^(all|success|error)$"),
    min_questions: int | None = Query(default=None, ge=1),
    max_questions: int | None = Query(default=None, ge=1),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(resolve_current_user),
):
    _require_analytics_user(user)
    allowed_group_ids = resolve_allowed_analytics_groups(db, user, group_id)
    return query_chat_conversations(
        db,
        days=days,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        status=status,
        min_questions=min_questions,
        max_questions=max_questions,
        page=page,
        limit=limit,
    )


@router.get("/chat-cost/summary", response_model=ChatCostSummaryResponse)
def chat_cost_summary(
    days: int = Query(default=30, ge=1, le=365),
    group_id: int | None = Query(default=None),
    item_id: int | None = Query(default=None),
    status: str = Query(default="all", pattern="^(all|success|error)$"),
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(resolve_current_user),
):
    _require_analytics_user(user)
    allowed_group_ids = resolve_allowed_analytics_groups(db, user, group_id)
    return build_cost_summary(
        db,
        days=days,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        status=status,
    )


@router.get("/chat-logs/export.csv")
def export_chat_logs_csv_endpoint(
    days: int = Query(default=30, ge=1, le=365),
    group_id: int | None = Query(default=None),
    item_id: int | None = Query(default=None),
    conversation_id: str | None = Query(default=None),
    turn_code: str | None = Query(default=None),
    status: str = Query(default="all", pattern="^(all|success|error)$"),
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(resolve_current_user),
):
    _require_analytics_user(user)
    allowed_group_ids = resolve_allowed_analytics_groups(db, user, group_id)
    csv_content = export_chat_logs_csv(
        db,
        days=days,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        turn_code=turn_code,
        status=status,
    )
    stamp = datetime.utcnow().strftime("%Y%m%d")
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="chat-turns-{stamp}.csv"'
        },
    )


@router.get("/chat-conversations/export.csv")
def export_chat_conversations_csv_endpoint(
    days: int = Query(default=30, ge=1, le=365),
    group_id: int | None = Query(default=None),
    item_id: int | None = Query(default=None),
    conversation_id: str | None = Query(default=None),
    status: str = Query(default="all", pattern="^(all|success|error)$"),
    min_questions: int | None = Query(default=None, ge=1),
    max_questions: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    user: AuthUser | None = Depends(resolve_current_user),
):
    _require_analytics_user(user)
    allowed_group_ids = resolve_allowed_analytics_groups(db, user, group_id)
    csv_content = export_chat_conversations_csv(
        db,
        days=days,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        status=status,
        min_questions=min_questions,
        max_questions=max_questions,
    )
    stamp = datetime.utcnow().strftime("%Y%m%d")
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="chat-conversations-{stamp}.csv"'
        },
    )
