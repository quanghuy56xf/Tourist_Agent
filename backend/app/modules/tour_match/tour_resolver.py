"""Resolve frontend tour_id strings to ordered item id lists."""

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.item import Item
from app.models.tour import Tour, TourStop


def resolve_tour_stop_ids(db: Session, tour_id: str) -> list[int]:
    if tour_id.startswith("tour-"):
        numeric_id = int(tour_id[5:])
        tour = (
            db.query(Tour)
            .options(joinedload(Tour.stops))
            .filter(Tour.id == numeric_id)
            .first()
        )
        if not tour or len(tour.stops) < 2:
            raise HTTPException(
                status_code=400,
                detail="Tour thi đấu cần ít nhất 2 điểm dừng",
            )
        ordered = sorted(tour.stops, key=lambda stop: stop.sort_order)
        return [stop.item_id for stop in ordered]

    if tour_id.startswith("group-"):
        group_id = int(tour_id[6:])
        items = (
            db.query(Item.id)
            .filter(Item.group_id == group_id)
            .order_by(Item.id.asc())
            .all()
        )
        item_ids = [row.id for row in items]
        if len(item_ids) < 2:
            raise HTTPException(
                status_code=400,
                detail="Tour thi đấu cần ít nhất 2 hiện vật trong khu",
            )
        return item_ids

    raise HTTPException(status_code=400, detail="Tour thi đấu không hợp lệ")
