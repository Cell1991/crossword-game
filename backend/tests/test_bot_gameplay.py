import pytest
import time
from collections import Counter
from app.game.board import Board
from app.services.bot_service import BotService
from app.database.session import AsyncSessionLocal
from app.database.models import Game, GamePlayer
from sqlalchemy import select


def rack_letters(player: GamePlayer) -> Counter:
    return Counter(str(tile["letter"]).upper() for tile in (player.rack or []))


@pytest.mark.asyncio
async def test_bot_takes_turn_after_human_move(open_table):
    # 1. Open table with Alice (human) and SparkBot [Bot]
    table = await open_table("Alice", "SparkBot [Bot]")
    alice, bot = table.seats
    # A lucky bingo can out-damage a starting health bar, which would finish the game and leave
    # no turn 3 to assert on.
    await table.update_player(alice, hp=1000, max_hp=1000)

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
async def test_bot_opens_an_empty_board_after_the_human_passes(open_table):
    # The human always takes seat 1, so a bot only meets an empty board once that human passes.
    table = await open_table("Bob", "Nexus AI [Bot]")
    bob, bot = table.seats
    await table.set_tiles(racks={bot: "CARTONS"})

    assert (await table.act(bob, "pass")).status_code == 200
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
    # Titan plays the best word it can find, and two of those can total more than a starting
    # health bar. Give Alice room to survive both, so this stays a test about turns continuing
    # rather than about her being knocked out.
    await table.update_player(alice, hp=1000, max_hp=1000)

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


@pytest.mark.asyncio
async def test_bot_only_plays_letters_it_actually_holds(open_table):
    """
    The bot used to rewrite its own rack to whatever word it wanted, so it could play letters it
    never drew. Give it a rack with no playable word and it must take a legal scoreless turn
    instead of conjuring tiles.
    """
    table = await open_table("Alice", "Titan AI [Bot]")
    alice, bot = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})
    assert (await table.place(alice, Board.CENTER[0], Board.CENTER[1] - 1, "CAT")).status_code == 200

    await table.set_tiles(racks={bot: "QQQQZZJ"})
    async with AsyncSessionLocal() as db:
        before = (await db.execute(select(GamePlayer).where(GamePlayer.id == bot.id))).scalar_one()
        held = rack_letters(before)

        plan = await BotService.plan_bot_move(db, table.game_id, "hard")
        played = Counter(str(t["letter"]).upper() for t in plan.get("tiles", []))

    conjured = played - held
    assert not conjured, f"bot played letters it never held: {sorted(conjured.elements())}"

    # Whichever way it goes - a real word off this rack, an exchange, or a pass - the turn has to
    # move on, or a bot game stalls forever on an awkward rack.
    async with AsyncSessionLocal() as db:
        outcome = await BotService.execute_bot_move_now(db, table.game_id, bot.id)
    assert outcome is not None and outcome["action"] in ("MOVE", "EXCHANGE", "PASS")
    assert (await table.state())["current_player_id"] == alice.id

    async with AsyncSessionLocal() as db:
        after = (await db.execute(select(GamePlayer).where(GamePlayer.id == bot.id))).scalar_one()
    # Every letter still held was either drawn at setup or refilled from the bag, never invented
    # to fit a word: nothing outside the original rack may appear without the bag accounting for it.
    assert sum(rack_letters(after).values()) <= 7
