import random
import string
import logging
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class PlayerState:
    def __init__(self, player_id: str, nickname: str, is_host: bool = False):
        self.player_id: str = player_id
        self.nickname: str = nickname
        self.is_ready: bool = is_host  # Host is ready by default
        self.is_host: bool = is_host
        self.progress: int = 0         # Number of stops completed
        self.completed_at: Optional[datetime] = None
        self.websocket: Optional[WebSocket] = None
        self.is_online: bool = True
        self.status: str = "active"    # active or pending

    def to_dict(self) -> Dict[str, Any]:
        return {
            "player_id": self.player_id,
            "nickname": self.nickname,
            "is_ready": self.is_ready,
            "is_host": self.is_host,
            "progress": self.progress,
            "is_online": self.is_online,
            "status": self.status,
            "finished": self.completed_at is not None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }

class RoomState:
    def __init__(self, room_id: str, name: str, description: str, tour_id: str):
        self.room_id: str = room_id
        self.name: str = name
        self.description: str = description
        self.tour_id: str = tour_id
        self.status: str = "waiting"  # waiting, playing, finished
        self.players: Dict[str, PlayerState] = {}
        self.winner_id: Optional[str] = None
        self.winner_nickname: Optional[str] = None
        self.is_locked: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "room_id": self.room_id,
            "name": self.name,
            "description": self.description,
            "tour_id": self.tour_id,
            "status": self.status,
            "winner_id": self.winner_id,
            "winner_nickname": self.winner_nickname,
            "is_locked": self.is_locked,
            "players": [p.to_dict() for p in self.players.values()]
        }

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, RoomState] = {}

    def create_room(self, name: str, description: str, tour_id: str) -> str:
        # Generate a unique 6-character room code (uppercase letters and digits)
        while True:
            room_id = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if room_id not in self.rooms:
                break
        self.rooms[room_id] = RoomState(room_id, name, description, tour_id)
        logger.info(f"Room created: {room_id} (Tour: {tour_id})")
        return room_id

    def get_room(self, room_id: str) -> Optional[RoomState]:
        return self.rooms.get(room_id)

    def remove_room(self, room_id: str):
        if room_id in self.rooms:
            del self.rooms[room_id]
            logger.info(f"Room removed: {room_id}")

    def get_active_rooms(self) -> List[Dict[str, Any]]:
        # Return only rooms in 'waiting' state to list on the lobby
        return [
            {
                "room_id": room.room_id,
                "name": room.name,
                "description": room.description,
                "tour_id": room.tour_id,
                "player_count": len([p for p in room.players.values() if p.status == "active"]),
                "status": room.status
            }
            for room in self.rooms.values()
            if room.status == "waiting"
        ]

    async def broadcast(self, room_id: str, message: Dict[str, Any]):
        room = self.get_room(room_id)
        if not room:
            return

        disconnected_players = []
        for player_id, player in room.players.items():
            if player.websocket and player.is_online:
                try:
                    await player.websocket.send_json(message)
                except Exception as e:
                    logger.warning(f"Error sending message to player {player_id} in room {room_id}: {e}")
                    disconnected_players.append(player_id)

        # Handle players that failed to receive message
        for player_id in disconnected_players:
            await self.handle_disconnect(room_id, player_id)

    async def broadcast_room_state(self, room_id: str):
        room = self.get_room(room_id)
        if not room:
            return
        await self.broadcast(room_id, {
            "type": "room_state",
            "room": room.to_dict()
        })

    async def join_room(self, room_id: str, player_id: str, nickname: str, websocket: WebSocket) -> bool:
        room = self.get_room(room_id)
        if not room:
            return False

        # If match is in progress, only allow joining if the player was already in the room (reconnection)
        if room.status != "waiting" and player_id not in room.players:
            return False

        if player_id in room.players:
            # Reconnection or updating socket
            player = room.players[player_id]
            player.websocket = websocket
            player.is_online = True
            logger.info(f"Player {nickname} ({player_id}) reconnected to room {room_id} (status: {player.status})")
        else:
            # New player joining
            is_host = len(room.players) == 0
            status = "active"
            if not is_host and room.is_locked:
                status = "pending"
            
            player = PlayerState(player_id, nickname, is_host)
            player.status = status
            player.websocket = websocket
            room.players[player_id] = player
            logger.info(f"Player {nickname} ({player_id}) joined room {room_id} as {'host' if is_host else 'member'} (status: {status})")

        await self.broadcast_room_state(room_id)
        return True

    async def _delayed_cleanup_check(self, room_id: str, delay_seconds: int = 15):
        await asyncio.sleep(delay_seconds)
        room = self.get_room(room_id)
        if not room:
            return
        if room.status in ("playing", "finished"):
            all_offline = all(not p.is_online for p in room.players.values())
            if all_offline:
                logger.info(f"Delayed cleanup: All players still offline in room {room_id} after {delay_seconds}s. Cleaning up.")
                self.remove_room(room_id)

    async def handle_disconnect(self, room_id: str, player_id: str):
        room = self.get_room(room_id)
        if not room or player_id not in room.players:
            return

        player = room.players[player_id]
        player.is_online = False
        player.websocket = None
        logger.info(f"Player {player.nickname} ({player_id}) disconnected from room {room_id}")

        if room.status == "waiting":
            # If still waiting, remove the player immediately
            del room.players[player_id]
            logger.info(f"Player {player.nickname} removed from waiting room {room_id}")

            # If the player was host, assign host to someone else
            if player.is_host and room.players:
                # Find the next active player to make host
                active_players = [p for p in room.players.values() if p.status == "active"]
                if active_players:
                    next_host = active_players[0]
                    next_host.is_host = True
                    next_host.is_ready = True
                    logger.info(f"Host transferred to {next_host.nickname} in room {room_id}")
                else:
                    # No active players left (only pending requests), clean up the room
                    self.remove_room(room_id)
                    return

            # If room is empty, clean up
            if not room.players:
                self.remove_room(room_id)
                return

        else:
            # If playing, keep player state but mark offline. If all players are offline, schedule delayed cleanup
            all_offline = all(not p.is_online for p in room.players.values())
            if all_offline:
                logger.info(f"All players left active room {room_id}. Scheduling delayed cleanup in 15 seconds.")
                asyncio.create_task(self._delayed_cleanup_check(room_id, 15))
                return

        await self.broadcast_room_state(room_id)

    async def leave_room_explicit(self, room_id: str, player_id: str):
        room = self.get_room(room_id)
        if not room or player_id not in room.players:
            return

        player = room.players[player_id]
        logger.info(f"Player {player.nickname} ({player_id}) explicitly left room {room_id}")
        
        # Remove player from room (even if game is in progress)
        del room.players[player_id]

        if player.is_host and room.players:
            active_players = [p for p in room.players.values() if p.status == "active"]
            if active_players:
                next_host = active_players[0]
                next_host.is_host = True
                next_host.is_ready = True
                logger.info(f"Host transferred to {next_host.nickname} in room {room_id}")

        if not room.players:
            self.remove_room(room_id)
            return

        await self.broadcast_room_state(room_id)

    async def toggle_ready(self, room_id: str, player_id: str):
        room = self.get_room(room_id)
        if not room or player_id not in room.players:
            return

        player = room.players[player_id]
        if not player.is_host and player.status == "active":  # Host is always ready, pending cannot ready
            player.is_ready = not player.is_ready
            logger.info(f"Player {player.nickname} toggled ready to {player.is_ready}")
            await self.broadcast_room_state(room_id)

    async def start_match(self, room_id: str, player_id: str) -> bool:
        room = self.get_room(room_id)
        if not room or room.status != "waiting":
            return False

        # Verify sender is host
        player = room.players.get(player_id)
        if not player or not player.is_host:
            return False

        # Verify all other active players are ready
        non_host_active_players = [p for p in room.players.values() if not p.is_host and p.status == "active"]
        if not all(p.is_ready for p in non_host_active_players):
            logger.warning(f"Cannot start room {room_id}: not all players are ready")
            return False

        # Clear any pending players (they missed the train)
        pending_players = [p for p in room.players.values() if p.status == "pending"]
        for p in pending_players:
            if p.websocket:
                try:
                    await p.websocket.close(code=4003, reason="Cuộc đua đã bắt đầu")
                except Exception:
                    pass
            del room.players[p.player_id]

        room.status = "playing"
        room.winner_id = None
        room.winner_nickname = None
        for p in room.players.values():
            p.progress = 0
            p.completed_at = None

        logger.info(f"Match started in room {room_id}!")
        await self.broadcast(room_id, {
            "type": "match_started",
            "room": room.to_dict()
        })
        return True

    async def update_progress(self, room_id: str, player_id: str, progress: int, total_stops: int):
        room = self.get_room(room_id)
        if not room or room.status != "playing":
            return

        player = room.players.get(player_id)
        if not player or player.status != "active":
            return

        player.progress = progress
        logger.info(f"Player {player.nickname} progress updated: {progress}/{total_stops} in room {room_id}")

        # Check if this player finished the tour
        if progress >= total_stops and player.completed_at is None:
            player.completed_at = datetime.now()
            logger.info(f"Player {player.nickname} completed the tour in room {room_id}!")

            # If no winner has been decided yet, they are the winner!
            if room.winner_id is None:
                room.winner_id = player_id
                room.winner_nickname = player.nickname
                room.status = "finished"
                logger.info(f"Winner of room {room_id} is {player.nickname}!")
                
                await self.broadcast(room_id, {
                    "type": "match_finished",
                    "winner_id": room.winner_id,
                    "winner_nickname": room.winner_nickname,
                    "room": room.to_dict()
                })
                return

        await self.broadcast_room_state(room_id)

    async def toggle_lock(self, room_id: str, player_id: str):
        room = self.get_room(room_id)
        if not room:
            return

        # Verify sender is host
        player = room.players.get(player_id)
        if not player or not player.is_host:
            return

        room.is_locked = not room.is_locked
        logger.info(f"Room {room_id} is_locked set to {room.is_locked} by host")
        await self.broadcast_room_state(room_id)

    async def approve_player(self, room_id: str, player_id: str, target_id: str):
        room = self.get_room(room_id)
        if not room:
            return

        # Verify sender is host
        player = room.players.get(player_id)
        if not player or not player.is_host:
            return

        target = room.players.get(target_id)
        if target and target.status == "pending":
            target.status = "active"
            logger.info(f"Player {target.nickname} approved in room {room_id}")
            await self.broadcast_room_state(room_id)

    async def reject_player(self, room_id: str, player_id: str, target_id: str):
        room = self.get_room(room_id)
        if not room:
            return

        # Verify sender is host
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
            logger.info(f"Player {target.nickname} rejected in room {room_id}")
            await self.broadcast_room_state(room_id)

    async def kick_player(self, room_id: str, player_id: str, target_id: str):
        room = self.get_room(room_id)
        if not room:
            return

        # Verify sender is host
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
            logger.info(f"Player {target.nickname} kicked from room {room_id}")
            await self.broadcast_room_state(room_id)

# Singleton manager
manager = RoomManager()
