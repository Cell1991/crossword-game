import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.database.session import init_db, engine
from app.database.models import Base
from main import app

@pytest_asyncio.fixture(autouse=True)
async def prepare_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_full_game_api_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}

        # 2. Create room
        res = await client.post("/api/rooms", json={"host_name": "Alice"})
        assert res.status_code == 200
        create_data = res.json()
        assert "game_pin" in create_data
        assert len(create_data["game_pin"]) == 6
        game_pin = create_data["game_pin"]
        host_token = create_data["session_token"]
        host_id = create_data["host_player_id"]
        game_id = create_data["game_id"]

        # 3. Join room as Bob
        res = await client.post(f"/api/rooms/{game_pin}/join", json={
            "game_pin": game_pin,
            "player_name": "Bob"
        })
        assert res.status_code == 200
        join_data = res.json()
        assert join_data["display_name"] == "Bob"
        assert not join_data["is_host"]
        bob_token = join_data["session_token"]
        bob_id = join_data["player_id"]

        # 4. Get room details
        res = await client.get(f"/api/rooms/{game_pin}")
        assert res.status_code == 200
        room_info = res.json()
        assert len(room_info["players"]) == 2
        assert room_info["status"] == "WAITING"

        # 5. Non-host start game should fail (403)
        res = await client.post(
            f"/api/rooms/{game_pin}/start",
            headers={"X-Player-ID": bob_id}
        )
        assert res.status_code == 403

        # 6. Host starts game
        res = await client.post(
            f"/api/rooms/{game_pin}/start",
            headers={"X-Player-ID": host_id}
        )
        assert res.status_code == 200
        assert res.json()["status"] == "started"

        # 7. Get game state for Alice
        res = await client.get(f"/api/games/{game_id}?token={host_token}")
        assert res.status_code == 200
        game_state = res.json()
        assert game_state["status"] == "PLAYING"
        assert game_state["current_player_id"] == host_id
        alice_player = next(p for p in game_state["players"] if p["id"] == host_id)
        assert alice_player["rack"] is not None
        assert len(alice_player["rack"]) == 7

        # 8. Pass turn
        res = await client.post(
            f"/api/games/{game_id}/pass",
            headers={"X-Player-ID": host_id}
        )
        assert res.status_code == 200
        pass_data = res.json()
        assert pass_data["status"] == "passed"
        assert pass_data["next_player_id"] == bob_id

        # 9. Non-active player cannot pass
        res = await client.post(
            f"/api/games/{game_id}/pass",
            headers={"X-Player-ID": host_id}
        )
        assert res.status_code == 403

        # 10. Bob's turn - test move validation
        res = await client.get(f"/api/games/{game_id}?token={bob_token}")
        bob_state = res.json()
        bob_player = next(p for p in bob_state["players"] if p["id"] == bob_id)
        bob_rack = bob_player["rack"]

        # If Bob tries to place letters not in his rack
        res = await client.post(
            f"/api/games/{game_id}/moves/validate",
            headers={"X-Player-ID": bob_id},
            json={"placed_tiles": [{"row": 7, "col": 7, "tile_id": "fake", "letter": "Z", "value": 10}]}
        )
        assert res.status_code == 200
        # If 'Z' is not in rack, valid is False
        if not any(t["letter"] == "Z" for t in bob_rack):
            assert not res.json()["valid"]


@pytest.mark.asyncio
async def test_current_player_leaving_advances_turn():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = (await client.post("/api/rooms", json={"host_name": "Alice"})).json()
        joined = (await client.post(f"/api/rooms/{created['game_pin']}/join", json={
            "game_pin": created["game_pin"], "player_name": "Bob"
        })).json()
        await client.post(f"/api/rooms/{created['game_pin']}/start", headers={"X-Player-ID": created["host_player_id"]})

        response = await client.post(
            f"/api/games/{created['game_id']}/leave",
            headers={"X-Player-ID": created["host_player_id"]},
        )

        assert response.status_code == 200
        assert response.json()["next_player_id"] == joined["player_id"]

        state = (await client.get(f"/api/games/{created['game_id']}?token={joined['session_token']}")).json()
        assert state["current_player_id"] == joined["player_id"]


@pytest.mark.asyncio
async def test_custom_starting_hp():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create room with 50 starting HP
        res = await client.post("/api/rooms", json={"host_name": "Alice", "game_mode": "HP", "starting_hp": 50})
        assert res.status_code == 200
        created = res.json()
        assert created["starting_hp"] == 50

        # Room details have starting_hp
        room_res = await client.get(f"/api/rooms/{created['game_pin']}")
        assert room_res.status_code == 200
        assert room_res.json()["starting_hp"] == 50

        # Join second player
        joined = (await client.post(f"/api/rooms/{created['game_pin']}/join", json={
            "game_pin": created["game_pin"], "player_name": "Bob"
        })).json()

        # Start game
        start_res = await client.post(f"/api/rooms/{created['game_pin']}/start", headers={"X-Player-ID": created["host_player_id"]})
        assert start_res.status_code == 200

        # Game state shows starting_hp and players start with 50 HP and max_hp 50
        state = (await client.get(f"/api/games/{created['game_id']}?token={created['session_token']}")).json()
        assert state["starting_hp"] == 50
        assert len(state["players"]) == 2
        for p in state["players"]:
            assert p["hp"] == 50
            assert p["max_hp"] == 50

@pytest.mark.asyncio
async def test_list_rooms():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a room
        res = await client.post("/api/rooms", json={
            "host_name": "HostUser",
            "game_mode": "HP",
            "starting_hp": 100,
            "turn_time_limit": 60,
        })
        assert res.status_code == 200
        created = res.json()

        # List rooms
        list_res = await client.get("/api/rooms")
        assert list_res.status_code == 200
        rooms = list_res.json()
        assert len(rooms) >= 1
        found = next((r for r in rooms if r["game_pin"] == created["game_pin"]), None)
        assert found is not None
        assert found["host_name"] == "HostUser"
        assert found["status"] == "WAITING"
        assert found["player_count"] == 1
        assert found["game_mode"] == "HP"
        assert found["starting_hp"] == 100
        assert found["turn_time_limit"] == 60

@pytest.mark.asyncio
async def test_room_expiration():
    from datetime import datetime, timezone, timedelta
    from app.database.session import AsyncSessionLocal
    from app.database.models import GameRoom
    from app.services.room_service import RoomService

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a room
        res = await client.post("/api/rooms", json={"host_name": "TestHost"})
        assert res.status_code == 200
        pin = res.json()["game_pin"]

        # Fast forward room created_at to 11 minutes ago
        async with AsyncSessionLocal() as db:
            from sqlalchemy import select
            room = (await db.execute(select(GameRoom).where(GameRoom.game_pin == pin))).scalar_one()
            room.created_at = datetime.now(timezone.utc) - timedelta(minutes=11)
            await db.commit()

        # 1. Attempting to get room details should return 410 Gone
        get_res = await client.get(f"/api/rooms/{pin}")
        assert get_res.status_code == 410
        assert "expired" in get_res.json()["detail"].lower()

        # 2. Attempting to join should return 410 Gone
        join_res = await client.post(f"/api/rooms/{pin}/join", json={"game_pin": pin, "player_name": "LatePlayer"})
        assert join_res.status_code == 410

        # 3. Active rooms list should not include this expired room
        list_res = await client.get("/api/rooms")
        assert list_res.status_code == 200
        rooms = list_res.json()
        assert not any(r["game_pin"] == pin for r in rooms)

