from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.item import Item
from app.models.tour import Tour, TourStop
from app.modules.objects.items import item_to_response
from app.schemas.tour import (
    TourCreate,
    TourDetailResponse,
    TourStopInput,
    TourStopResponse,
    TourSummaryResponse,
    TourUpdate,
)


def get_tour_or_404(db: Session, tour_id: int) -> Tour:
    tour = (
        db.query(Tour)
        .options(joinedload(Tour.stops).joinedload(TourStop.item))
        .filter(Tour.id == tour_id)
        .first()
    )
    if not tour:
        raise HTTPException(status_code=404, detail="Không tìm thấy tour")
    return tour


def _validate_stops(db: Session, stops: list[TourStopInput]) -> list[Item]:
    if len(stops) < 2:
        raise HTTPException(status_code=400, detail="Tour cần ít nhất 2 điểm dừng")

    item_ids = [stop.item_id for stop in stops]
    if len(set(item_ids)) != len(item_ids):
        raise HTTPException(status_code=400, detail="Không được chọn trùng hiện vật")

    items = db.query(Item).filter(Item.id.in_(item_ids)).all()
    found = {item.id for item in items}
    missing = [item_id for item_id in item_ids if item_id not in found]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Hiện vật không tồn tại: {', '.join(map(str, missing))}",
        )

    group_ids = {item.group_id for item in items if item.group_id is not None}
    if len(group_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Tất cả hiện vật trong tour phải thuộc cùng một khu di tích",
        )
    if any(item.group_id is None for item in items):
        raise HTTPException(
            status_code=400,
            detail="Hiện vật trong tour phải được gán vào một khu di tích",
        )

    item_map = {item.id: item for item in items}
    return [item_map[item_id] for item_id in item_ids]


def _replace_stops(db: Session, tour: Tour, stops: list[TourStopInput]) -> None:
    tour.stops.clear()
    db.flush()
    for index, stop in enumerate(stops):
        tour.stops.append(
            TourStop(
                item_id=stop.item_id,
                sort_order=index,
                hint_vi=stop.hint_vi.strip(),
                hint_en=stop.hint_en.strip(),
            )
        )


def tour_to_summary(tour: Tour) -> TourSummaryResponse:
    return TourSummaryResponse(
        id=tour.id,
        title_vi=tour.title_vi,
        title_en=tour.title_en,
        description_vi=tour.description_vi,
        description_en=tour.description_en,
        is_published=tour.is_published,
        stop_count=len(tour.stops),
        created_at=tour.created_at,
    )


def tour_to_detail(tour: Tour) -> TourDetailResponse:
    stop_rows: list[TourStopResponse] = []
    for stop in sorted(tour.stops, key=lambda row: row.sort_order):
        item = stop.item
        if not item:
            continue
        payload = item_to_response(item)
        stop_rows.append(
            TourStopResponse(
                item_id=item.id,
                name=item.name,
                description=item.description,
                hint_vi=stop.hint_vi,
                hint_en=stop.hint_en,
                image_url=payload.main_image_url,
                sort_order=stop.sort_order,
            )
        )

    return TourDetailResponse(
        id=tour.id,
        title_vi=tour.title_vi,
        title_en=tour.title_en,
        description_vi=tour.description_vi,
        description_en=tour.description_en,
        is_published=tour.is_published,
        stop_count=len(stop_rows),
        created_at=tour.created_at,
        stops=stop_rows,
    )


def create_tour(db: Session, payload: TourCreate) -> TourDetailResponse:
    title_vi = payload.title_vi.strip()
    title_en = payload.title_en.strip()
    if not title_vi or not title_en:
        raise HTTPException(status_code=400, detail="Tên tour không được để trống")

    _validate_stops(db, payload.stops)
    tour = Tour(
        title_vi=title_vi,
        title_en=title_en,
        description_vi=payload.description_vi.strip(),
        description_en=payload.description_en.strip(),
        is_published=payload.is_published,
    )
    db.add(tour)
    db.flush()
    _replace_stops(db, tour, payload.stops)
    db.commit()
    db.refresh(tour)
    return tour_to_detail(get_tour_or_404(db, tour.id))


def update_tour(db: Session, tour_id: int, payload: TourUpdate) -> TourDetailResponse:
    tour = get_tour_or_404(db, tour_id)
    title_vi = payload.title_vi.strip()
    title_en = payload.title_en.strip()
    if not title_vi or not title_en:
        raise HTTPException(status_code=400, detail="Tên tour không được để trống")

    _validate_stops(db, payload.stops)
    tour.title_vi = title_vi
    tour.title_en = title_en
    tour.description_vi = payload.description_vi.strip()
    tour.description_en = payload.description_en.strip()
    tour.is_published = payload.is_published
    _replace_stops(db, tour, payload.stops)
    db.commit()
    return tour_to_detail(get_tour_or_404(db, tour.id))


def delete_tour(db: Session, tour_id: int) -> None:
    tour = get_tour_or_404(db, tour_id)
    db.delete(tour)
    db.commit()


def list_tours(
    db: Session,
    *,
    published_only: bool,
    group_id: int | None = None,
) -> list[TourSummaryResponse]:
    query = (
        db.query(Tour)
        .options(joinedload(Tour.stops).joinedload(TourStop.item))
        .order_by(Tour.created_at.desc())
    )
    if published_only:
        query = query.filter(Tour.is_published.is_(True))
    tours = query.all()

    summaries: list[TourSummaryResponse] = []
    for tour in tours:
        if len(tour.stops) < 2:
            continue
        if group_id is not None and not all(
            stop.item is not None and stop.item.group_id == group_id
            for stop in tour.stops
        ):
            continue
        summaries.append(tour_to_summary(tour))
    return summaries
