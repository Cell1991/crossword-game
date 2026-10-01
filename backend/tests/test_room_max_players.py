import pytest
from app.services.room_service import RoomService
from app.database.session import AsyncSessionLocal
from app.database.models import GameRoom
from sqlalchemy import select


@pytest.mark.asyncio
async def test_create_room_with_10_players(client):
    res = await client.post("/api/rooms", json={
        "host_name": "TestHost",
        "turn_time_limit": None,
        "game_mode": "HP",
        "starting_hp": 100,
        "max_players": 10,
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["max_players"] == 10, f"Expected 10, got {data['max_players']}"

    # Verify in DB
    async with AsyncSessionLocal() as db:
        room = (await db.execute(select(GameRoom).where(GameRoom.game_pin == data["game_pin"]))).scalar_one_or_none()
        assert room is not None
        assert room.max_players == 10
