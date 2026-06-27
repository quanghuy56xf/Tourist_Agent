import asyncio

import pytest
from fastapi.testclient import TestClient

from app.models.group import Group
from app.models.item import Item
from app.modules.tour_match.manager import manager


def _clear_manager_rooms() -> None:
    for task in list(manager._cleanup_tasks.values()):
        if not task.done():
            task.cancel()
    manager._cleanup_tasks.clear()
    manager.rooms.clear()


def _seed_group_tour(db_session):
    group = Group(name="Test Heritage")
    db_session.add(group)
    db_session.flush()
    first = Item(name="Item A", description="A", group_id=group.id)
    second = Item(name="Item B", description="B", group_id=group.id)
    db_session.add_all([first, second])
    db_session.commit()
    return f"group-{group.id}"


def test_create_and_list_rooms(client: TestClient, db_session):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)

    response = client.post(
        "/api/tour-match/rooms",
        json={
            "name": "Đấu trường Lam Kinh",
            "description": "Ai nhanh nhất sẽ thắng",
            "tour_id": tour_id,
            "game_mode": "sequential_random",
            "with_map": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    room_id = data["room_id"]

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_player?nickname=Alice"
    ) as ws_host:
        ws_host.receive_json()
        response = client.get("/api/tour-match/rooms")
        assert response.status_code == 200
        rooms = response.json()
        assert len(rooms) == 1
        assert rooms[0]["room_id"] == room_id
        assert rooms[0]["game_mode"] == "sequential_random"
        assert rooms[0]["with_map"] is True


    response = client.get(f"/api/tour-match/rooms/{room_id}")
    assert response.status_code == 200
    details = response.json()
    assert details["stop_item_ids"]
    assert details["game_mode"] == "sequential_random"


def test_websocket_multiplayer_flow(client: TestClient, db_session):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)

    response = client.post(
        "/api/tour-match/rooms",
        json={"name": "Race Room", "description": "Quick game", "tour_id": tour_id},
    )
    room_id = response.json()["room_id"]

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_player?nickname=Alice"
    ) as ws_host:
        data = ws_host.receive_json()
        assert data["type"] == "room_state"
        assert len(data["room"]["players"]) == 1

        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/member_player?nickname=Bob"
        ) as ws_member:
            ws_host.receive_json()
            ws_member.receive_json()

            ws_member.send_json({"type": "toggle_ready"})
            ws_host.receive_json()
            ws_member.receive_json()

            ws_host.send_json({"type": "start_match"})
            start_host = ws_host.receive_json()
            start_member = ws_member.receive_json()
            assert start_host["type"] == "match_started"
            assert start_host["room"]["status"] == "playing"

            host_player = start_host["room"]["players"][0]
            member_player = start_member["room"]["players"][1]
            assert host_player["stop_order"]
            assert member_player["stop_order"]

            first_item = host_player["stop_order"][0]
            ws_host.send_json({"type": "report_find", "item_id": first_item})
            ws_host.receive_json()
            ws_member.receive_json()

            ws_host.send_json({"type": "report_find", "item_id": host_player["stop_order"][1]})
            win_host = ws_host.receive_json()
            ws_member.receive_json()
            assert win_host["type"] == "match_finished"


def test_sequential_random_assigns_unique_orders(client: TestClient, db_session, monkeypatch):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)
    room_id = client.post(
        "/api/tour-match/rooms",
        json={
            "name": "Shuffle Room",
            "description": "",
            "tour_id": tour_id,
            "game_mode": "sequential_random",
        },
    ).json()["room_id"]

    shuffle_calls = 0

    def deterministic_shuffle(item_ids):
        nonlocal shuffle_calls
        shuffle_calls += 1
        return list(reversed(item_ids)) if shuffle_calls % 2 == 0 else list(item_ids)

    monkeypatch.setattr(
        "app.modules.tour_match.manager._shuffle_item_ids",
        deterministic_shuffle,
    )

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_player?nickname=Alice"
    ) as ws_host:
        ws_host.receive_json()
        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/member_player?nickname=Bob"
        ) as ws_member:
            ws_host.receive_json()
            ws_member.receive_json()
            ws_member.send_json({"type": "toggle_ready"})
            ws_host.receive_json()
            ws_member.receive_json()
            ws_host.send_json({"type": "start_match"})
            started = ws_host.receive_json()
            ws_member.receive_json()
            orders = [
                player["stop_order"]
                for player in started["room"]["players"]
                if player["status"] == "active"
            ]
            assert len(orders) == 2
            assert orders[0] != orders[1]


