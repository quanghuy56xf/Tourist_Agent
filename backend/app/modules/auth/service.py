import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.core.config import (
    ADMIN_PASSWORD,
    ADMIN_USERNAME,
    AUTH_TOKEN_SECRET,
    AUTH_TOKEN_TTL_SECONDS,
    MANAGER_PASSWORD,
    MANAGER_USERNAME,
)
from app.models.user import User
from app.modules.auth.passwords import verify_password

AdminRole = Literal["admin", "manager"]


@dataclass(frozen=True)
class AuthUser:
    username: str
    role: AdminRole
    user_id: int | None = None
    group_ids: tuple[int, ...] = ()


def _user_from_db(user: User) -> AuthUser:
    group_ids: tuple[int, ...] = ()
    if user.role == "manager":
        group_ids = tuple(sorted(group.id for group in user.groups))
    return AuthUser(
        username=user.username,
        role=user.role,  # type: ignore[arg-type]
        user_id=user.id,
        group_ids=group_ids,
    )


def _credentials_configured(db: Session | None = None) -> bool:
    if db is not None and db.query(User).filter(User.is_active.is_(True)).first() is not None:
        return True
    admin_ok = bool(ADMIN_USERNAME and ADMIN_PASSWORD)
    manager_ok = bool(MANAGER_USERNAME and MANAGER_PASSWORD)
    return admin_ok or manager_ok


def authenticate(db: Session, username: str, password: str) -> AuthUser | None:
    if not username or not password:
        return None

    db_user = (
        db.query(User)
        .filter(User.username == username, User.is_active.is_(True))
        .first()
    )
    if db_user and verify_password(password, db_user.password_hash):
        return _user_from_db(db_user)

    if ADMIN_USERNAME and ADMIN_PASSWORD:
        if secrets.compare_digest(username, ADMIN_USERNAME) and secrets.compare_digest(
            password, ADMIN_PASSWORD
        ):
            return AuthUser(username=ADMIN_USERNAME, role="admin")

    if MANAGER_USERNAME and MANAGER_PASSWORD:
        if secrets.compare_digest(username, MANAGER_USERNAME) and secrets.compare_digest(
            password, MANAGER_PASSWORD
        ):
            return AuthUser(username=MANAGER_USERNAME, role="manager")

    return None


def create_access_token(user: AuthUser) -> str:
    payload = {
        "sub": user.username,
        "role": user.role,
        "exp": int(time.time()) + AUTH_TOKEN_TTL_SECONDS,
    }
    if user.user_id is not None:
        payload["uid"] = user.user_id
    if user.group_ids:
        payload["gids"] = list(user.group_ids)
    data = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode()
    signature = hmac.new(
        AUTH_TOKEN_SECRET.encode(),
        data.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{data}.{signature}"


def verify_access_token(token: str) -> AuthUser | None:
    if not token or "." not in token:
        return None

    data, signature = token.rsplit(".", 1)
    expected = hmac.new(
        AUTH_TOKEN_SECRET.encode(),
        data.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not secrets.compare_digest(signature, expected):
        return None

    try:
        payload = json.loads(base64.urlsafe_b64decode(data.encode()).decode())
    except (json.JSONDecodeError, ValueError):
        return None

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        return None

    username = payload.get("sub")
    role = payload.get("role")
    if role not in ("admin", "manager") or not isinstance(username, str) or not username:
        return None

    user_id = payload.get("uid")
    group_ids_raw = payload.get("gids", [])
    group_ids: tuple[int, ...] = ()
    if isinstance(group_ids_raw, list):
        group_ids = tuple(int(g) for g in group_ids_raw if isinstance(g, int))

    return AuthUser(
        username=username,
        role=role,
        user_id=user_id if isinstance(user_id, int) else None,
        group_ids=group_ids,
    )


def ensure_group_access(user: AuthUser | None, group_id: int | None) -> None:
    from fastapi import HTTPException, status

    if user is None or user.role == "admin":
        return
    if group_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện thao tác này",
        )
    if group_id not in user.group_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền quản lý khu di tích này",
        )
