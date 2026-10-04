import pytest
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport
from main import app
from app.database.models import Base, Game, GamePlayer, GameRoom, Move
from app.database.session import AsyncSessionLocal, engine, init_db


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

        # 2.5 Create a debug room with bot (is_debug=True)
        debug_room_res = await client.post("/api/rooms", json={
            "host_name": "DebugTester",
            "game_mode": "HP",
            "is_debug": True,
        })
        assert debug_room_res.status_code == 200
        debug_pin = debug_room_res.json()["game_pin"]
        debug_game_id = debug_room_res.json()["game_id"]

        # Join bot into debug room
        await client.post(f"/api/rooms/{debug_pin}/join", json={
            "game_pin": debug_pin,
            "player_name": "DebugBot",
            "is_bot": True,
            "bot_difficulty": "easy",
        })

        # 3. Fetch match history list (default limit=50)
        hist_res = await client.get("/api/history")
        assert hist_res.status_code == 200
        data = hist_res.json()
        assert data["success"] is True
        history = data["history"]

        # Assert only normal bot match is present; solo match and debug match are excluded
        pins_in_history = [h["game_pin"] for h in history]
        assert bot_pin in pins_in_history
        assert solo_pin not in pins_in_history
        assert debug_pin not in pins_in_history

        # 4. Test 404 for non-existent or debug match replay
        res_404 = await client.get("/api/history/non-existent-game-id")
        assert res_404.status_code == 404
        res_debug_404 = await client.get(f"/api/history/{debug_game_id}")
        assert res_debug_404.status_code == 404

        # 5. Test clear history endpoint
        res_clear = await client.delete("/api/history")
        assert res_clear.status_code == 200
        assert res_clear.json()["success"] is True


@pytest.mark.asyncio
async def test_replay_merges_reactive_card_into_other_players_turn():
    """A legacy standalone CARD_USED move (e.g. SHIELD cast by PlayerA) sharing a turn_number
    with a real PLACE move by PlayerB must be merged into PlayerB's move, not left as its own
    separate move/turn in the replay."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db_session:
        room = GameRoom(
            id="game-reactive-card", game_pin="999666", host_player_id="pA",
            game_mode="HP", starting_hp=100, max_players=2, status="FINISHED",
        )
        game = Game(
            id="game-reactive-card", status="FINISHED", current_player_id="pB",
            turn_number=2, starting_hp=100, tile_bag=[], board_state={},
        )
        pA = GamePlayer(
            id="pA", game_id=game.id, display_name="PlayerA",
            hp=100, max_hp=100, turn_order=0, connection_status="ONLINE", session_token="tok_a",
        )
        pB = GamePlayer(
            id="pB", game_id=game.id, display_name="PlayerB",
            hp=100, max_hp=100, turn_order=1, connection_status="ONLINE", session_token="tok_b",
        )
        shield_move = Move(
            id="move-shield", game_id=game.id, player_id="pA", turn_number=1,
            move_type="CARD_USED", placed_tiles=[], words_formed=[], score_earned=0,
            card_details={"card": "SHIELD", "description": "Activated Shield protection"},
        )
        place_move = Move(
            id="move-place", game_id=game.id, player_id="pB", turn_number=1,
            move_type="PLACE", placed_tiles=[{"row": 9, "col": 13, "letter": "A", "value": 1}],
            words_formed=[{"word": "CAT"}], score_earned=5,
        )
        db_session.add_all([room, game, pA, pB, shield_move, place_move])
        await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/history/game-reactive-card")
        assert res.status_code == 200
        moves = res.json()["moves"]

        # Only PlayerB's turn move should be present -- the shield must NOT be a standalone move.
        assert len(moves) == 1
        merged = moves[0]
        assert merged["player_id"] == "pB"
        assert merged["words_formed"][0]["word"] == "CAT"

        cards = merged["card_details"]
        assert cards and len(cards) == 1
        assert cards[0]["card"] == "SHIELD"
        # The merged card event must still be attributed to the player who actually cast it.
        assert cards[0]["player_id"] == "pA"
        assert cards[0]["player_name"] == "PlayerA"
