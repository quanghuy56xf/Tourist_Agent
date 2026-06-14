import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.group import Group
from app.models.user import User
from app.modules.auth.dependencies import require_admin_role_if_enabled
from app.modules.auth.passwords import hash_password
from app.schemas.user import (
    ManagerUserCreate,
    ManagerUserResponse,
    ManagerUserUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


def _to_response(user: User) -> ManagerUserResponse:
    groups = sorted(user.groups, key=lambda group: group.name)
    created_at = (
        user.created_at.isoformat()
        if isinstance(user.created_at, datetime)
        else str(user.created_at)
    )
    return ManagerUserResponse(
        id=user.id,
        username=user.username,
        role="manager",
        is_active=user.is_active,
        group_ids=[group.id for group in groups],
        group_names=[group.name for group in groups],
        created_at=created_at,
    )


def _resolve_groups(db: Session, group_ids: list[int]) -> list[Group]:
    if not group_ids:
        return []
    groups = db.query(Group).filter(Group.id.in_(group_ids)).all()
    found_ids = {group.id for group in groups}
    missing = [group_id for group_id in group_ids if group_id not in found_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Khu di tích không tồn tại: {', '.join(str(group_id) for group_id in missing)}",
        )
    return groups


@router.get("", response_model=list[ManagerUserResponse])
def list_manager_users(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_role_if_enabled),
):
    users = (
        db.query(User)
        .filter(User.role == "manager")
        .order_by(User.username.asc())
        .all()
    )
    return [_to_response(user) for user in users]


@router.post("", response_model=ManagerUserResponse, status_code=201)
def create_manager_user(
    payload: ManagerUserCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_role_if_enabled),
):
    username = payload.username.strip()
    password = payload.password
    if not username:
        raise HTTPException(status_code=400, detail="Tên đăng nhập không được để trống")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại")

    groups = _resolve_groups(db, payload.group_ids)
    user = User(
        username=username,
        password_hash=hash_password(password),
        role="manager",
        is_active=True,
    )
    user.groups = groups
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(
        "Created manager user=%r with groups=%s", username, [group.id for group in groups]
    )
    return _to_response(user)


@router.put("/{user_id}", response_model=ManagerUserResponse)
def update_manager_user(
    user_id: int,
    payload: ManagerUserUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_role_if_enabled),
):
    user = db.query(User).filter(User.id == user_id, User.role == "manager").first()
    if user is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản quản lý")

    if payload.password is not None:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Mật khẩu phải có ít nhất 6 ký tự")
        user.password_hash = hash_password(payload.password)

    if payload.group_ids is not None:
        user.groups = _resolve_groups(db, payload.group_ids)

    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    logger.info("Updated manager user_id=%s username=%r", user_id, user.username)
    return _to_response(user)


@router.delete("/{user_id}", status_code=204)
def delete_manager_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin_role_if_enabled),
):
    user = db.query(User).filter(User.id == user_id, User.role == "manager").first()
    if user is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản quản lý")
    username = user.username
    db.delete(user)
    db.commit()
    logger.info("Deleted manager user_id=%s username=%r", user_id, username)