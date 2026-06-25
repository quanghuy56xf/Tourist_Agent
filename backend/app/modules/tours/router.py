from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import require_admin_if_enabled
from app.modules.auth.service import AuthUser
from app.modules.tours.service import (
    create_tour,
    delete_tour,
    get_tour_or_404,
    list_tours,
    tour_to_detail,
    update_tour,
)
from app.schemas.tour import TourCreate, TourDetailResponse, TourSummaryResponse, TourUpdate

router = APIRouter(prefix="/api/tours", tags=["tours"])


@router.get("", response_model=list[TourSummaryResponse])
def get_tours(
    published_only: bool = Query(default=True),
    group_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return list_tours(db, published_only=published_only, group_id=group_id)


@router.get("/{tour_id}", response_model=TourDetailResponse)
def get_tour(
    tour_id: int,
    published_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    tour = get_tour_or_404(db, tour_id)
    if published_only and not tour.is_published:
        raise HTTPException(status_code=404, detail="Không tìm thấy tour")
    if len(tour.stops) < 2:
        raise HTTPException(status_code=404, detail="Tour chưa đủ điểm dừng")
    return tour_to_detail(tour)


@router.post("", response_model=TourDetailResponse, status_code=201)
def post_tour(
    payload: TourCreate,
    db: Session = Depends(get_db),
    _staff: AuthUser | None = Depends(require_admin_if_enabled),
):
    return create_tour(db, payload)


@router.put("/{tour_id}", response_model=TourDetailResponse)
def put_tour(
    tour_id: int,
    payload: TourUpdate,
    db: Session = Depends(get_db),
    _staff: AuthUser | None = Depends(require_admin_if_enabled),
):
    return update_tour(db, tour_id, payload)


@router.delete("/{tour_id}", status_code=204)
def remove_tour(
    tour_id: int,
    db: Session = Depends(get_db),
    _staff: AuthUser | None = Depends(require_admin_if_enabled),
):
    delete_tour(db, tour_id)
