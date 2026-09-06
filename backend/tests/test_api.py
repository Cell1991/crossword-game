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
            json={"placed_tiles": [{"row": 31, "col": 31, "tile_id": "fake", "letter": "Z", "value": 10}]}
        )
        assert res.status_code == 200
        # If 'Z' is not in rack, valid is False
        if not any(t["letter"] == "Z" for t in bob_rack):
            assert not res.json()["valid"]

