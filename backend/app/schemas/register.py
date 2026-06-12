from pydantic import BaseModel


class RegisterResponse(BaseModel):
    item_id: int
    message: str
