from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.auth.service import AuthUser, get_user_group_ids


def resolve_allowed_analytics_groups(
    db: Session,
    user: AuthUser | None,
    group_id: int | None,
) -> list[int] | None:
    """Return None for admin viewing all groups, otherwise an explicit allow-list."""
    if user is None:
        return None

    if user.role == "admin":
        if group_id is not None:
            return [group_id]
        return None

    manager_groups = list(get_user_group_ids(db, user))
    if not manager_groups:
        return []

    if group_id is not None:
        if group_id not in manager_groups:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Không có quyền xem thống kê khu di tích này",
            )
        return [group_id]

    return manager_groups
