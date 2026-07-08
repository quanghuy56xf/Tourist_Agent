from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.item import Item
from app.models.content_variant import ItemContentVariant
from app.modules.content.service import compute_content_hash
from app.modules.content.bulk_update import regenerate_items_task
from app.schemas.content import GroupContentSyncStatusResponse, SyncMissingContentResponse
from app.schemas.group import (
    GroupCreate,
    GroupItemsResponse,
    GroupResponse,
    MinimapConfigPayload,
    MinimapVisitorConfig,
    MinimapVisitorZone,
    GroupVisibilityUpdate,
    GroupSyncStatusResponse,
)
from app.core.database import get_db
from app.modules.content.personas import all_variants
from app.modules.auth.dependencies import (
    require_admin_if_enabled,
    require_admin_role_if_enabled,
    resolve_current_user,
)
from app.modules.auth.service import ensure_group_access
from app.modules.content.sync_status import (
    evaluate_group_content_status,
    find_items_needing_regeneration,
    sync_missing_items_task,
)
from app.modules.objects.groups import ensure_visitor_can_access_group, get_group_or_404
from app.modules.objects.items import item_to_response

router = APIRouter(prefix="/api/groups", tags=["groups"])

DEFAULT_MINIMAP_TEMPLATE = {
    "imageSrc": "/images/van-mieu-minimap.png",
    "zones": [
        {
            "zoneId": "cong-chinh",
            "zoneName": "Cổng chính",
            "x": 50,
            "y": 94,
            "itemNames": ["Cổng chính"],
        }
    ],
}


def _normalize_minimap_name(name: str) -> str:
    return name.strip().casefold()


def _resolve_minimap_item_ids(
    item_names: list[str],
    ids_by_exact: dict[str, list[int]],
    items: list,
) -> list[int]:
    resolved: list[int] = []
    seen: set[int] = set()
    normalized_index: dict[str, list[int]] = {}
    for item in items:
        normalized_index.setdefault(_normalize_minimap_name(item.name), []).append(item.id)

    def add_ids(item_ids: list[int]) -> None:
        for item_id in item_ids:
            if item_id not in seen:
                seen.add(item_id)
                resolved.append(item_id)

    for item_name in item_names:
        if item_name in ids_by_exact:
            add_ids(ids_by_exact[item_name])
            continue

        normalized = _normalize_minimap_name(item_name)
        if normalized in normalized_index:
            add_ids(normalized_index[normalized])
            continue

        for db_name, db_ids in normalized_index.items():
            if normalized in db_name or db_name in normalized:
                add_ids(db_ids)
                break

    return resolved


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


@router.get("/{group_id}/minimap", response_model=MinimapVisitorConfig)
def get_group_minimap(
    group_id: int,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    group = get_group_or_404(db, group_id)
    ensure_visitor_can_access_group(group, user)
    if group.minimap_config is None:
        raise HTTPException(status_code=404, detail="Bản đồ chưa được cấu hình")

    items = (
        db.query(Item.id, Item.name)
        .filter(Item.group_id == group_id)
        .order_by(Item.id.asc())
        .all()
    )
    ids_by_name: dict[str, list[int]] = {}
    for item in items:
        ids_by_name.setdefault(item.name, []).append(item.id)

    payload = MinimapConfigPayload.model_validate(group.minimap_config)
    return MinimapVisitorConfig(
        imageSrc=payload.imageSrc,
        zones=[
            MinimapVisitorZone(
                zoneId=zone.zoneId,
                zoneName=zone.zoneName,
                x=zone.x,
                y=zone.y,
                itemIds=_resolve_minimap_item_ids(zone.itemNames, ids_by_name, items),
            )
            for zone in payload.zones
        ],
    )


@router.put("/{group_id}/minimap", response_model=MinimapConfigPayload)
def update_group_minimap(
    group_id: int,
    payload: MinimapConfigPayload,
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    group = get_group_or_404(db, group_id)
    ensure_group_access(staff, group_id)
    group.minimap_config = payload.model_dump(mode="json")
    db.commit()
    db.refresh(group)
    return MinimapConfigPayload.model_validate(group.minimap_config)


@router.get("/{group_id}/minimap/template", response_model=MinimapConfigPayload)
def get_group_minimap_template(
    group_id: int,
    db: Session = Depends(get_db),
    staff=Depends(require_admin_if_enabled),
):
    group = get_group_or_404(db, group_id)
    ensure_group_access(staff, group_id)
    return MinimapConfigPayload.model_validate(
        group.minimap_config or DEFAULT_MINIMAP_TEMPLATE
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

    if not items:
        return GroupItemsResponse(
            group_id=group.id,
            group_name=group.name,
            items=[],
        )

    item_ids = [item.id for item in items]
    variants = (
        db.query(ItemContentVariant)
        .filter(ItemContentVariant.item_id.in_(item_ids))
        .all()
    )
    
    variants_by_item: dict[int, list[ItemContentVariant]] = {}
    for variant in variants:
        variants_by_item.setdefault(variant.item_id, []).append(variant)

    from app.modules.content.sync_status import evaluate_item_content_status

    response_items = []
    for item in items:
        status_dict = evaluate_item_content_status(
            item,
            variants_by_item.get(item.id, []),
            group_knowledge_version=group.knowledge_version,
        )
        response_items.append(item_to_response(item, sync_state=status_dict["state"]))

    return GroupItemsResponse(
        group_id=group.id,
        group_name=group.name,
        items=response_items,
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

    from app.modules.content.sync_status import evaluate_group_content_status
    
    status_dict = evaluate_group_content_status(db, group.id)
    synced_count = status_dict["summary"]["synced"]
    total_count = status_dict["summary"]["total"]
    
    return GroupSyncStatusResponse(
        total_items=total_count,
        synced_items=synced_count,
        is_fully_synced=synced_count == total_count,
    )


@router.get("/{group_id}/content/sync-status", response_model=GroupContentSyncStatusResponse)
def get_group_content_sync_status(
    group_id: int,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    group = get_group_or_404(db, group_id)
    if user and user.role == "manager":
        ensure_group_access(user, group_id)
    return GroupContentSyncStatusResponse(**evaluate_group_content_status(db, group.id))


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


@router.post("/{group_id}/content/sync-missing", status_code=202, response_model=SyncMissingContentResponse)
def sync_missing_group_content(
    group_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(resolve_current_user),
):
    group = get_group_or_404(db, group_id)
    if user and user.role == "manager":
        ensure_group_access(user, group_id)

    item_ids = find_items_needing_regeneration(db, group.id)
    if not item_ids:
        return SyncMissingContentResponse(
            queued_count=0,
            queued_item_ids=[],
            message="Tất cả hiện vật đã có đủ mô tả và audio.",
        )

    background_tasks.add_task(sync_missing_items_task, group.id, item_ids)
    return SyncMissingContentResponse(
        queued_count=len(item_ids),
        queued_item_ids=item_ids,
        message=f"Đã xếp hàng cập nhật {len(item_ids)} hiện vật.",
    )