def test_websocket_host_controls(client: TestClient, db_session):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)
    response = client.post(
        "/api/tour-match/rooms",
        json={"name": "Lockable Room", "description": "Lobby controls test", "tour_id": tour_id},
    )
    room_id = response.json()["room_id"]

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_id?nickname=Alice"
    ) as ws_host:
        state1 = ws_host.receive_json()["room"]
        assert state1["is_locked"] is False

        ws_host.send_json({"type": "toggle_lock"})
        state2 = ws_host.receive_json()["room"]
        assert state2["is_locked"] is True

        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/bob_id?nickname=Bob"
        ) as ws_bob:
            bob_state = ws_bob.receive_json()["room"]
            bob_self = next(p for p in bob_state["players"] if p["player_id"] == "bob_id")
            assert bob_self["status"] == "pending"

            ws_host.receive_json()
            ws_host.send_json({"type": "approve_player", "target_id": "bob_id"})
            ws_bob.receive_json()
            ws_host.receive_json()

            from starlette.websockets import WebSocketDisconnect

            with pytest.raises(WebSocketDisconnect) as exc_info_charlie:
                with client.websocket_connect(
                    f"/api/tour-match/ws/{room_id}/charlie_id?nickname=Charlie"
                ) as ws_charlie:
                    ws_charlie.receive_json()
                    ws_host.receive_json()
                    ws_host.send_json({"type": "reject_player", "target_id": "charlie_id"})
                    ws_host.receive_json()
                    for _ in range(10):
                        ws_charlie.receive_json()

            assert exc_info_charlie.value.code == 4009

            ws_host.send_json({"type": "kick_player", "target_id": "bob_id"})
            ws_host.receive_json()

            with pytest.raises(WebSocketDisconnect) as exc_info_bob:
                for _ in range(10):
                    ws_bob.receive_json()

            assert exc_info_bob.value.code == 4008


def test_host_transfer_on_disconnect(client: TestClient, db_session):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)
    room_id = client.post(
        "/api/tour-match/rooms",
        json={"name": "Host Transfer", "description": "", "tour_id": tour_id},
    ).json()["room_id"]

    host_ctx = client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_id?nickname=Alice"
    )
    host = host_ctx.__enter__()
    host.receive_json()

    bob_ctx = client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/bob_id?nickname=Bob"
    )
    bob = bob_ctx.__enter__()
    host.receive_json()
    bob.receive_json()

    host_ctx.__exit__(None, None, None)

    transfer_msg = bob.receive_json()
    assert transfer_msg["type"] == "room_state"
    bob_state = next(
        player for player in transfer_msg["room"]["players"] if player["player_id"] == "bob_id"
    )
    assert bob_state["is_host"] is True

    bob_ctx.__exit__(None, None, None)


def test_kick_blocked_after_match_starts(client: TestClient, db_session):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)
    room_id = client.post(
        "/api/tour-match/rooms",
        json={"name": "Kick Guard", "description": "", "tour_id": tour_id},
    ).json()["room_id"]

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_id?nickname=Alice"
    ) as ws_host:
        ws_host.receive_json()
        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/bob_id?nickname=Bob"
        ) as ws_bob:
            ws_host.receive_json()
            ws_bob.receive_json()
            ws_bob.send_json({"type": "toggle_ready"})
            ws_host.receive_json()
            ws_bob.receive_json()
            ws_host.send_json({"type": "start_match"})
            ws_host.receive_json()
            ws_bob.receive_json()

            asyncio.run(manager.kick_player(room_id, "host_id", "bob_id"))
            # No kick: room should still contain bob after the match starts.
            room = manager.get_room(room_id)
            assert room is not None
            assert "bob_id" in room.players


def test_waiting_room_chat_broadcast(client: TestClient, db_session):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)
    room_id = client.post(
        "/api/tour-match/rooms",
        json={"name": "Chat Room", "description": "", "tour_id": tour_id},
    ).json()["room_id"]

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_id?nickname=Alice"
    ) as ws_host:
        ws_host.receive_json()
        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/bob_id?nickname=Bob"
        ) as ws_bob:
            ws_host.receive_json()
            ws_bob.receive_json()

            ws_host.send_json({"type": "chat", "text": "Chào cả phòng!"})
            host_msg = ws_host.receive_json()
            bob_msg = ws_bob.receive_json()
            assert host_msg["type"] == "chat_bubble"
            assert bob_msg["type"] == "chat_bubble"
            assert host_msg["text"] == "Chào cả phòng!"


