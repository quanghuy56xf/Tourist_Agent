import asyncio
import logging
import random
import string
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)

FINISHED_ROOM_TTL_SECONDS = 30 * 60
WAITING_ROOM_CLEANUP_SECONDS = 15
PLAYING_ROOM_CLEANUP_SECONDS = 15


def _shuffle_item_ids(item_ids: list[int]) -> list[int]:
    order = list(item_ids)
    random.shuffle(order)
    return order


class PlayerState:
    def __init__(self, player_id: str, nickname: str, is_host: bool = False):
        self.player_id: str = player_id
        self.nickname: str = nickname
        self.is_ready: bool = is_host
        self.is_host: bool = is_host
        self.joined_at: datetime = datetime.now()
        self.progress: int = 0
        self.stop_order: list[int] = []
        self.found_item_ids: list[int] = []
        self.completed_at: Optional[datetime] = None
        self.websocket: Optional[WebSocket] = None
        self.is_online: bool = True
        self.status: str = "active"

    def current_target_item_id(self, game_mode: str) -> Optional[int]:
        if game_mode == "free":
            return None
        if self.progress >= len(self.stop_order):
            return None
        return self.stop_order[self.progress]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "player_id": self.player_id,
            "nickname": self.nickname,
            "is_ready": self.is_ready,
            "is_host": self.is_host,
            "progress": self.progress,
            "stop_order": self.stop_order,
            "found_item_ids": self.found_item_ids,
            "current_target_item_id": None,
            "is_online": self.is_online,
            "status": self.status,
            "finished": self.completed_at is not None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

    def to_dict_for_room(self, game_mode: str) -> Dict[str, Any]:
        payload = self.to_dict()
        payload["current_target_item_id"] = self.current_target_item_id(game_mode)
        return payload


class RoomState:
    def __init__(
        self,
        room_id: str,
        name: str,
        description: str,
        tour_id: str,
        game_mode: str,
        with_map: bool,
        stop_item_ids: list[int],
    ):
        self.room_id: str = room_id
        self.name: str = name
        self.description: str = description
        self.tour_id: str = tour_id
        self.game_mode: str = game_mode
        self.with_map: bool = with_map
        self.stop_item_ids: list[int] = stop_item_ids
        self.status: str = "waiting"
        self.players: Dict[str, PlayerState] = {}
        self.winner_id: Optional[str] = None
        self.winner_nickname: Optional[str] = None
        self.is_locked: bool = False
        self.finished_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "room_id": self.room_id,
            "name": self.name,
            "description": self.description,
            "tour_id": self.tour_id,
            "game_mode": self.game_mode,
            "with_map": self.with_map,
            "stop_item_ids": self.stop_item_ids,
            "status": self.status,
            "winner_id": self.winner_id,
            "winner_nickname": self.winner_nickname,
            "is_locked": self.is_locked,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "players": [
                player.to_dict_for_room(self.game_mode)
                for player in self.players.values()
            ],
        }


