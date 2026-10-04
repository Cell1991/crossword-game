import pytest
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport
from main import app
from app.database.session import init_db


@pytest.mark.asyncio
async def test_match_history_endpoints_and_filtering():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Clear existing history
        await client.delete("/api/history")

        # 1. Create a solo room (1 human player, no bot)
        solo_res = await client.post("/api/rooms", json={
            "host_name": "SoloPlayer",
            "game_mode": "HP",
        })
        assert solo_res.status_code == 200
        solo_pin = solo_res.json()["game_pin"]

        # 2. Create a bot room (1 human player + 1 bot)
        bot_room_res = await client.post("/api/rooms", json={
            "host_name": "HumanHero",
            "game_mode": "HP",
        })
        assert bot_room_res.status_code == 200
        bot_pin = bot_room_res.json()["game_pin"]

        # Join bot into room
        join_bot_res = await client.post(f"/api/rooms/{bot_pin}/join", json={
            "game_pin": bot_pin,
            "player_name": "SparkBot",
            "is_bot": True,
            "bot_difficulty": "easy",
        })
        assert join_bot_res.status_code == 200

        # 3. Fetch match history list
        hist_res = await client.get("/api/history?limit=10")
        assert hist_res.status_code == 200
        data = hist_res.json()
        assert data["success"] is True
        history = data["history"]

        # Assert only the bot match is present, solo match is excluded
        pins_in_history = [h["game_pin"] for h in history]
        assert bot_pin in pins_in_history
        assert solo_pin not in pins_in_history

        # 4. Test 404 for non-existent match replay
        res_404 = await client.get("/api/history/non-existent-game-id")
        assert res_404.status_code == 404

        # 5. Test clear history endpoint
        res_clear = await client.delete("/api/history")
        assert res_clear.status_code == 200
        assert res_clear.json()["success"] is True
