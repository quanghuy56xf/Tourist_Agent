import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core.config import (
    ADMIN_AUTH_ENABLED,
    ADMIN_PASSWORD,
    ADMIN_USERNAME,
)

optional_security = HTTPBasic(auto_error=False)


def require_admin_if_enabled(
    credentials: HTTPBasicCredentials | None = Depends(optional_security),
) -> str | None:
    if not ADMIN_AUTH_ENABLED:
        return None

    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured",
        )

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )

    username_correct = secrets.compare_digest(
        credentials.username,
        ADMIN_USERNAME,
    )
    password_correct = secrets.compare_digest(
        credentials.password,
        ADMIN_PASSWORD,
    )
    if not (username_correct and password_correct):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username
