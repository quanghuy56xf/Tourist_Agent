import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBasic,
    HTTPBasicCredentials,
    HTTPBearer,
)
from sqlalchemy.orm import Session

from app.core.config import (
    ADMIN_AUTH_ENABLED,
    ADMIN_PASSWORD,
    ADMIN_USERNAME,
)
from app.core.database import get_db
from app.modules.auth.service import AuthUser, authenticate, verify_access_token

optional_security = HTTPBasic(auto_error=False)
bearer_security = HTTPBearer(auto_error=False)


def _user_from_basic(credentials: HTTPBasicCredentials, db: Session) -> AuthUser | None:
    user = authenticate(db, credentials.username, credentials.password)
    if user:
        return user
    if ADMIN_USERNAME and ADMIN_PASSWORD:
        username_correct = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
        password_correct = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
        if username_correct and password_correct:
            return AuthUser(username=ADMIN_USERNAME, role="admin")
    return None


def resolve_current_user(
    credentials: HTTPBasicCredentials | None = Depends(optional_security),
    bearer: HTTPAuthorizationCredentials | None = Depends(bearer_security),
    db: Session = Depends(get_db),
) -> AuthUser | None:
    if bearer and bearer.credentials:
        user = verify_access_token(bearer.credentials)
        if user:
            return user

    if credentials:
        return _user_from_basic(credentials, db)

    return None


def get_current_user(
    user: AuthUser | None = Depends(resolve_current_user),
) -> AuthUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa đăng nhập hoặc phiên đã hết hạn",
        )
    return user


def require_staff_if_enabled(
    user: AuthUser | None = Depends(resolve_current_user),
) -> AuthUser | None:
    if not ADMIN_AUTH_ENABLED:
        return None

    if not ADMIN_USERNAME and not ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured",
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin_role(
    user: AuthUser | None = Depends(resolve_current_user),
) -> AuthUser:
    """Always require an authenticated admin, even when ADMIN_AUTH_ENABLED is false."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa đăng nhập hoặc phiên đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản admin mới được thực hiện thao tác này",
        )
    return user


def require_admin_role_if_enabled(
    user: AuthUser | None = Depends(require_staff_if_enabled),
) -> AuthUser | None:
    if not ADMIN_AUTH_ENABLED:
        return None

    if user is None or user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ tài khoản admin mới được thực hiện thao tác này",
        )
    return user


def require_admin_if_enabled(
    user: AuthUser | None = Depends(require_staff_if_enabled),
) -> AuthUser | None:
    if not ADMIN_AUTH_ENABLED:
        return None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
