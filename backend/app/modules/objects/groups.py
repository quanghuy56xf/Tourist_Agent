from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.group import Group


def get_group_or_404(db: Session, group_id: int) -> Group:
    group = db.query(Group).filter(Group.id == group_id).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Nhóm không tồn tại")
    return group


def ensure_visitor_can_access_group(group: Group, user) -> None:
    if user is not None and getattr(user, "role", None) == "admin":
        return
    if user is not None and getattr(user, "role", None) == "manager":
        if group.id in getattr(user, "group_ids", ()):
            return
    if not group.is_public:
        raise HTTPException(status_code=404, detail="Khu di tích không khả dụng")


def resolve_group_id(
    db: Session,
    group_id: int | None = None,
    new_group_name: str | None = None,
) -> int | None:
    if new_group_name and new_group_name.strip():
        name = new_group_name.strip()
        group = db.query(Group).filter(Group.name == name).first()
        if group is None:
            group = Group(name=name)
            db.add(group)
            db.commit()
            db.refresh(group)
        return group.id

    if group_id is not None:
        return get_group_or_404(db, group_id).id

    return None