class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, RoomState] = {}
        self._cleanup_tasks: Dict[str, asyncio.Task] = {}

    def _purge_expired_finished_rooms(self) -> None:
        now = datetime.now()
        expired = [
            room_id
            for room_id, room in self.rooms.items()
            if room.status == "finished"
            and room.finished_at is not None
            and (now - room.finished_at).total_seconds() > FINISHED_ROOM_TTL_SECONDS
        ]
        for room_id in expired:
            self.remove_room(room_id)

    def create_room(
        self,
        name: str,
        description: str,
        tour_id: str,
        game_mode: str,
        with_map: bool,
        stop_item_ids: list[int],
    ) -> str:
        self._purge_expired_finished_rooms()
        while True:
            room_id = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if room_id not in self.rooms:
                break
        self.rooms[room_id] = RoomState(
            room_id,
            name,
            description,
            tour_id,
            game_mode,
            with_map,
            stop_item_ids,
        )
        logger.info(
            "Room created: %s (Tour: %s, mode: %s, map: %s)",
            room_id,
            tour_id,
            game_mode,
            with_map,
        )
        return room_id

    def get_room(self, room_id: str) -> Optional[RoomState]:
        self._purge_expired_finished_rooms()
        return self.rooms.get(room_id)

    def remove_room(self, room_id: str):
        cleanup_task = self._cleanup_tasks.pop(room_id, None)
        if cleanup_task and not cleanup_task.done():
            cleanup_task.cancel()
        if room_id in self.rooms:
            del self.rooms[room_id]
            logger.info("Room removed: %s", room_id)

    def _schedule_delayed_cleanup(self, room_id: str, delay_seconds: int) -> None:
        existing = self._cleanup_tasks.get(room_id)
        if existing and not existing.done():
            existing.cancel()

        task = asyncio.create_task(self._delayed_cleanup_check(room_id, delay_seconds))
        self._cleanup_tasks[room_id] = task

        def _clear_task(finished: asyncio.Task) -> None:
            if self._cleanup_tasks.get(room_id) is finished:
                self._cleanup_tasks.pop(room_id, None)

        task.add_done_callback(_clear_task)

    def _prune_offline_players(self, room: RoomState) -> None:
        if room.status != "waiting":
            return
        if any(player.is_online for player in room.players.values()):
            return
        for player_id in list(room.players):
            del room.players[player_id]

    def _waiting_room_has_online_players(self, room: RoomState) -> bool:
        return any(player.is_online for player in room.players.values())

    def get_active_rooms(self) -> List[Dict[str, Any]]:
        self._purge_expired_finished_rooms()
        return [
            {
                "room_id": room.room_id,
                "name": room.name,
                "description": room.description,
                "tour_id": room.tour_id,
                "game_mode": room.game_mode,
                "with_map": room.with_map,
                "player_count": len(
                    [
                        player
                        for player in room.players.values()
                        if player.status == "active" and player.is_online
                    ]
                ),
                "status": room.status,
            }
            for room in self.rooms.values()
            if room.status == "waiting" and self._waiting_room_has_online_players(room)
        ]

    async def broadcast(self, room_id: str, message: Dict[str, Any]):
        room = self.get_room(room_id)
        if not room:
            return

        disconnected_players: list[str] = []
        for player_id, player in list(room.players.items()):
            if player.websocket and player.is_online:
                try:
                    await player.websocket.send_json(message)
                except Exception as exc:
                    logger.warning(
                        "Error sending message to player %s in room %s: %s",
                        player_id,
                        room_id,
                        exc,
                    )
                    disconnected_players.append(player_id)

        for player_id in disconnected_players:
            try:
                await self.handle_disconnect(room_id, player_id)
            except Exception:
                logger.exception(
                    "Error handling disconnect for player %s in room %s",
                    player_id,
                    room_id,
                )

    async def broadcast_room_state(self, room_id: str):
        room = self.get_room(room_id)
        if not room:
            return
        await self.broadcast(
            room_id,
            {
                "type": "room_state",
                "room": room.to_dict(),
            },
        )

    def _assign_player_orders(self, room: RoomState) -> None:
        for player in room.players.values():
            if room.game_mode == "sequential_random":
                player.stop_order = _shuffle_item_ids(room.stop_item_ids)
            else:
                player.stop_order = list(room.stop_item_ids)
            player.found_item_ids = []
            player.progress = 0
            player.completed_at = None

    def _validate_find(self, room: RoomState, player: PlayerState, item_id: int) -> bool:
        if item_id not in room.stop_item_ids:
            return False

        if room.game_mode == "free":
            return item_id not in player.found_item_ids

        expected = player.current_target_item_id(room.game_mode)
        return expected is not None and item_id == expected

    def _apply_find(self, room: RoomState, player: PlayerState, item_id: int) -> None:
        if item_id not in player.found_item_ids:
            player.found_item_ids.append(item_id)
        if room.game_mode == "free":
            player.progress = len(player.found_item_ids)
        else:
            player.progress += 1

    def _promote_next_host(self, room: RoomState, *, prefer_online: bool = True) -> None:
        active_players = sorted(
            [player for player in room.players.values() if player.status == "active"],
            key=lambda player: player.joined_at,
        )
        if prefer_online and active_players:
            online_players = [player for player in active_players if player.is_online]
            if online_players:
                active_players = online_players

        if active_players:
            next_host = active_players[0]
        else:
            pending_players = sorted(
                [player for player in room.players.values() if player.status == "pending"],
                key=lambda player: player.joined_at,
            )
            if not pending_players:
                for candidate in room.players.values():
                    candidate.is_host = False
                return
            next_host = pending_players[0]
            next_host.status = "active"

        for candidate in room.players.values():
            candidate.is_host = False
        next_host.is_host = True
        next_host.is_ready = True

    def _is_waiting_room(self, room: Optional[RoomState]) -> bool:
        return room is not None and room.status == "waiting"

    async def send_chat(self, room_id: str, player_id: str, text: str):
        room = self.get_room(room_id)
        if not self._is_waiting_room(room):
            return

        player = room.players.get(player_id)
        if not player or player.status != "active":
            return

        clean = text.strip()[:200]
        if not clean:
            return

        await self.broadcast(
            room_id,
            {
                "type": "chat_bubble",
                "player_id": player_id,
                "nickname": player.nickname,
                "text": clean,
            },
        )

    async def join_room(
        self,
        room_id: str,
        player_id: str,
        nickname: str,
        websocket: WebSocket,
    ) -> bool:
        room = self.get_room(room_id)
        if not room:
            return False

        if room.status == "finished":
            return player_id in room.players

        if room.status != "waiting" and player_id not in room.players:
            return False

        if player_id in room.players:
            player = room.players[player_id]
            player.websocket = websocket
            player.is_online = True
            logger.info(
                "Player %s (%s) reconnected to room %s",
                nickname,
                player_id,
                room_id,
            )
        else:
            if room.status != "waiting":
                return False
            if not self._waiting_room_has_online_players(room):
                self._prune_offline_players(room)
            is_host = len(room.players) == 0
            status = "active"
            if not is_host and room.is_locked:
                status = "pending"

            player = PlayerState(player_id, nickname, is_host)
            player.status = status
            player.websocket = websocket
            room.players[player_id] = player
            logger.info(
                "Player %s (%s) joined room %s as %s (status: %s)",
                nickname,
                player_id,
                room_id,
                "host" if is_host else "member",
                status,
            )

        await self.broadcast_room_state(room_id)
        return True

    async def _delayed_cleanup_check(self, room_id: str, delay_seconds: int = 15):
        await asyncio.sleep(delay_seconds)
        room = self.get_room(room_id)
        if not room:
            return

        all_offline = all(not player.is_online for player in room.players.values())
        if not all_offline:
            return

        if room.status == "waiting":
            logger.info(
                "Delayed cleanup: abandoned waiting room %s after %ss",
                room_id,
                delay_seconds,
            )
            self.remove_room(room_id)
        elif room.status == "playing":
            logger.info(
                "Delayed cleanup: all players offline in room %s after %ss",
                room_id,
                delay_seconds,
            )
            self.remove_room(room_id)

    async def handle_disconnect(self, room_id: str, player_id: str):
        room = self.get_room(room_id)
        if not room or player_id not in room.players:
            return

        player = room.players[player_id]
        player.is_online = False
        player.websocket = None
        was_host = player.is_host
        logger.info(
            "Player %s (%s) disconnected from room %s",
            player.nickname,
            player_id,
            room_id,
        )

        if room.status == "waiting" and was_host:
            self._promote_next_host(room)

        if room.status == "playing":
            all_offline = all(not p.is_online for p in room.players.values())
            if all_offline:
                self._schedule_delayed_cleanup(room_id, PLAYING_ROOM_CLEANUP_SECONDS)
        elif room.status == "waiting":
            if not any(p.is_online for p in room.players.values()):
                self._schedule_delayed_cleanup(room_id, WAITING_ROOM_CLEANUP_SECONDS)

        await self.broadcast_room_state(room_id)

    async def leave_room_explicit(self, room_id: str, player_id: str):
        room = self.get_room(room_id)
        if not room or player_id not in room.players:
            return

        player = room.players[player_id]
        was_host = player.is_host
        logger.info(
            "Player %s (%s) explicitly left room %s",
            player.nickname,
            player_id,
            room_id,
        )
        del room.players[player_id]

        if was_host and room.players and room.status == "waiting":
            self._promote_next_host(room)

        if not room.players and room.status != "finished":
            self.remove_room(room_id)
            return

        await self.broadcast_room_state(room_id)

    async def toggle_ready(self, room_id: str, player_id: str):
        room = self.get_room(room_id)
        if not self._is_waiting_room(room) or player_id not in room.players:
            return

        player = room.players[player_id]
        if not player.is_host and player.status == "active":
            player.is_ready = not player.is_ready
            await self.broadcast_room_state(room_id)

    async def start_match(self, room_id: str, player_id: str) -> bool:
        room = self.get_room(room_id)
        if not room or room.status != "waiting":
            return False

        player = room.players.get(player_id)
        if not player or not player.is_host:
            return False

        non_host_active = [
            candidate for candidate in room.players.values()
            if not candidate.is_host and candidate.status == "active"
        ]
        if not all(candidate.is_ready for candidate in non_host_active):
            return False

        pending_players = [
            candidate for candidate in room.players.values() if candidate.status == "pending"
        ]
        for pending in pending_players:
            if pending.websocket:
                try:
                    await pending.websocket.close(code=4003, reason="Cuộc đua đã bắt đầu")
                except Exception:
                    pass
            del room.players[pending.player_id]

        room.status = "playing"
        room.winner_id = None
        room.winner_nickname = None
        room.finished_at = None
        self._assign_player_orders(room)

        await self.broadcast(
            room_id,
            {
                "type": "match_started",
                "room": room.to_dict(),
            },
        )
        return True

    async def _finish_player_if_needed(
        self,
        room: RoomState,
        player: PlayerState,
        total_stops: int,
    ) -> bool:
        if player.progress < total_stops or player.completed_at is not None:
            return False

        player.completed_at = datetime.now()
        if room.winner_id is None:
            room.winner_id = player.player_id
            room.winner_nickname = player.nickname
            room.status = "finished"
            room.finished_at = datetime.now()
            await self.broadcast(
                room.room_id,
                {
                    "type": "match_finished",
                    "winner_id": room.winner_id,
                    "winner_nickname": room.winner_nickname,
                    "room": room.to_dict(),
                },
            )
            return True
        return False

    async def report_find(self, room_id: str, player_id: str, item_id: int):
        room = self.get_room(room_id)
        if not room or room.status != "playing":
            return

        player = room.players.get(player_id)
        if not player or player.status != "active":
            return

        if not self._validate_find(room, player, item_id):
            await self.broadcast(
                room_id,
                {
                    "type": "find_rejected",
                    "player_id": player_id,
                    "item_id": item_id,
                },
            )
            return

        self._apply_find(room, player, item_id)
        total_stops = len(room.stop_item_ids)
        finished = await self._finish_player_if_needed(room, player, total_stops)
        if not finished:
            await self.broadcast_room_state(room_id)

    async def update_progress(self, room_id: str, player_id: str, progress: int, total_stops: int):
        room = self.get_room(room_id)
        if not room or room.status != "playing":
            return

        player = room.players.get(player_id)
        if not player or player.status != "active":
            return

        player.progress = min(progress, total_stops)
        if room.game_mode != "free":
            player.found_item_ids = player.stop_order[: player.progress]

        finished = await self._finish_player_if_needed(room, player, total_stops)
        if not finished:
            await self.broadcast_room_state(room_id)

    async def toggle_lock(self, room_id: str, player_id: str):
        room = self.get_room(room_id)
        if not self._is_waiting_room(room):
            return

        player = room.players.get(player_id)
        if not player or not player.is_host:
            return

        room.is_locked = not room.is_locked
        await self.broadcast_room_state(room_id)

    async def approve_player(self, room_id: str, player_id: str, target_id: str):
        room = self.get_room(room_id)
        if not self._is_waiting_room(room):
            return

        player = room.players.get(player_id)
        if not player or not player.is_host:
            return

        target = room.players.get(target_id)
        if target and target.status == "pending":
            target.status = "active"
            await self.broadcast_room_state(room_id)

    async def reject_player(self, room_id: str, player_id: str, target_id: str):
        room = self.get_room(room_id)
        if not self._is_waiting_room(room):
            return

        player = room.players.get(player_id)
        if not player or not player.is_host:
            return

        target = room.players.get(target_id)
        if target and target.status == "pending":
            if target.websocket:
                try:
                    await target.websocket.close(code=4009, reason="Yêu cầu tham gia bị từ chối")
                except Exception:
                    pass
            del room.players[target_id]
            await self.broadcast_room_state(room_id)

    async def kick_player(self, room_id: str, player_id: str, target_id: str):
        room = self.get_room(room_id)
        if not self._is_waiting_room(room):
            return

        player = room.players.get(player_id)
        if not player or not player.is_host:
            return

        target = room.players.get(target_id)
        if target and not target.is_host:
            if target.websocket:
                try:
                    await target.websocket.close(code=4008, reason="Bạn đã bị đuổi khỏi phòng đấu")
                except Exception:
                    pass
            del room.players[target_id]
            await self.broadcast_room_state(room_id)


manager = RoomManager()
