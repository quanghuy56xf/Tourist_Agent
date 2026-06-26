from typing import Literal

from pydantic import BaseModel, Field

GameMode = Literal["sequential", "sequential_random", "free"]


class MatchRoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Tên phòng đấu")
    description: str = Field("", description="Mô tả ngắn về phòng")
    tour_id: str = Field(..., description="Mã tour được chọn để thi đấu")
    game_mode: GameMode = Field(
        "sequential",
        description="sequential | sequential_random | free",
    )
    with_map: bool = Field(False, description="Bật bản đồ gợi ý trong trận")


class MatchRoomSummary(BaseModel):
    room_id: str
    name: str
    description: str
    tour_id: str
    game_mode: str
    with_map: bool
    player_count: int
    status: str
