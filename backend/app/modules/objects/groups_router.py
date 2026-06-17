from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.item import Item
from app.schemas.group import (
    GroupCreate,
    GroupItemsResponse,
    GroupResponse,
    GroupVisibilityUpdate,
)
from app.core.database import get_db
from app.modules.auth.dependencies import require_admin_role_if_enabled, resolve_current_user
from app.modules.auth.service import ensure_group_access
from app.modules.objects.groups import get_group_or_404
from app.modules.objects.items import item_to_response

router = APIRouter(prefix="/api/groups", tags=["groups"])


def _group_rows_query(db: Session):
    return (
        db.query(
            Group.id,
            Group.name,
            Group.created_at,
            Group.is_public,
            func.count(Item.id).label("item_count"),
        )
        .outerjoin(Item, Item.group_id == Group.id)
        .group_by(Group.id)
    )


def _to_group_responses(rows) -> list[GroupResponse]:
    return [
        GroupResponse(
            id=row.id,
            name=row.name,
            item_count=row.item_count,
            is_public=bool(row.is_public),
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get("/public", response_model=list[GroupResponse])
def list_public_groups(db: Session = Depends(get_db)):
    rows = (
        _group_rows_query(db)
        .filter(Group.is_public.is_(True))
        .order_by(Group.name.asc())
        .all()
    )
    return _to_group_responses(rows)


@router.get("/discover", response_model=list[GroupResponse])
def list_discoverable_groups(db: Session = Depends(get_db)):
    rows = _group_rows_query(db).order_by(Group.name.asc()).all()
    return _to_group_responses(rows)


@router.get("", response_model=list[GroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    query = _group_rows_query(db)
    if user and user.role == "admin":
        pass
    elif user and user.role == "manager":
        if not user.group_ids:
            return []
        query = query.filter(Group.id.in_(user.group_ids))
    else:
        query = query.filter(Group.is_public.is_(True))

    rows = query.order_by(Group.name.asc()).all()
    return _to_group_responses(rows)


@router.post("", response_model=GroupResponse, status_code=201)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_admin_role_if_enabled),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Tên khu di tích không được để trống")

    existing = db.query(Group).filter(Group.name == name).first()
    if existing:
        count = db.query(Item).filter(Item.group_id == existing.id).count()
        return GroupResponse(
            id=existing.id,
            name=existing.name,
            item_count=count,
            is_public=existing.is_public,
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
        is_public=group.is_public,
        created_at=group.created_at,
    )


@router.patch("/{group_id}/visibility", response_model=GroupResponse)
def update_group_visibility(
    group_id: int,
    payload: GroupVisibilityUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_admin_role_if_enabled),
):
    group = get_group_or_404(db, group_id)
    group.is_public = payload.is_public
    db.commit()
    db.refresh(group)
    item_count = db.query(Item).filter(Item.group_id == group.id).count()
    return GroupResponse(
        id=group.id,
        name=group.name,
        item_count=item_count,
        is_public=group.is_public,
        created_at=group.created_at,
    )


@router.get("/{group_id}/items", response_model=GroupItemsResponse)
def list_group_items(
    group_id: int,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    group = get_group_or_404(db, group_id)
    if user and user.role == "manager":
        ensure_group_access(user, group_id)
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
