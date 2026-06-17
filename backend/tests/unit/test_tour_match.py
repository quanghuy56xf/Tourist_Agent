import pytest
from fastapi.testclient import TestClient
from app.modules.tour_match.manager import manager

def test_create_and_list_rooms(client: TestClient):
    # Reset manager rooms to have a clean slate
    manager.rooms.clear()

    # 1. Create a room
    response = client.post(
        "/api/tour-match/rooms",
        json={
            "name": "Đấu trường Lam Kinh",
            "description": "Ai nhanh nhất sẽ thắng",
            "tour_id": "tour-1"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert "room_id" in data
    room_id = data["room_id"]
    assert len(room_id) == 6

    # 2. Get active waiting rooms
    response = client.get("/api/tour-match/rooms")
    assert response.status_code == 200
    rooms = response.json()
    assert len(rooms) == 1
    assert rooms[0]["room_id"] == room_id
    assert rooms[0]["name"] == "Đấu trường Lam Kinh"
    assert rooms[0]["tour_id"] == "tour-1"
    assert rooms[0]["player_count"] == 0

    # 3. Get room details
    response = client.get(f"/api/tour-match/rooms/{room_id}")
    assert response.status_code == 200
    details = response.json()
    assert details["room_id"] == room_id
    assert details["status"] == "waiting"
    assert details["players"] == []

def test_websocket_multiplayer_flow(client: TestClient):
    manager.rooms.clear()

    # Create room
    response = client.post(
        "/api/tour-match/rooms",
        json={"name": "Race Room", "description": "Quick game", "tour_id": "tour-1"}
    )
    room_id = response.json()["room_id"]

    # Player 1 (Host) joins
    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_player?nickname=Alice"
    ) as ws_host:
        data = ws_host.receive_json()
        assert data["type"] == "room_state"
        room_state = data["room"]
        assert len(room_state["players"]) == 1
        assert room_state["players"][0]["nickname"] == "Alice"
        assert room_state["players"][0]["is_host"] is True

        # Player 2 (Member) joins
        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/member_player?nickname=Bob"
        ) as ws_member:
            # Alice receives update about Bob joining
            data_host = ws_host.receive_json()
            assert data_host["type"] == "room_state"
            assert len(data_host["room"]["players"]) == 2

            # Bob receives initial room state
            data_member = ws_member.receive_json()
            assert data_member["type"] == "room_state"
            assert len(data_member["room"]["players"]) == 2

            # Bob toggles ready
            ws_member.send_json({"type": "toggle_ready"})
            
            # Alice and Bob get ready updates
            update_host = ws_host.receive_json()
            update_member = ws_member.receive_json()
            assert update_host["type"] == "room_state"
            
            bob_state = next(p for p in update_host["room"]["players"] if p["nickname"] == "Bob")
            assert bob_state["is_ready"] is True

            # Alice starts the match
            ws_host.send_json({"type": "start_match"})
            
            start_host = ws_host.receive_json()
            start_member = ws_member.receive_json()
            assert start_host["type"] == "match_started"
            assert start_host["room"]["status"] == "playing"

            # Alice updates progress to 1/2 stops
            ws_host.send_json({"type": "update_progress", "progress": 1, "total_stops": 2})
            
            prog_host = ws_host.receive_json()
            prog_member = ws_member.receive_json()
            assert prog_host["type"] == "room_state"
            alice_state = next(p for p in prog_host["room"]["players"] if p["nickname"] == "Alice")
            assert alice_state["progress"] == 1

            # Alice updates progress to 2/2 stops (finishes first)
            ws_host.send_json({"type": "update_progress", "progress": 2, "total_stops": 2})
            
            win_host = ws_host.receive_json()
            win_member = ws_member.receive_json()
            
            assert win_host["type"] == "match_finished"
            assert win_host["winner_nickname"] == "Alice"
            assert win_host["room"]["status"] == "finished"

