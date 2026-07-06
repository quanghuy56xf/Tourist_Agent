"""HTTP and WebSocket routes for real-time tour match rooms.

The WebSocket endpoint forwards client events to the room manager and centralizes
connection cleanup so players leave consistently on disconnects or errors.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.tour_match.manager import manager
from app.modules.tour_match.schemas import MatchRoomCreate, MatchRoomSummary
from app.modules.tour_match.tour_resolver import resolve_tour_stop_ids

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tour-match", tags=["tour-match"])


@router.get("/rooms", response_model=list[MatchRoomSummary])
def get_waiting_rooms():
    return manager.get_active_rooms()


@router.post("/rooms", status_code=201)
def create_room(payload: MatchRoomCreate, db: Session = Depends(get_db)):
    stop_item_ids = resolve_tour_stop_ids(db, payload.tour_id)
    room_id = manager.create_room(
        name=payload.name,
        description=payload.description or "",
        tour_id=payload.tour_id,
        game_mode=payload.game_mode,
        with_map=payload.with_map,
        stop_item_ids=stop_item_ids,
    )
    return {"room_id": room_id}


@router.get("/rooms/{room_id}")
def get_room_details(room_id: str):
    room = manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng đấu")
    return room.to_dict()


@router.websocket("/ws/{room_id}/{player_id}")
async def tour_match_websocket(
    websocket: WebSocket,
    room_id: str,
    player_id: str,
    nickname: str = Query(..., description="Biệt danh người chơi"),
):
    """Run the live match control loop for one connected player.

    Incoming JSON events are deliberately handled in a single loop to preserve ordering
    for readiness, moderation, progress, and chat updates within a room.
    """
    await websocket.accept()

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
            elif event_type == "report_find":
                item_id = int(data.get("item_id", 0))
                await manager.report_find(room_id, player_id, item_id)
            elif event_type == "update_progress":
                progress = int(data.get("progress", 0))
                total_stops = int(data.get("total_stops", 1))
                await manager.update_progress(room_id, player_id, progress, total_stops)
            elif event_type == "toggle_lock":
                await manager.toggle_lock(room_id, player_id)
            elif event_type == "approve_player":
                target_id = str(data.get("target_id", ""))
                await manager.approve_player(room_id, player_id, target_id)
            elif event_type == "reject_player":
                target_id = str(data.get("target_id", ""))
                await manager.reject_player(room_id, player_id, target_id)
            elif event_type == "kick_player":
                target_id = str(data.get("target_id", ""))
                await manager.kick_player(room_id, player_id, target_id)
            elif event_type == "chat":
                text = str(data.get("text", ""))
                await manager.send_chat(room_id, player_id, text)
            elif event_type == "leave":
                await manager.leave_room_explicit(room_id, player_id)
                await websocket.close()
                break
    except WebSocketDisconnect:
        await manager.handle_disconnect(room_id, player_id)
    except Exception:
        logger.exception("Error in websocket loop for %s", player_id)
        await manager.handle_disconnect(room_id, player_id)