def test_websocket_race_condition_transition(client: TestClient, db_session):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)
    response = client.post(
        "/api/tour-match/rooms",
        json={"name": "Race Room", "description": "Quick game", "tour_id": tour_id},
    )
    room_id = response.json()["room_id"]

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_player?nickname=Alice"
    ) as ws_host:
        ws_host.receive_json()
        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/member_player?nickname=Bob"
        ) as ws_bob:
            ws_host.receive_json()
            ws_bob.receive_json()
            ws_bob.send_json({"type": "toggle_ready"})
            ws_host.receive_json()
            ws_bob.receive_json()
            ws_host.send_json({"type": "start_match"})
            ws_host.receive_json()
            ws_bob.receive_json()

    room = manager.get_room(room_id)
    assert room is not None
    assert room.status == "playing"

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_player?nickname=Alice"
    ) as ws_host_new:
        state_host = ws_host_new.receive_json()["room"]
        assert state_host["status"] == "playing"


def test_waiting_room_removed_when_all_offline():
    from app.modules.tour_match.manager import PlayerState

    _clear_manager_rooms()
    room_id = manager.create_room(
        name="Abandoned",
        description="",
        tour_id="group-1",
        game_mode="sequential",
        with_map=False,
        stop_item_ids=[1, 2],
    )
    solo = PlayerState("solo_id", "Solo", is_host=True)
    solo.is_online = False
    solo.websocket = None
    manager.rooms[room_id].players["solo_id"] = solo

    asyncio.run(manager._delayed_cleanup_check(room_id, delay_seconds=0))

    assert manager.get_room(room_id) is None


def test_abandoned_waiting_room_hidden_from_lobby():
    from app.modules.tour_match.manager import PlayerState

    _clear_manager_rooms()
    room_id = manager.create_room(
        name="Ghost",
        description="",
        tour_id="group-1",
        game_mode="sequential",
        with_map=False,
        stop_item_ids=[1, 2],
    )
    ghost = PlayerState("ghost_id", "Ghost", is_host=True)
    ghost.is_online = False
    manager.rooms[room_id].players["ghost_id"] = ghost

    assert manager.get_active_rooms() == []


def test_join_abandoned_waiting_room_prunes_offline_players():
    from app.modules.tour_match.manager import PlayerState

    _clear_manager_rooms()
    room_id = manager.create_room(
        name="Fresh",
        description="",
        tour_id="group-1",
        game_mode="sequential",
        with_map=False,
        stop_item_ids=[1, 2],
    )
    ghost = PlayerState("ghost_id", "Ghost", is_host=True)
    ghost.is_online = False
    manager.rooms[room_id].players["ghost_id"] = ghost

    class DummyWs:
        pass

    async def run_join():
        ok = await manager.join_room(room_id, "new_id", "Newbie", DummyWs())  # type: ignore[arg-type]
        assert ok is True
        room = manager.get_room(room_id)
        assert room is not None
        assert list(room.players) == ["new_id"]
        assert room.players["new_id"].is_host is True

    asyncio.run(run_join())


def test_host_leave_promotes_pending_player(client: TestClient, db_session):
    _clear_manager_rooms()
    tour_id = _seed_group_tour(db_session)
    room_id = client.post(
        "/api/tour-match/rooms",
        json={"name": "Pending Host", "description": "", "tour_id": tour_id},
    ).json()["room_id"]

    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_id?nickname=Alice"
    ) as ws_host:
        ws_host.receive_json()
        ws_host.send_json({"type": "toggle_lock"})
        ws_host.receive_json()

        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/bob_id?nickname=Bob"
        ) as ws_bob:
            ws_host.receive_json()
            ws_bob.receive_json()

            ws_host.send_json({"type": "leave"})

            transfer_msg = ws_bob.receive_json()
            assert transfer_msg["type"] == "room_state"
            bob_state = next(
                player
                for player in transfer_msg["room"]["players"]
                if player["player_id"] == "bob_id"
            )
            assert bob_state["is_host"] is True
            assert bob_state["status"] == "active"