def test_websocket_host_controls(client: TestClient):
    manager.rooms.clear()

    # Create room
    response = client.post(
        "/api/tour-match/rooms",
        json={"name": "Lockable Room", "description": "Lobby controls test", "tour_id": "tour-1"}
    )
    room_id = response.json()["room_id"]

    # 1. Connect Host (Alice)
    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_id?nickname=Alice"
    ) as ws_host:
        state1 = ws_host.receive_json()["room"]
        assert state1["is_locked"] is False

        # 2. Host locks the room
        ws_host.send_json({"type": "toggle_lock"})
        state2 = ws_host.receive_json()["room"]
        assert state2["is_locked"] is True

        # 3. Guest (Bob) connects while room is locked
        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/bob_id?nickname=Bob"
        ) as ws_bob:
            # Bob receives initial room state, showing himself as "pending"
            bob_state = ws_bob.receive_json()["room"]
            bob_self = next(p for p in bob_state["players"] if p["player_id"] == "bob_id")
            assert bob_self["status"] == "pending"

            # Alice receives state update, showing Bob is pending
            alice_state = ws_host.receive_json()["room"]
            bob_in_alice = next(p for p in alice_state["players"] if p["player_id"] == "bob_id")
            assert bob_in_alice["status"] == "pending"

            # 4. Host approves Bob
            ws_host.send_json({"type": "approve_player", "target_id": "bob_id"})

            # Bob receives approved state
            bob_state_approved = ws_bob.receive_json()["room"]
            bob_self_approved = next(p for p in bob_state_approved["players"] if p["player_id"] == "bob_id")
            assert bob_self_approved["status"] == "active"

            # Alice receives state update showing Bob is active
            alice_state_approved = ws_host.receive_json()["room"]
            bob_in_alice_approved = next(p for p in alice_state_approved["players"] if p["player_id"] == "bob_id")
            assert bob_in_alice_approved["status"] == "active"

            # 5. Guest (Charlie) connects while room is locked and gets rejected
            from starlette.websockets import WebSocketDisconnect
            with pytest.raises(WebSocketDisconnect) as exc_info_charlie:
                with client.websocket_connect(
                    f"/api/tour-match/ws/{room_id}/charlie_id?nickname=Charlie"
                ) as ws_charlie:
                    # Charlie gets initial status: pending
                    charlie_state = ws_charlie.receive_json()["room"]
                    charlie_self = next(p for p in charlie_state["players"] if p["player_id"] == "charlie_id")
                    assert charlie_self["status"] == "pending"

                    # Alice receives update that Charlie is pending
                    ws_host.receive_json()

                    # Alice rejects Charlie
                    ws_host.send_json({"type": "reject_player", "target_id": "charlie_id"})

                    # Alice receives state update (Charlie removed)
                    ws_host.receive_json()

                    # Charlie's websocket should be closed
                    # Read messages (if any buffered) until exception is raised
                    for _ in range(10):
                        ws_charlie.receive_json()

            assert exc_info_charlie.value.code == 4009

            # 6. Host kicks Bob
            ws_host.send_json({"type": "kick_player", "target_id": "bob_id"})

            # Alice receives state update (Bob removed)
            ws_host.receive_json()

            # Bob's websocket should close
            with pytest.raises(WebSocketDisconnect) as exc_info_bob:
                for _ in range(10):
                    ws_bob.receive_json()
            
            assert exc_info_bob.value.code == 4008


def test_websocket_race_condition_transition(client: TestClient):
    manager.rooms.clear()

    # Create room
    response = client.post(
        "/api/tour-match/rooms",
        json={"name": "Race Room", "description": "Quick game", "tour_id": "tour-1"}
    )
    room_id = response.json()["room_id"]

    # 1. Connect Host (Alice) and Bob
    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_player?nickname=Alice"
    ) as ws_host:
        ws_host.receive_json()
        with client.websocket_connect(
            f"/api/tour-match/ws/{room_id}/member_player?nickname=Bob"
        ) as ws_bob:
            ws_host.receive_json()
            ws_bob.receive_json()

            # Bob toggles ready
            ws_bob.send_json({"type": "toggle_ready"})
            ws_host.receive_json()
            ws_bob.receive_json()

            # Host starts match
            ws_host.send_json({"type": "start_match"})
            ws_host.receive_json()
            ws_bob.receive_json()
            
            # Now, simulate both players disconnecting (page transition)
            # We close their sockets: when we exit the 'with' blocks, the connections are closed.
            
    # Sockets are closed. All players are now offline.
    # Since status is 'playing', room should NOT be deleted immediately.
    room = manager.get_room(room_id)
    assert room is not None
    assert room.status == "playing"
    assert all(not p.is_online for p in room.players.values())
    
    # 2. Bob and Alice reconnect within the 15-second grace period
    with client.websocket_connect(
        f"/api/tour-match/ws/{room_id}/host_player?nickname=Alice"
    ) as ws_host_new:
        state_host = ws_host_new.receive_json()["room"]
        assert state_host["status"] == "playing"
        alice_player = next(p for p in state_host["players"] if p["player_id"] == "host_player")
        assert alice_player["is_online"] is True


