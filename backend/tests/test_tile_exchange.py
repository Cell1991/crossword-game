"""Exchanging tiles: send tiles from your rack back to the bag instead of playing a word.

Follows §5–6 of the unified rules: the bag must still hold at least 7 tiles, asking for more
tiles than the bag holds counts as a pass, and an exchange is a scoreless turn.
Scenario ids (EX-xx) match docs/TEST_SCENARIOS.md.
"""
from collections import Counter

import pytest

from app.game.tiles import TileService


def rack_of(letters: str, prefix: str = "r") -> list[dict]:
    return [{"id": f"{prefix}{index}", "letter": letter, "value": 1} for index, letter in enumerate(letters)]


def letters_of(tiles: list[dict]) -> str:
    return "".join(tile["letter"] for tile in tiles)


# --- TileService.exchange_tiles ------------------------------------------------------------------

def test_ex01_replacements_take_the_seats_of_the_exchanged_tiles():
    new_rack, new_bag = TileService.exchange_tiles(rack_of("ABCDEFG"), rack_of("XYZ", "b"), ["r1", "r3"])

    assert letters_of(new_rack) == "AXCYEFG"
    assert Counter(letters_of(new_bag)) == Counter("ZBD")


def test_ex02_player_never_draws_back_the_tiles_they_returned():
    new_rack, _ = TileService.exchange_tiles(rack_of("QQQAAAA"), rack_of("EEE", "b"), ["r0", "r1", "r2"])

    assert letters_of(new_rack) == "EEEAAAA"


def test_ex03_every_tile_stays_in_play():
    rack, bag = TileService.draw_tiles(TileService.create_tile_bag(), 7)
    chosen = [tile["id"] for tile in rack[:4]]

    new_rack, new_bag = TileService.exchange_tiles(rack, bag, chosen)

    assert len(new_rack) == len(rack)
    assert len(new_bag) == len(bag)
    assert Counter(t["id"] for t in new_rack + new_bag) == Counter(t["id"] for t in rack + bag)
    assert not set(chosen) & {tile["id"] for tile in new_rack}


def test_ex04_bag_with_exactly_enough_tiles_is_allowed():
    new_rack, new_bag = TileService.exchange_tiles(rack_of("ABC"), rack_of("XY", "b"), ["r0", "r2"])

    assert letters_of(new_rack) == "XBY"
    assert Counter(letters_of(new_bag)) == Counter("AC")


@pytest.mark.parametrize("tile_ids, bag_letters, message", [
    ([], "XYZ", "at least one tile"),
    (["r0", "r0"], "XYZ", "only be exchanged once"),
    (["someone-else"], "XYZ", "your own rack"),
    (["r0", "r1", "r2"], "XY", "Not enough tiles in the bag"),
    (["r0"], "", "Not enough tiles in the bag"),
], ids=["no-tiles", "duplicate-tile", "not-in-rack", "bag-too-small", "bag-empty"])
def test_ex05_invalid_exchanges_are_rejected(tile_ids, bag_letters, message):
    with pytest.raises(ValueError, match=message):
        TileService.exchange_tiles(rack_of("ABCDEFG"), rack_of(bag_letters, "b"), tile_ids)


# --- POST /api/games/{game_id}/exchange ----------------------------------------------------------

async def exchange(table, seat, tile_ids):
    return await table.act(seat, "exchange", {"tile_ids": tile_ids})


def player_in(state, seat):
    return next(p for p in state["players"] if p["id"] == seat.id)


async def snapshot(table, seat):
    """Everything an exchange could change, from the seat's point of view."""
    state = await table.state(seat)
    return {
        "rack": player_in(state, seat)["rack"],
        "tile_bag_count": state["tile_bag_count"],
        "turn_number": state["turn_number"],
        "current_player_id": state["current_player_id"],
    }


