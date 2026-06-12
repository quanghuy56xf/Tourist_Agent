from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.item import Item
from app.schemas.group import (
    GroupCreate,
    GroupItemsResponse,
    GroupResponse,
)
from app.services.database import get_db
from app.services.groups import get_group_or_404
from app.services.items import item_to_response

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("", response_model=list[GroupResponse])
def list_groups(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Group.id,
            Group.name,
            Group.created_at,
            func.count(Item.id).label("item_count"),
        )
        .outerjoin(Item, Item.group_id == Group.id)
        .group_by(Group.id)
        .order_by(Group.name.asc())
        .all()
    )
    return [
        GroupResponse(
            id=row.id,
            name=row.name,
            item_count=row.item_count,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post("", response_model=GroupResponse, status_code=201)
def create_group(payload: GroupCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên nhóm không được để trống")

    existing = db.query(Group).filter(Group.name == name).first()
    if existing:
        count = db.query(Item).filter(Item.group_id == existing.id).count()
        return GroupResponse(
            id=existing.id,
            name=existing.name,
            item_count=count,
            created_at=existing.created_at,
        )

    group = Group(name=name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return GroupResponse(
        id=group.id,
        name=group.name,
        item_count=0,
        created_at=group.created_at,
    )


@router.get("/{group_id}/items", response_model=GroupItemsResponse)
def list_group_items(group_id: int, db: Session = Depends(get_db)):
    group = get_group_or_404(db, group_id)
    items = (
        db.query(Item)
        .filter(Item.group_id == group_id)
        .order_by(Item.created_at.desc())
        .all()
    )

    return GroupItemsResponse(
        group_id=group.id,
        group_name=group.name,
        items=[item_to_response(item) for item in items],
    )
