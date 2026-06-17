from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query
from typing import List, Dict, Any
from app.modules.tour_match.schemas import MatchRoomCreate, MatchRoomSummary
from app.modules.tour_match.manager import manager

router = APIRouter(prefix="/api/tour-match", tags=["tour-match"])

@router.get("/rooms", response_model=List[MatchRoomSummary])
def get_waiting_rooms():
    """Lấy danh sách các phòng thi đấu đang ở trạng thái chờ (waiting)."""
    return manager.get_active_rooms()

@router.post("/rooms", status_code=201)
def create_room(payload: MatchRoomCreate):
    """Tạo phòng đấu mới và trả về mã phòng (room_id)."""
    room_id = manager.create_room(
        name=payload.name,
        description=payload.description or "",
        tour_id=payload.tour_id
    )
    return {"room_id": room_id}

@router.get("/rooms/{room_id}")
def get_room_details(room_id: str):
    """Lấy chi tiết trạng thái phòng đấu hiện tại."""
    room = manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng đấu")
    return room.to_dict()

@router.websocket("/ws/{room_id}/{player_id}")
async def tour_match_websocket(
    websocket: WebSocket,
    room_id: str,
    player_id: str,
    nickname: str = Query(..., description="Biệt danh người chơi")
):
    """Kết nối WebSocket thời gian thực cho phòng thi đấu."""
    await websocket.accept()
    
    # Thử tham gia phòng
    success = await manager.join_room(room_id, player_id, nickname, websocket)
    if not success:
        await websocket.close(code=4003, reason="Phòng không tồn tại hoặc trận đấu đã bắt đầu")
        return

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            
            if event_type == "toggle_ready":
                await manager.toggle_ready(room_id, player_id)
                
            elif event_type == "start_match":
                await manager.start_match(room_id, player_id)
                
            elif event_type == "update_progress":
                progress = data.get("progress", 0)
                total_stops = data.get("total_stops", 1)
                await manager.update_progress(room_id, player_id, progress, total_stops)
                
            elif event_type == "toggle_lock":
                await manager.toggle_lock(room_id, player_id)

            elif event_type == "approve_player":
                target_id = data.get("target_id", "")
                await manager.approve_player(room_id, player_id, target_id)

            elif event_type == "reject_player":
                target_id = data.get("target_id", "")
                await manager.reject_player(room_id, player_id, target_id)

            elif event_type == "kick_player":
                target_id = data.get("target_id", "")
                await manager.kick_player(room_id, player_id, target_id)

            elif event_type == "leave":
                await manager.leave_room_explicit(room_id, player_id)
                await websocket.close()
                break
                
    except WebSocketDisconnect:
        await manager.handle_disconnect(room_id, player_id)
    except Exception as e:
        # Ghi log lỗi và ngắt kết nối an toàn
        import logging
        logging.getLogger(__name__).exception(f"Error in websocket loop for {player_id}: {e}")
        await manager.handle_disconnect(room_id, player_id)
