from typing import Literal

from pydantic import BaseModel, Field

AdminRole = Literal["admin", "manager"]


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    role: AdminRole
    token: str
    group_ids: list[int] = Field(default_factory=list)


class MeResponse(BaseModel):
    username: str
    role: AdminRole
    group_ids: list[int] = Field(default_factory=list)
