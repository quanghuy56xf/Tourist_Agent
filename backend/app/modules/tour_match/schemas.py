from pydantic import BaseModel, Field
from typing import Optional

class MatchRoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tên phòng đấu")
    description: Optional[str] = Field("", description="Mô tả ngắn về phòng")
    tour_id: str = Field(..., description="Mã tour được chọn để thi đấu")

class MatchRoomSummary(BaseModel):
    room_id: str
    name: str
    description: str
    tour_id: str
    player_count: int
    status: str
