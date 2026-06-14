from typing import Literal

from pydantic import BaseModel, Field

AdminRole = Literal["admin", "manager"]


class ManagerUserCreate(BaseModel):
    username: str
    password: str
    group_ids: list[int] = Field(default_factory=list)


class ManagerUserUpdate(BaseModel):
    password: str | None = None
    group_ids: list[int] | None = None
    is_active: bool | None = None


class ManagerUserResponse(BaseModel):
    id: int
    username: str
    role: AdminRole
    is_active: bool
    group_ids: list[int]
    group_names: list[str]
    created_at: str