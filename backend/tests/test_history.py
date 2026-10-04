import pytest
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport
from main import app
from app.database.session import init_db


@pytest.mark.asyncio
async def test_match_history_endpoints():
    await init_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Fetch match history list
        res = await client.get("/api/history?limit=10")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "history" in data
        assert isinstance(data["history"], list)

        # 2. Test 404 for non-existent match replay
        res_404 = await client.get("/api/history/non-existent-game-id")
        assert res_404.status_code == 404

        # 3. Test clear history endpoint
        res_clear = await client.delete("/api/history")
        assert res_clear.status_code == 200
        assert res_clear.json()["success"] is True
