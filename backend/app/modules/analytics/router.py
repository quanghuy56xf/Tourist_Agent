import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import ADMIN_AUTH_ENABLED
from app.core.database import get_db
from app.modules.analytics.access import resolve_allowed_analytics_groups
from app.modules.analytics.service import (
    ALLOWED_CLIENT_EVENT_TYPES,
    build_summary,
    get_client_ip,
    record_event,
)
from app.modules.auth.dependencies import resolve_current_user
from app.modules.auth.service import AuthUser
from app.schemas.analytics import AnalyticsEventsRequest, AnalyticsSummaryResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


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
    if ADMIN_AUTH_ENABLED and user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa đăng nhập hoặc phiên đã hết hạn",
        )

    allowed_group_ids = resolve_allowed_analytics_groups(db, user, group_id)
    return build_summary(db, days=days, allowed_group_ids=allowed_group_ids)
