from typing import Literal

from pydantic import BaseModel


class RegisterResponse(BaseModel):
    item_id: int
    message: str


class BulkRegisterResponse(BaseModel):
    status: Literal["success", "skipped"]
    item_id: int | None = None
    message: str
