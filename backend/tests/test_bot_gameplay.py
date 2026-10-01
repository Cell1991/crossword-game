import pytest
import time
from app.game.board import Board
from app.services.bot_service import BotService
from app.database.session import AsyncSessionLocal
from app.database.models import Game, GamePlayer
from sqlalchemy import select


@pytest.mark.asyncio
async def test_bot_takes_turn_after_human_move(open_table):
    # 1. Open table with Alice (human) and SparkBot [Bot]
    table = await open_table("Alice", "SparkBot [Bot]")
    alice, bot = table.seats

    # 2. Alice plays the first word "CAT" covering center (9, 13)
    await table.set_tiles(racks={alice: "CATSEIO"})
    res = await table.place(alice, Board.CENTER[0], Board.CENTER[1] - 1, "CAT")
    assert res.status_code == 200, res.text

    # 3. Check current turn player is now the Bot
    state = await table.state()
    assert state["current_player_id"] == bot.id
    assert state["status"] == "PLAYING"

    # 4. Plan bot move on backend and measure time
    async with AsyncSessionLocal() as db:
        start_time = time.perf_counter()
        plan = await BotService.plan_bot_move(db, table.game_id, "easy")
        elapsed = (time.perf_counter() - start_time) * 1000

        print(f"\n[TEST] Bot plan generated in {elapsed:.2f}ms: action={plan.get('action')}, word={plan.get('word')}, tiles={len(plan.get('tiles', []))}")
        assert plan["action"] == "MOVE"
        assert len(plan["tiles"]) > 0
        assert elapsed < 500, f"Bot took too long: {elapsed:.2f}ms"

        # 5. Execute bot move now
        res_exec = await BotService.execute_bot_move_now(db, table.game_id, bot.id)
        assert res_exec is not None
        assert res_exec["action"] == "MOVE"
        assert res_exec["score_earned"] > 0

    # 6. Verify game state has progressed and board has new tiles
    new_state = await table.state()
    assert len(new_state["board_state"]) > 3  # Initial CAT had 3 tiles, bot placed more
    assert new_state["turn_number"] == 3


@pytest.mark.asyncio
async def test_bot_as_first_player_on_empty_board(open_table):
    # Test Bot having turn 1 on an empty board
    table = await open_table("Nexus AI [Bot]", "Bob")
    bot, bob = table.seats

    state = await table.state()
    assert state["current_player_id"] == bot.id
    assert len(state["board_state"]) == 0

    async with AsyncSessionLocal() as db:
        plan = await BotService.plan_bot_move(db, table.game_id, "medium")
        assert plan["action"] == "MOVE"
        assert len(plan["tiles"]) >= 2
        # First move must cover center (9, 13)
        center_covered = any(t["row"] == Board.CENTER[0] and t["col"] == Board.CENTER[1] for t in plan["tiles"])
        assert center_covered, "Bot first move must cover center"

        # Execute move
        res_exec = await BotService.execute_bot_move_now(db, table.game_id, bot.id)
        assert res_exec is not None
        assert res_exec["action"] == "MOVE"
        assert res_exec["next_player_id"] == bob.id

    new_state = await table.state()
    assert len(new_state["board_state"]) >= 2
    assert new_state["current_player_id"] == bob.id


@pytest.mark.asyncio
async def test_bot_multiple_turns_continuation(open_table):
    # Test multiple turns back and forth: Alice -> Bot -> Alice -> Bot
    table = await open_table("Alice", "Titan AI [Bot]")
    alice, bot = table.seats

    # Turn 1: Alice places CAT
    await table.set_tiles(racks={alice: "CATSEIO"})
    res1 = await table.place(alice, Board.CENTER[0], Board.CENTER[1] - 1, "CAT")
    assert res1.status_code == 200

    # Turn 2: Bot plays
    async with AsyncSessionLocal() as db:
        bot_res1 = await BotService.execute_bot_move_now(db, table.game_id, bot.id)
        assert bot_res1 is not None and bot_res1["action"] == "MOVE"
        assert bot_res1["next_player_id"] == alice.id

    # Turn 3: Alice passes turn
    res_pass = await table.act(alice, "pass")
    assert res_pass.status_code == 200

    # Turn 4: Bot plays again
    async with AsyncSessionLocal() as db:
        bot_res2 = await BotService.execute_bot_move_now(db, table.game_id, bot.id)
        assert bot_res2 is not None and bot_res2["action"] == "MOVE"
        assert bot_res2["next_player_id"] == alice.id

    state = await table.state()
    assert state["turn_number"] == 5
    assert len(state["board_state"]) >= 5
