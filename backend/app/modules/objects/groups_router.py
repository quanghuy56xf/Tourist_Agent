from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.item import Item
from app.models.content_variant import ItemContentVariant
from app.modules.content.service import compute_content_hash
from app.modules.content.bulk_update import regenerate_items_task
from app.schemas.group import (
    GroupCreate,
    GroupItemsResponse,
    GroupResponse,
    GroupVisibilityUpdate,
    GroupSyncStatusResponse,
)
from app.core.database import get_db
from app.modules.content.personas import DEFAULT_PERSONA, DEFAULT_LANGUAGE
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
    rows = (
        _group_rows_query(db)
        .filter(Group.is_public.is_(True))
        .order_by(Group.name.asc())
        .all()
    )
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


@router.get("/{group_id}/sync-status", response_model=GroupSyncStatusResponse)
def get_group_sync_status(
    group_id: int,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    group = get_group_or_404(db, group_id)
    if user and user.role == "manager":
        ensure_group_access(user, group_id)

    items = db.query(Item).filter(Item.group_id == group_id).all()
    if not items:
        return GroupSyncStatusResponse(total_items=0, synced_items=0, is_fully_synced=True)

    item_ids = [item.id for item in items]
    variants = (
        db.query(ItemContentVariant)
        .filter(
            ItemContentVariant.item_id.in_(item_ids),
            ItemContentVariant.persona == DEFAULT_PERSONA,
            ItemContentVariant.language == DEFAULT_LANGUAGE,
        )
        .all()
    )

    variant_map = {v.item_id: v for v in variants}
    synced_count = 0

    for item in items:
        v = variant_map.get(item.id)
        if not v:
            continue
        expected_hash = compute_content_hash(item.description, group_knowledge_version=group.knowledge_version, source=v.source)
        if v.content_hash == expected_hash and v.status == "ready" and v.audio_data is not None:
            synced_count += 1

    return GroupSyncStatusResponse(
        total_items=len(items),
        synced_items=synced_count,
        is_fully_synced=synced_count == len(items),
    )


@router.post("/{group_id}/sync", status_code=202)
def force_sync_group(
    group_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    group = get_group_or_404(db, group_id)
    if user and user.role == "manager":
        ensure_group_access(user, group_id)

    items = db.query(Item.id).filter(Item.group_id == group.id).all()
    target_item_ids = [row[0] for row in items]
    if target_item_ids:
        background_tasks.add_task(regenerate_items_task, target_item_ids)

    return {"message": f"Queued {len(target_item_ids)} items for sync"}