@pytest.mark.asyncio
async def test_ex10_exchange_swaps_the_chosen_tiles_and_passes_the_turn(open_table, broadcasts):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_tiles(racks={alice: "QQQAEIO"}, bag="STRNLCDEE")
    q_tile_ids = [tile["id"] for tile in (await table.player(alice))["rack"] if tile["letter"] == "Q"]

    res = await exchange(table, alice, q_tile_ids)

    assert res.status_code == 200, res.text
    assert res.json() == {
        "status": "exchanged",
        "exchanged_count": 3,
        "next_player_id": bob.id,
        "turn_number": 2,
        "game_over": False,
        "winner_id": None,
    }
    state = await table.state(alice)
    assert letters_of(player_in(state, alice)["rack"]) == "STRAEIO"
    assert state["tile_bag_count"] == 9
    assert Counter(letters_of(await table.bag()))["Q"] == 3
    assert state["current_player_id"] == bob.id
    assert state["consecutive_passes"] == 1
    assert [(p["score"], p["hp"]) for p in state["players"]] == [(0, 100), (0, 100)]

    [move] = await table.moves()
    assert (move.move_type, move.player_id, move.turn_number, move.score_earned) == ("EXCHANGE", alice.id, 1, 0)

    # Only the count is broadcast; the letters that went back stay private.
    [event] = [message for message in broadcasts if message["type"] == "TILES_EXCHANGED"]
    assert event["payload"] == {"playerId": alice.id, "count": 3, "nextPlayerId": bob.id, "turnNumber": 2}


