import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.service import _credentials_configured, authenticate, create_access_token
from app.schemas.auth import LoginRequest, LoginResponse, MeResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    if not _credentials_configured(db):
        logger.error("Login attempted but no credentials are configured on server")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chưa cấu hình tài khoản đăng nhập trên server",
        )

    username = payload.username.strip()
    user = authenticate(db, username, payload.password)
    if not user:
        logger.warning("Failed login attempt for username=%r", username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sai tên đăng nhập hoặc mật khẩu",
        )

    logger.info("Login success username=%r role=%s", user.username, user.role)
    return LoginResponse(
        username=user.username,
        role=user.role,
        token=create_access_token(user),
        group_ids=list(user.group_ids),
    )


@router.get("/me", response_model=MeResponse)
def me(current_user=Depends(get_current_user)):
    return MeResponse(
        username=current_user.username,
        role=current_user.role,
        group_ids=list(current_user.group_ids),
    )