@pytest.mark.asyncio
async def test_ex11_player_can_exchange_the_whole_rack(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    old_ids = [tile["id"] for tile in (await table.player(alice))["rack"]]

    res = await exchange(table, alice, old_ids)

    assert res.status_code == 200, res.text
    new_rack = (await table.player(alice))["rack"]
    assert len(new_rack) == 7
    assert not set(old_ids) & {tile["id"] for tile in new_rack}
    assert (await table.state())["tile_bag_count"] == 98 - 2 * 7


@pytest.mark.asyncio
async def test_ex12_rack_grown_past_seven_by_a_card_can_be_exchanged_in_full(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_tiles(racks={alice: "ABCDEFGH"}, bag="IJKLMNOPQ")
    rack_ids = [tile["id"] for tile in (await table.player(alice))["rack"]]

    res = await exchange(table, alice, rack_ids)

    assert res.status_code == 200, res.text
    assert letters_of((await table.player(alice))["rack"]) == "IJKLMNOP"


@pytest.mark.asyncio
async def test_ex13_only_the_current_player_can_exchange(open_table):
    table = await open_table("Alice", "Bob")
    _, bob = table.seats
    before = await snapshot(table, bob)

    res = await exchange(table, bob, [before["rack"][0]["id"]])

    assert res.status_code == 403
    assert await snapshot(table, bob) == before


@pytest.mark.asyncio
async def test_ex14_cannot_exchange_an_opponents_tile(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    bobs_tile = (await table.player(bob))["rack"][0]
    before = await snapshot(table, alice)

    res = await exchange(table, alice, [bobs_tile["id"]])

    assert res.status_code == 400
    assert "your own rack" in res.json()["detail"]
    assert await snapshot(table, alice) == before
    assert bobs_tile in (await table.player(bob))["rack"]


@pytest.mark.asyncio
@pytest.mark.parametrize("pick, status, detail", [
    (lambda ids: [ids[0], ids[0]], 400, "only be exchanged once"),
    (lambda ids: [], 422, None),
], ids=["duplicate-tile", "no-tiles"])
async def test_ex15_malformed_requests_change_nothing(open_table, pick, status, detail):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    before = await snapshot(table, alice)

    res = await exchange(table, alice, pick([tile["id"] for tile in before["rack"]]))

    assert res.status_code == status
    if detail:
        assert detail in res.json()["detail"]
    assert await snapshot(table, alice) == before


@pytest.mark.asyncio
@pytest.mark.parametrize("bag, exchanged, status", [
    ("ABCDEF", 1, 400),
    ("", 1, 400),
    ("ABCDEFG", 7, 200),
], ids=["six-left", "bag-empty", "exactly-seven-left"])
async def test_ex16_bag_must_still_hold_seven_tiles(open_table, bag, exchanged, status):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_tiles(racks={alice: "QQQAEIO"}, bag=bag)
    rack_ids = [tile["id"] for tile in (await table.player(alice))["rack"]]

    res = await exchange(table, alice, rack_ids[:exchanged])

    assert res.status_code == status, res.text
    if status == 400:
        assert "at least 7 tiles" in res.json()["detail"]
        assert (await table.state())["current_player_id"] == alice.id


@pytest.mark.asyncio
async def test_ex17_asking_for_more_tiles_than_the_bag_holds_counts_as_a_pass(open_table, broadcasts):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_tiles(racks={alice: "ABCDEFGH"}, bag="IJKLMNO")
    rack_ids = [tile["id"] for tile in (await table.player(alice))["rack"]]

    res = await exchange(table, alice, rack_ids)

    assert res.status_code == 200, res.text
    assert (res.json()["status"], res.json()["exchanged_count"], res.json()["next_player_id"]) == ("passed", 0, bob.id)
    state = await table.state(alice)
    assert letters_of(player_in(state, alice)["rack"]) == "ABCDEFGH"
    assert (state["tile_bag_count"], state["consecutive_passes"]) == (7, 1)
    assert [move.move_type for move in await table.moves()] == ["PASS"]
    assert [m["type"] for m in broadcasts if m["type"] in {"TURN_PASSED", "TILES_EXCHANGED"}] == ["TURN_PASSED"]


@pytest.mark.asyncio
async def test_ex18_exchange_is_refused_outside_an_active_game(open_table):
    table = await open_table("Alice", "Bob", start=False)
    alice, _ = table.seats

    waiting = await exchange(table, alice, ["any-tile"])
    await table.start()
    await table.update_game(status="FINISHED")
    finished = await exchange(table, alice, [(await table.player(alice))["rack"][0]["id"]])

    assert (waiting.status_code, finished.status_code) == (400, 400)
    assert "not currently active" in finished.json()["detail"]


@pytest.mark.asyncio
async def test_ex19_knocked_out_player_cannot_exchange(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.update_player(alice, hp=0)

    res = await exchange(table, alice, [(await table.player(alice))["rack"][0]["id"]])

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_ex20_exchanges_count_towards_the_scoreless_turns_that_end_the_game(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats

    async def exchange_one(seat):
        return await exchange(table, seat, [(await table.player(seat))["rack"][0]["id"]])

    assert (await table.act(alice, "pass")).json()["game_over"] is False
    assert (await exchange_one(bob)).json()["game_over"] is False
    assert (await exchange_one(alice)).json()["game_over"] is False
    assert (await table.state())["consecutive_passes"] == 3

    res = await exchange_one(bob)

    assert res.json()["game_over"] is True
    assert (await table.state())["status"] == "FINISHED"


@pytest.mark.asyncio
async def test_ex21_exchange_on_the_last_turn_ends_the_game(open_table, broadcasts):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.update_game(max_turns=1)

    res = await exchange(table, alice, [(await table.player(alice))["rack"][0]["id"]])

    assert res.status_code == 200, res.text
    assert res.json()["game_over"] is True
    state = await table.state()
    assert (state["status"], state["current_player_id"]) == ("FINISHED", None)
    assert any(message["type"] == "GAME_ENDED" for message in broadcasts)


@pytest.mark.asyncio
async def test_ex22_turn_skips_players_who_left(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats
    assert (await table.act(bob, "leave")).status_code == 200

    res = await exchange(table, alice, [(await table.player(alice))["rack"][0]["id"]])

    assert res.json()["next_player_id"] == carol.id
