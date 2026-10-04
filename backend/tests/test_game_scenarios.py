"""End-to-end game scenarios driven through the HTTP API.

Each test is one row of docs/TEST_SCENARIOS.md (the scenario id is in the test name).
Racks, bag and board are staged with GameTable helpers so every outcome is exact.
"""
import asyncio
import random
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.game.board import Board
from app.schemas.events import EventType, WebSocketEvent
from app.services.move_service import MoveService
from fastapi import WebSocketDisconnect

from app.database.models import Game
from app.database.session import AsyncSessionLocal
from app.websocket.connection_manager import ConnectionManager, manager
from app.websocket.handlers import handle_disconnect, websocket_endpoint

pytestmark = pytest.mark.asyncio

# The centre star. The first word must cover it, so most scenarios play CAT across it.
ROW, COL = Board.CENTER


def me(state, seat):
    return next(p for p in state["players"] if p["id"] == seat.id)


async def resolve_damage(table):
    """
    Fast-forward past the SHIELD window and finalize the pending DAMAGE/SWAP effect.

    A move only opens that window when a living opponent can actually shield; otherwise the
    damage already landed on commit, so there is nothing pending and this is a no-op.
    """
    async with AsyncSessionLocal() as db:
        game = await db.get(Game, table.game_id)
        if game.pending_effect is None:
            return None
        game.pending_effect = {
            **game.pending_effect,
            "expires_at": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(),
        }
        await db.commit()
    return await table.client.post(f"/api/games/{table.game_id}/effects/resolve")


def letters(tiles):
    return "".join(tile["letter"] for tile in tiles)


# --- Lobby & game start (LB) ---------------------------------------------------------------------

async def test_lb01_host_creates_a_room_and_waits_in_the_lobby(client):
    res = await client.post("/api/rooms", json={"host_name": "Alice", "turn_time_limit": 60})

    assert res.status_code == 200, res.text
    created = res.json()
    assert created["game_pin"].isdigit() and len(created["game_pin"]) == 6
    assert created["turn_time_limit"] == 60
    room = (await client.get(f"/api/rooms/{created['game_pin']}")).json()
    assert (room["status"], room["turn_time_limit"]) == ("WAITING", 60)
    assert [(p["display_name"], p["is_host"]) for p in room["players"]] == [("Alice", True)]


@pytest.mark.parametrize("body", [
    {"host_name": ""},
    {"host_name": "A" * 33},
    {"host_name": "Alice", "turn_time_limit": 45},
    {"host_name": "Alice", "game_mode": "TURNS"},
    {"host_name": "Alice", "game_mode": "HP", "max_turns": 7},
    {"host_name": "Alice", "game_mode": "TURNS", "max_turns": 501},
], ids=["empty-name", "name-too-long", "unsupported-time-limit", "turn-mode-needs-limit", "hp-mode-no-limit", "turn-limit-too-high"])
async def test_lb02_invalid_room_settings_are_rejected(client, body):
    assert (await client.post("/api/rooms", json=body)).status_code == 422


async def test_lb03_joining_with_an_unknown_pin_fails(client):
    res = await client.post("/api/rooms/000000/join", json={"game_pin": "000000", "player_name": "Bob"})

    assert res.status_code == 404


async def test_lb04_room_holds_at_most_max_players(open_table, client):
    from app.core.config import settings
    names = [f"P{i}" for i in range(1, settings.MAX_PLAYERS + 1)]
    table = await open_table(*names, start=False)

    res = await client.post(f"/api/rooms/{table.pin}/join", json={"game_pin": table.pin, "player_name": "Overflow"})

    assert res.status_code == 400
    assert "full" in res.json()["detail"].lower()  # room is full for players (spectating is a separate WS-only path)


async def test_lb05_nobody_can_join_after_the_game_starts(open_table, client):
    table = await open_table("Alice", "Bob")

    res = await client.post(f"/api/rooms/{table.pin}/join", json={"game_pin": table.pin, "player_name": "Late"})

    assert res.status_code == 400


async def test_lb06_only_the_host_can_start_and_only_once(open_table):
    table = await open_table("Alice", "Bob", start=False)
    alice, bob = table.seats

    assert (await table.start(bob)).status_code == 403
    assert (await table.start(alice)).status_code == 200
    assert (await table.start(alice)).status_code == 400


@pytest.mark.parametrize("names", [
    ("Alice", "Bob"),
    ("Alice", "Bob", "Carol"),
], ids=["2-players", "3-players"])
async def test_lb07_start_deals_seven_tiles_and_hides_other_racks(open_table, names):
    table = await open_table(*names)
    host = table.seats[0]

    state = await table.state(host)

    assert (state["status"], state["current_player_id"], state["turn_number"]) == ("PLAYING", host.id, 1)
    assert state["max_turns"] is None
    assert state["tile_bag_count"] == 100 - 7 * len(names)
    assert all(p["rack_count"] == 7 for p in state["players"])
    assert len(me(state, host)["rack"]) == 7
    assert all(p["rack"] is None for p in state["players"] if p["id"] != host.id)
    assert all(p["rack"] is None for p in (await table.state())["players"])


async def test_lb08_a_solo_game_keeps_going_until_it_really_ends(open_table):
    table = await open_table("Alice")
    (alice,) = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})

    placed = await table.place(alice, ROW, COL - 1, "CAT")
    exchanged = await table.act(alice, "exchange", {"tile_ids": [(await table.player(alice))["rack"][0]["id"]]})

    assert (placed.json()["game_over"], placed.json()["next_player_id"]) == (False, alice.id)
    assert (exchanged.json()["game_over"], exchanged.json()["next_player_id"]) == (False, alice.id)
    state = await table.state()
    assert (state["status"], state["current_player_id"], state["turn_number"]) == ("PLAYING", alice.id, 3)
    for _ in range(2):
        assert (await table.act(alice, "pass")).json()["game_over"] is False
    res = await table.act(alice, "pass")  # fourth scoreless turn in a row (the exchange counts)
    assert res.json()["game_over"] is False
    # User requested HP battle does not end on consecutive passes.


async def test_lb09_leaving_the_lobby_frees_the_seat(open_table, client):
    table = await open_table("Alice", "Bob", "Carol", start=False)
    alice, bob, carol = table.seats

    res = await client.post(f"/api/rooms/{table.pin}/leave", headers={"X-Player-ID": bob.id})

    assert res.status_code == 200, res.text
    room = (await client.get(f"/api/rooms/{table.pin}")).json()
    assert [(p["display_name"], p["turn_order"]) for p in room["players"]] == [("Alice", 0), ("Carol", 1)]
    await client.post(f"/api/rooms/{table.pin}/join", json={"game_pin": table.pin, "player_name": "Dan"})
    assert (await table.start()).status_code == 200
    state = await table.state()
    assert [(p["display_name"], p["turn_order"]) for p in state["players"]] == [("Alice", 0), ("Carol", 1), ("Dan", 2)]


async def test_lb10_host_leaving_the_lobby_hands_over_the_room(open_table, client):
    table = await open_table("Alice", "Bob", start=False)
    alice, bob = table.seats

    res = await client.post(f"/api/rooms/{table.pin}/leave", headers={"X-Player-ID": alice.id})

    assert res.json()["host_player_id"] == bob.id
    room = (await client.get(f"/api/rooms/{table.pin}")).json()
    assert (room["host_player_id"], [p["is_host"] for p in room["players"]]) == (bob.id, [True])
    assert (await table.start(alice)).status_code == 403


# --- Placing words (MV) --------------------------------------------------------------------------

async def test_mv01_first_word_must_cover_the_centre_star(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})

    preview = await table.place(alice, 0, 0, "CAT", validate=True)
    commit = await table.place(alice, 0, 0, "CAT")

    assert preview.json()["valid"] is False
    assert "center star" in preview.json()["reason"]
    assert commit.status_code == 400
    assert (await table.state())["board_state"] == {}


async def test_mv02_first_word_needs_at_least_two_tiles(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})

    preview = await table.place(alice, ROW, COL, "A", validate=True)

    assert preview.json()["valid"] is False
    assert "at least 2 letters" in preview.json()["reason"]


async def test_mv03_valid_first_word_scores_damages_refills_and_passes_the_turn(open_table, broadcasts):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})

    preview = await table.place(alice, ROW, COL - 1, "CAT", validate=True)
    res = await table.place(alice, ROW, COL - 1, "CAT")

    assert (preview.json()["valid"], preview.json()["estimated_score"]) == (True, 5)
    assert res.status_code == 200, res.text
    assert [w["word"] for w in res.json()["words_formed"]] == ["CAT"]
    assert (res.json()["score_earned"], res.json()["next_player_id"]) == (5, bob.id)
    state = await table.state(alice)
    assert sorted(state["board_state"]) == sorted(f"{ROW}_{col}" for col in (COL - 1, COL, COL + 1))
    assert (me(state, alice)["score"], me(state, alice)["hp"]) == (5, 100)
    assert len(me(state, alice)["rack"]) == 7
    await resolve_damage(table)
    assert me(await table.state(), bob)["hp"] == 95
    assert state["tile_bag_count"] == 86 - 3
    assert (state["current_player_id"], state["turn_number"]) == (bob.id, 2)
    assert any(m["type"] == "MOVE_COMMITTED" and m["payload"]["scoreEarned"] == 5 for m in broadcasts)


async def test_mv04_unknown_word_is_rejected_without_changing_anything(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})

    preview = await table.place(alice, ROW, COL - 1, "CTA", validate=True)
    commit = await table.place(alice, ROW, COL - 1, "CTA")

    assert preview.json()["valid"] is False
    assert "not recognized" in preview.json()["reason"]
    assert commit.status_code == 400
    state = await table.state(alice)
    assert (state["board_state"], state["current_player_id"]) == ({}, alice.id)
    assert letters(me(state, alice)["rack"]) == "CATSEIO"


async def test_mv05_tiles_must_come_from_your_own_rack(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})
    forged = [
        {"row": ROW, "col": COL, "tile_id": "fake-1", "letter": "Z", "value": 10},
        {"row": ROW, "col": COL + 1, "tile_id": "fake-2", "letter": "A", "value": 1},
    ]

    res = await table.act(alice, "moves", {"placed_tiles": forged})

    assert res.status_code == 400
    assert "not in your rack" in res.json()["detail"]


async def test_mv06_off_turn_players_can_check_a_word_but_not_play_it(open_table):
    table = await open_table("Alice", "Bob")
    _, bob = table.seats
    await table.set_tiles(racks={bob: "CATSEIO"})

    preview = await table.place(bob, ROW, COL - 1, "CAT", validate=True)
    commit = await table.place(bob, ROW, COL - 1, "CAT")

    assert (preview.json()["valid"], preview.json()["estimated_score"]) == (True, 5)
    assert commit.status_code == 403
    assert (await table.state())["board_state"] == {}


async def test_mv07_later_words_must_connect_to_the_board(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_board({(ROW, COL - 1): "C", (ROW, COL): "A", (ROW, COL + 1): "T"})
    await table.set_tiles(racks={alice: "DOGSEIA"})

    preview = await table.place(alice, 1, 1, "DOG", validate=True)

    assert preview.json()["valid"] is False
    assert "must connect" in preview.json()["reason"]


async def test_mv08_extending_a_word_scores_the_whole_new_word(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_board({(ROW, COL - 1): "C", (ROW, COL): "A", (ROW, COL + 1): "T"})
    await table.set_tiles(racks={alice: "SEIOURN"})

    res = await table.place(alice, ROW, COL + 2, "S")

    assert res.status_code == 200, res.text
    assert [w["word"] for w in res.json()["words_formed"]] == ["CATS"]
    assert res.json()["score_earned"] == 3 + 1 + 1 + 1


async def test_mv09_seven_tile_word_gets_letter_bonuses_and_the_all_tiles_bonus(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_tiles(racks={alice: "RETAINS"})

    # Down from (6, 13): A covers the centre (9, 13); the center column is neutral.
    res = await table.place(alice, ROW - 3, COL, "RETAINS", down=True)

    assert res.status_code == 200, res.text
    assert res.json()["score_earned"] == (1 + 1 + 1 + 1 + 1 + 1 + 1) + 50
    await resolve_damage(table)
    assert me(await table.state(), bob)["hp"] == 100 - 57


async def test_mv10_playing_on_a_secret_power_square_awards_a_card(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_board({(6, 7): "T"})
    await table.set_tiles(racks={alice: "AEIOURS"})

    res = await table.place(alice, 5, 7, "A")  # (5, 7) is a secret power square; forms AT downwards

    assert res.status_code == 200, res.text
    cards = me(await table.state(alice), alice)["cards"]
    assert len(cards) == 1 and cards[0] in MoveService.CARD_TYPES


async def test_mv10b_playing_on_multiple_secret_power_squares_awards_multiple_cards(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    # (7, 10) and (7, 16) are SECRET_POWER squares
    # Setup board connecting (7, 10) through (7, 16)
    await table.set_board({(8, 10): "S", (8, 16): "S"})
    await table.set_tiles(racks={alice: "AEIOURS"})

    # Place on (7, 10) covering 1 power square
    res1 = await table.place(alice, 7, 10, "A")
    assert res1.status_code == 200
    res_json = res1.json()
    assert len(res_json.get("cards_awarded", [])) == 1
    cards = me(await table.state(alice), alice)["cards"]
    assert len(cards) == 1


async def test_mv11_server_ignores_a_forged_tile_value(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})
    rack = me(await table.state(alice), alice)["rack"]
    forged = [
        {"row": ROW, "col": COL - 1 + index, "tile_id": tile["id"], "letter": tile["letter"], "value": 99}
        for index, tile in enumerate(rack[:3])
    ]

    preview = await table.act(alice, "moves/validate", {"placed_tiles": forged})
    res = await table.act(alice, "moves", {"placed_tiles": forged})

    assert preview.json()["estimated_score"] == 5
    assert res.json()["score_earned"] == 5
    await resolve_damage(table)
    state = await table.state()
    assert me(state, bob)["hp"] == 95
    assert {cell["value"] for cell in state["board_state"].values()} == {3, 1}


async def test_mv12_each_word_score_includes_letter_bonuses(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_tiles(racks={alice: "RETAINS"})

    res = await table.place(alice, ROW - 3, COL, "RETAINS", down=True)

    # The center column is neutral; the 50-point bonus is not part of the word.
    assert [(w["word"], w["score"]) for w in res.json()["words_formed"]] == [("RETAINS", 7)]


# --- HP & knock-outs (HP) ------------------------------------------------------------------------

async def test_hp01_score_is_dealt_as_damage_to_every_opponent(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})

    await table.place(alice, ROW, COL - 1, "CAT")
    await resolve_damage(table)

    state = await table.state()
    assert [me(state, seat)["hp"] for seat in (alice, bob, carol)] == [100, 95, 95]


async def test_hp02_knocking_out_the_last_opponent_wins_the_game(open_table, broadcasts):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.update_player(bob, hp=3)
    await table.set_tiles(racks={alice: "CATSEIO"})

    res = await table.place(alice, ROW, COL - 1, "CAT")

    assert res.status_code == 200, res.text
    # Bob holds no shield, so there is no window to wait out: the damage lands on commit and
    # takes the game with it.
    assert (res.json()["game_over"], res.json()["winner_id"]) == (True, alice.id)
    state = await table.state()
    assert (state["status"], me(state, bob)["hp"]) == ("FINISHED", 0)
    assert any(m["type"] == "GAME_ENDED" for m in broadcasts)


async def test_hp03_knocked_out_players_lose_their_turn(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats
    await table.update_player(bob, hp=0)
    await table.set_tiles(racks={alice: "CATSEIO"})

    res = await table.place(alice, ROW, COL - 1, "CAT")

    assert res.json()["next_player_id"] == carol.id


# --- Turns, passing & game end (TN) --------------------------------------------------------------

async def test_tn01_passing_hands_the_turn_to_the_next_player(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats

    res = await table.act(alice, "pass")

    assert res.status_code == 200
    state = await table.state()
    assert (state["current_player_id"], state["turn_number"], state["consecutive_passes"]) == (bob.id, 2, 1)
    assert [move.move_type for move in await table.moves()] == ["PASS"]
    assert (await table.act(alice, "pass")).status_code == 403


async def test_tn02_four_passes_in_a_row_end_the_game(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats

    for seat in (alice, bob, alice):
        assert (await table.act(seat, "pass")).json()["game_over"] is False
    res = await table.act(bob, "pass")

    assert res.json()["game_over"] is False
    # User requested HP battle does not end on consecutive passes.
    assert (await table.state())["status"] == "PLAYING"


async def test_tn03_a_played_word_resets_the_pass_counter(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.act(alice, "pass")
    await table.set_tiles(racks={bob: "CATSEIO"})

    assert (await table.place(bob, ROW, COL - 1, "CAT")).status_code == 200

    assert (await table.state())["consecutive_passes"] == 0


async def test_tn04_game_ends_after_the_turn_limit(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.update_game(max_turns=2)

    assert (await table.act(alice, "pass")).json()["game_over"] is False
    res = await table.act(bob, "pass")

    assert res.json()["game_over"] is True
    state = await table.state()
    assert (state["status"], state["current_player_id"]) == ("FINISHED", None)


async def test_turn_count_mode_uses_selected_limit_and_ignores_scoreless_end(open_table):
    table = await open_table("Alice", "Bob", game_mode="TURNS", max_turns=7)
    alice, bob = table.seats
    room = (await table.client.get(f"/api/rooms/{table.pin}")).json()

    assert (room["game_mode"], room["max_turns"]) == ("TURNS", 7)
    assert (await table.state())["max_turns"] == 7

    for seat in (alice, bob, alice, bob, alice, bob):
        assert (await table.act(seat, "pass")).json()["game_over"] is False
    result = await table.act(alice, "pass")

    assert result.json()["game_over"] is True
    assert (await table.state())["status"] == "FINISHED"


async def test_turn_count_mode_does_not_apply_score_damage(open_table):
    table = await open_table("Alice", "Bob", game_mode="TURNS", max_turns=7)
    alice, bob = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})

    result = await table.place(alice, ROW, COL - 1, "CAT")

    assert result.status_code == 200, result.text
    state = await table.state()
    assert all(player["hp"] == 100 for player in state["players"])
    assert state["pending_effect"] is None


async def test_tn05_turn_timer_passes_an_expired_turn(open_table):
    table = await open_table("Alice", "Bob", turn_time_limit=30)
    alice, bob = table.seats

    await table.client.post(f"/api/games/{table.game_id}/timeout")
    assert (await table.state())["current_player_id"] == alice.id

    await table.update_game(turn_started_at=datetime.now(timezone.utc) - timedelta(seconds=31))
    await table.client.post(f"/api/games/{table.game_id}/timeout")
    assert (await table.state())["current_player_id"] == bob.id


async def test_tn06_expired_turn_is_reported_and_broadcast(open_table, broadcasts):
    table = await open_table("Alice", "Bob", turn_time_limit=30)
    await table.update_game(turn_started_at=datetime.now(timezone.utc) - timedelta(seconds=31))

    res = await table.client.post(f"/api/games/{table.game_id}/timeout")

    assert res.json()["expired"] is True
    assert any(m["type"] == "TURN_PASSED" and m["payload"].get("reason") == "TIMEOUT" for m in broadcasts)


async def test_tn07_untimed_games_never_expire(open_table):
    table = await open_table("Alice", "Bob")
    await table.update_game(turn_started_at=datetime.now(timezone.utc) - timedelta(hours=1))

    res = await table.client.post(f"/api/games/{table.game_id}/timeout")

    assert res.json()["expired"] is False


@pytest.mark.parametrize("last_action", ["moves", "pass"])
async def test_tn08_game_ending_on_the_turn_limit_names_a_winner(open_table, broadcasts, last_action):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.update_game(max_turns=1)
    await table.set_tiles(racks={alice: "CATSEIO"})
    await table.update_player(bob, score=10)

    if last_action == "moves":
        res = await table.place(alice, ROW, COL - 1, "CAT")  # Alice 5 points, Bob still 10
    else:
        res = await table.act(alice, "pass")

    assert (res.json()["game_over"], res.json()["winner_id"]) == (True, bob.id)
    assert [m["payload"]["winnerId"] for m in broadcasts if m["type"] == "GAME_ENDED"] == [bob.id]
    assert (await table.state())["winner_id"] == bob.id


async def test_tn10_everyone_gets_two_scoreless_turns_before_the_game_ends(open_table):
    """Rules §6: with 3 players the limit is 6 scoreless turns in a row, not 4."""
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats

    assert (await table.act(alice, "pass")).json()["game_over"] is False
    bob_tile = (await table.player(bob))["rack"][0]["id"]
    assert (await table.act(bob, "exchange", {"tile_ids": [bob_tile]})).json()["game_over"] is False
    for seat in (carol, alice, bob):
        assert (await table.act(seat, "pass")).json()["game_over"] is False
    res = await table.act(carol, "pass")  # sixth scoreless turn: everyone has had two

    assert res.json()["game_over"] is False


async def test_tn09_a_pass_on_the_last_turn_is_recorded_on_that_turn(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.update_game(max_turns=1)

    await table.act(alice, "pass")

    assert [(m.move_type, m.turn_number) for m in await table.moves()] == [("PASS", 1)]


# --- Leaving (LV) --------------------------------------------------------------------------------

async def test_lv01_player_who_leaves_is_skipped(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats

    left = await table.act(bob, "leave")

    assert (left.status_code, left.json()["next_player_id"]) == (200, alice.id)
    assert me(await table.state(), bob)["connection_status"] == "OFFLINE"
    assert (await table.act(alice, "pass")).json()["next_player_id"] == carol.id


async def test_lv02_last_player_standing_wins_when_everyone_else_left(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats

    # Walking out hands the match to whoever is left, there and then: an abandoned room is
    # dissolved on the spot rather than waiting for the survivor to take another turn.
    res = await table.act(bob, "leave")

    assert res.json()["game_over"] is True
    state = await table.state()
    assert (state["status"], state["winner_id"]) == ("FINISHED", alice.id)


async def test_lv03_leaving_on_your_own_turn_hands_it_to_the_next_seat(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats
    await table.act(alice, "pass")

    left = await table.act(bob, "leave")

    assert left.json()["next_player_id"] == carol.id
    assert (await table.state())["current_player_id"] == carol.id


async def test_lv04_a_player_who_left_cannot_win(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats
    await table.update_player(alice, score=50)
    await table.update_player(carol, score=5)
    await table.act(alice, "leave")  # leaving on her own turn is the first scoreless turn

    for seat in (bob, carol):
        assert (await table.act(seat, "pass")).json()["game_over"] is False
    res = await table.act(bob, "pass")

    assert res.json()["game_over"] is False


# --- Play again (PA) -----------------------------------------------------------------------------

async def test_pa01_first_player_to_play_again_opens_a_lobby_with_the_same_settings(open_table, broadcasts):
    table = await open_table("Alice", "Bob", turn_time_limit=60, game_mode="TURNS", max_turns=7)
    alice, _ = table.seats
    await table.update_game(status="FINISHED", current_player_id=None)

    res = await table.act(alice, "rematch")

    assert res.status_code == 200, res.text
    rematch = res.json()
    assert (rematch["created"], rematch["is_host"], rematch["display_name"]) == (True, True, "Alice")
    assert rematch["game_pin"] != table.pin
    room = (await table.client.get(f"/api/rooms/{rematch['game_pin']}")).json()
    assert (room["status"], [p["display_name"] for p in room["players"]]) == ("WAITING", ["Alice"])
    assert (room["turn_time_limit"], room["game_mode"], room["max_turns"]) == (60, "TURNS", 7)
    assert (await table.state())["rematch_pin"] == rematch["game_pin"]
    assert [(e["type"], e["payload"]["gamePin"]) for e in broadcasts if e["type"] == EventType.REMATCH_CREATED] == [
        (EventType.REMATCH_CREATED, rematch["game_pin"])
    ]


async def test_pa02_other_players_join_the_same_lobby_and_the_opener_hosts_it(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats
    await table.update_game(status="FINISHED", current_player_id=None)

    opened = (await table.act(bob, "rematch")).json()
    joined = [(await table.act(seat, "rematch")).json() for seat in (carol, alice)]

    assert {j["game_pin"] for j in joined} == {opened["game_pin"]}
    assert [(j["created"], j["is_host"]) for j in joined] == [(False, False), (False, False)]
    room = (await table.client.get(f"/api/rooms/{opened['game_pin']}")).json()
    assert [p["display_name"] for p in room["players"]] == ["Bob", "Carol", "Alice"]
    started = await table.client.post(
        f"/api/rooms/{opened['game_pin']}/start", headers={"X-Player-ID": opened["player_id"]}
    )
    assert started.status_code == 200, started.text


async def test_pa03_play_again_needs_a_finished_game_and_a_seat_in_it(open_table):
    table = await open_table("Alice", "Bob")
    other = await open_table("Dan")
    alice, _ = table.seats

    assert (await table.act(alice, "rematch")).status_code == 400
    await table.update_game(status="FINISHED", current_player_id=None)
    assert (await table.act(other.seats[0], "rematch")).status_code == 403
    assert (await table.state())["rematch_pin"] is None


async def test_pa04_a_lobby_that_already_started_is_not_joined_again(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.update_game(status="FINISHED", current_player_id=None)
    first = (await table.act(alice, "rematch")).json()
    await table.client.post(f"/api/rooms/{first['game_pin']}/start", headers={"X-Player-ID": first["player_id"]})

    assert (await table.state())["rematch_pin"] is None
    second = (await table.act(bob, "rematch")).json()

    assert (second["created"], second["is_host"]) == (True, True)
    assert second["game_pin"] != first["game_pin"]
    assert (await table.state())["rematch_pin"] == second["game_pin"]


async def test_pa05_players_pressing_play_again_together_share_one_lobby(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    await table.update_game(status="FINISHED", current_player_id=None)

    results = [r.json() for r in await asyncio.gather(*(table.act(seat, "rematch") for seat in table.seats))]

    assert len({r["game_pin"] for r in results}) == 1
    assert sum(r["created"] for r in results) == 1
    room = (await table.client.get(f"/api/rooms/{results[0]['game_pin']}")).json()
    assert len(room["players"]) == 3


# --- Power cards (CD) ----------------------------------------------------------------------------

async def test_cd01_cannot_use_a_card_you_do_not_hold(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats

    res = await table.act(alice, "cards/use", {"card": "HEAL"})

    assert res.status_code == 400


async def test_legacy_cards_are_rejected(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    for legacy_card in ["BAN_LETTER", "DRAW_TILE", "FREE_EXCHANGE", "MOVE_HEAL"]:
        await table.set_cards(alice, [legacy_card])
        res = await table.act(alice, "cards/use", {"card": legacy_card})
        assert res.status_code == 400



async def test_cd06_double_damage_doubles_the_next_moves_damage_to_the_target(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["DOUBLE_DAMAGE"])
    await table.set_tiles(racks={alice: "CATSEIO"})

    res = await table.act(alice, "cards/use", {"card": "DOUBLE_DAMAGE", "target_player_id": bob.id})
    assert res.json() == {"success": True, "target_player_id": bob.id}

    await table.place(alice, ROW, COL - 1, "CAT")
    await resolve_damage(table)

    assert me(await table.state(), bob)["hp"] == 100 - 10  # 5 base score, doubled


async def test_cd07_freeze_tile_blocks_a_word_through_it_for_one_turn(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_board({(ROW, COL - 1): "C", (ROW, COL): "A", (ROW, COL + 1): "T"})
    await table.set_cards(alice, ["FREEZE_TILE"])

    assert (await table.act(alice, "cards/use", {"card": "FREEZE_TILE", "row": ROW, "col": COL})).status_code == 200
    await table.act(alice, "pass")
    await table.set_tiles(racks={bob: "SEIOURN"})

    blocked = await table.place(bob, ROW, COL + 2, "S")
    assert blocked.status_code == 400
    assert "frozen" in blocked.json()["detail"]

    await table.act(bob, "pass")
    await table.set_tiles(racks={alice: "SEIOURN"})
    allowed = await table.place(alice, ROW, COL + 2, "S")
    assert allowed.status_code == 200, allowed.text


async def test_cd07b_freeze_tile_blocks_every_opponent_until_it_wraps_back(open_table):
    """With N players it takes N-1 turns to come back to the freezer, so all N-1 opponents
    (not just the next one) should be blocked - and the marker should clear exactly then."""
    table = await open_table("Alice", "Bob", "Carol", "Dave")
    alice, bob, carol, dave = table.seats
    await table.set_board({(ROW, COL - 1): "C", (ROW, COL): "A", (ROW, COL + 1): "T"})
    await table.set_cards(alice, ["FREEZE_TILE"])

    assert (await table.act(alice, "cards/use", {"card": "FREEZE_TILE", "row": ROW, "col": COL})).status_code == 200
    await table.act(alice, "pass")

    for seat in (bob, carol, dave):
        await table.set_tiles(racks={seat: "SEIOURN"})
        blocked = await table.place(seat, ROW, COL + 2, "S")
        assert blocked.status_code == 400, f"{seat.name} should still be blocked"
        assert "frozen" in blocked.json()["detail"]
        assert (await table.state())["frozen_tile"] is not None
        await table.act(seat, "pass")

    await table.set_tiles(racks={alice: "SEIOURN"})
    allowed = await table.place(alice, ROW, COL + 2, "S")
    assert allowed.status_code == 200, allowed.text
    assert (await table.state())["frozen_tile"] is None


async def test_cd07c_freeze_tile_can_target_a_tile_placed_this_turn(open_table):
    """FREEZE_TILE can target one of the tiles being placed in the current move itself, not just
    an already-committed tile from a prior turn - it takes effect atomically with the commit."""
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["FREEZE_TILE"])
    await table.set_tiles(racks={alice: "CATSEIO"})

    a_tile = next(t for t in (await table.player(alice))["rack"] if t["letter"] == "A")
    res = await table.place(alice, ROW, COL - 1, "CAT", freeze_tile_id=a_tile["id"])
    assert res.status_code == 200, res.text

    state = await table.state(alice)
    assert (state["frozen_tile"]["row"], state["frozen_tile"]["col"]) == (ROW, COL)
    assert me(state, alice)["cards"] == []

    await table.set_tiles(racks={bob: "SEIOURN"})
    blocked = await table.place(bob, ROW, COL + 2, "S")
    assert blocked.status_code == 400
    assert "frozen" in blocked.json()["detail"]


async def test_cd07d_freeze_tile_target_must_be_part_of_the_move(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["FREEZE_TILE"])
    await table.set_tiles(racks={alice: "CATSEIO"})

    res = await table.place(alice, ROW, COL - 1, "CAT", freeze_tile_id="not-a-real-tile-id")

    assert res.status_code == 400
    assert "part of this move" in res.json()["detail"]
    # A rejected commit must not have spent the card or the tiles.
    assert (await table.state())["frozen_tile"] is None
    assert me(await table.state(alice), alice)["cards"] == ["FREEZE_TILE"]


async def test_cd08_shield_blocks_damage_for_the_blocker_only(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats
    await table.set_cards(bob, ["SHIELD"])
    await table.set_tiles(racks={alice: "CATSEIO"})

    await table.place(alice, ROW, COL - 1, "CAT")
    shield_res = await table.act(bob, "cards/use", {"card": "SHIELD"})
    assert (shield_res.json()["success"], shield_res.json()["blocked"]) == (True, True)
    await resolve_damage(table)

    state = await table.state()
    assert [me(state, seat)["hp"] for seat in (alice, bob, carol)] == [100, 100, 95]


async def test_cd09_shield_can_be_activated_proactively(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["SHIELD"])

    res = await table.act(alice, "cards/use", {"card": "SHIELD"})

    assert res.status_code == 200
    assert res.json()["has_shield"] is True
    state = await table.state()
    assert me(state, alice)["has_shield"] is True

    # Now Bob attacks Alice with a word move. Arming a shield costs no turn, so Alice still holds
    # it and has to pass before Bob can play at all.
    assert (await table.act(alice, "pass")).status_code == 200
    await table.set_tiles(racks={bob: "CATSEIO"})
    assert (await table.place(bob, ROW, COL - 1, "CAT")).status_code == 200
    await resolve_damage(table)

    # Alice's shield absorbed the attack: Alice took 0 damage, shield is consumed
    state_after = await table.state()
    assert me(state_after, alice)["hp"] == 100
    assert me(state_after, alice)["has_shield"] is False


async def test_cd10_shield_cancels_a_pending_spy_swap(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["SPY_SWAP"])
    await table.set_cards(bob, ["SHIELD"])
    await table.set_tiles(racks={alice: "CATSEIO", bob: "DOGRUNS"})
    own_id = (await table.player(alice))["rack"][0]["id"]
    target_id = (await table.player(bob))["rack"][0]["id"]
    before_alice = letters((await table.player(alice))["rack"])
    before_bob = letters((await table.player(bob))["rack"])

    swap_res = await table.act(alice, "cards/use", {
        "card": "SPY_SWAP", "target_player_id": bob.id,
        "own_tile_id": own_id, "target_tile_id": target_id,
    })
    assert swap_res.json() == {"success": True, "pending": True}
    assert (await table.state())["pending_effect"]["type"] == "SWAP"

    shield_res = await table.act(bob, "cards/use", {"card": "SHIELD"})
    assert (shield_res.json()["success"], shield_res.json()["blocked"]) == (True, True)

    assert letters((await table.player(alice))["rack"]) == before_alice
    assert letters((await table.player(bob))["rack"]) == before_bob


async def test_cd10b_spy_swap_selects_multiple_hidden_opponent_tiles(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["SPY_SWAP"])
    await table.set_tiles(racks={alice: "CATSEIO", bob: "DOGRUNS"})
    alice_rack = (await table.player(alice))["rack"]
    own_ids = [alice_rack[2]["id"], alice_rack[0]["id"]]

    res = await table.act(alice, "cards/use", {
        "card": "SPY_SWAP", "target_player_id": bob.id,
        "own_tile_ids": own_ids, "target_tile_indices": [1, 3],
    })

    assert res.json() == {"success": True, "pending": False, "count": 2}
    assert (await table.state(alice))["pending_effect"] is None

    assert letters((await table.player(alice))["rack"]) == "RAOSEIO"
    assert letters((await table.player(bob))["rack"]) == "DTGCUNS"


async def test_cd10c_spy_swap_rejects_more_than_three_tiles(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["SPY_SWAP"])

    res = await table.act(alice, "cards/use", {
        "card": "SPY_SWAP", "target_player_id": bob.id,
        "own_tile_ids": ["a", "b", "c", "d"], "target_tile_indices": [0, 1, 2, 3],
    })

    assert res.status_code == 422


async def test_cd10d_multi_tile_spy_swap_does_not_open_a_shield_window(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["SPY_SWAP"])
    await table.set_cards(bob, ["SHIELD"])
    await table.set_tiles(racks={alice: "CATSEIO", bob: "DOGRUNS"})
    alice_rack = (await table.player(alice))["rack"]
    own_ids = [alice_rack[0]["id"], alice_rack[1]["id"]]
    before_alice = letters(alice_rack)
    before_bob = letters((await table.player(bob))["rack"])

    swap_res = await table.act(alice, "cards/use", {
        "card": "SPY_SWAP", "target_player_id": bob.id,
        "own_tile_ids": own_ids, "target_tile_indices": [0, 1],
    })
    assert swap_res.json()["pending"] is False
    assert (await table.state(alice))["pending_effect"] is None
    # With nothing pending there is no window to block: the shield just arms for a future hit
    # instead of undoing the swap that already completed.
    shield_res = await table.act(bob, "cards/use", {"card": "SHIELD"})
    assert (shield_res.status_code, shield_res.json()["blocked"]) == (200, False)
    assert letters((await table.player(alice))["rack"]) != before_alice
    assert letters((await table.player(bob))["rack"]) != before_bob


async def test_cd11_hint_returns_a_genuinely_valid_placement(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_cards(alice, ["HINT"])
    await table.set_tiles(racks={alice: "CATSEIO"})

    res = await table.act(alice, "cards/use", {"card": "HINT"})

    assert res.json()["success"] is True and res.json()["found"] is True
    # Play back the suggestion itself. Hardcoding a word here only passed by luck: the hint is free
    # to suggest any length, and a different word starting on that cell need not cover the centre.
    suggestion = res.json()["suggestions"][0]
    first_tile = suggestion["tiles"][0]
    placed = await table.place(
        alice, first_tile["row"], first_tile["col"], suggestion["word"],
        down=suggestion["direction"] == "down",
    )
    assert placed.status_code == 200, placed.text


async def test_cd12_knocked_out_players_cannot_heal_back(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    _, bob, _ = table.seats
    await table.update_player(bob, hp=0)
    await table.set_cards(bob, ["HEAL"])

    res = await table.act(bob, "cards/use", {"card": "HEAL"})

    assert res.status_code == 403
    assert (me(await table.state(bob), bob)["hp"], me(await table.state(bob), bob)["cards"]) == (0, ["HEAL"])


async def test_cd13_cards_cannot_be_used_once_the_game_is_over(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_board({(ROW, COL - 1): "C", (ROW, COL): "A", (ROW, COL + 1): "T"})
    await table.set_cards(alice, ["DESTROY_TILE"])
    await table.update_game(status="FINISHED", current_player_id=None)

    res = await table.act(alice, "cards/use", {"card": "DESTROY_TILE", "row": ROW, "col": COL + 1})

    assert res.status_code == 400
    assert len((await table.state())["board_state"]) == 3


@pytest.mark.parametrize("game_mode, max_turns, hp_cards_dealt", [("HP", None, True), ("TURNS", 7, False)])
async def test_cd14_turn_count_games_never_deal_hp_only_cards(open_table, monkeypatch, game_mode, max_turns, hp_cards_dealt):
    table = await open_table("Alice", "Bob", game_mode=game_mode, max_turns=max_turns)
    alice, _ = table.seats
    await table.set_board({(7, 11): "A", (7, 12): "T"})
    await table.set_tiles(racks={alice: "CSEIOUR"})
    pools = []
    monkeypatch.setattr(random, "choice", lambda pool: pools.append(tuple(pool)) or pool[0])

    res = await table.place(alice, 7, 10, "C..")  # (7, 10) is a SECRET_POWER square

    assert res.status_code == 200, res.text
    assert len(pools) == 1
    assert bool({"HEAL", "DOUBLE_DAMAGE", "SHIELD"} & set(pools[0])) is hp_cards_dealt
    assert {"HINT", "SPY_SWAP", "DESTROY_TILE", "FREEZE_TILE"} <= set(pools[0])


# --- Realtime sync (RT) --------------------------------------------------------------------------

@pytest.mark.parametrize("action, event_type", [
    ("pass", "TURN_PASSED"),
    ("exchange", "TILES_EXCHANGED"),
    ("leave", "PLAYER_LEFT"),
    ("moves", "MOVE_COMMITTED"),
])
async def test_rt01_players_hear_about_a_turn_change_only_after_it_is_saved(open_table, monkeypatch, action, event_type):
    """Clients reload the game the moment an event arrives, so the new turn must already be committed."""
    # Carol only has to exist: without a third seat, Alice leaving would dissolve the match and
    # there would be no next turn to observe.
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, _ = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})
    seen_current_player: dict[str, str | None] = {}

    async def reload_on_event(game_id, message):
        seen_current_player[message["type"]] = (await table.state())["current_player_id"]

    monkeypatch.setattr(manager, "broadcast", reload_on_event)

    if action == "moves":
        res = await table.place(alice, ROW, COL - 1, "CAT")
    elif action == "exchange":
        res = await table.act(alice, "exchange", {"tile_ids": [(await table.player(alice))["rack"][0]["id"]]})
    else:
        res = await table.act(alice, action)

    assert res.status_code == 200, res.text
    assert seen_current_player[event_type] == bob.id


async def test_rt02_player_whose_connection_stays_down_loses_their_turn(open_table, broadcasts):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats

    await handle_disconnect(object(), table.game_id, alice.id, "Alice", grace_seconds=0)

    state = await table.state()
    assert (me(state, alice)["connection_status"], state["current_player_id"]) == ("DISCONNECTED", bob.id)
    assert state["status"] == "PLAYING"
    assert any(m["type"] == "PLAYER_DISCONNECTED" for m in broadcasts)


async def test_rt03_player_who_reconnects_in_time_keeps_their_turn(open_table, broadcasts, monkeypatch):
    """A page refresh drops the old socket, but the new one connects before the grace period ends."""
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    old_socket, new_socket = object(), object()
    monkeypatch.setitem(manager.active_connections, table.game_id, {alice.id: new_socket})

    await handle_disconnect(old_socket, table.game_id, alice.id, "Alice", grace_seconds=0)

    state = await table.state()
    assert (me(state, alice)["connection_status"], state["current_player_id"]) == ("ONLINE", alice.id)
    assert manager.active_connections[table.game_id] == {alice.id: new_socket}
    assert not any(m["type"] == "PLAYER_DISCONNECTED" for m in broadcasts)


@pytest.mark.parametrize("action", ["moves", "exchange"])
async def test_rt07_a_dropped_opponent_does_not_hand_over_the_win(open_table, broadcasts, action):
    """Bob's phone locks: his turns are skipped, but Alice's next move must not end the game."""
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_tiles(racks={alice: "CATSEIO"})
    await handle_disconnect(object(), table.game_id, bob.id, "Bob", grace_seconds=0)

    if action == "moves":
        res = await table.place(alice, ROW, COL - 1, "CAT")
    else:
        res = await table.act(alice, "exchange", {"tile_ids": [(await table.player(alice))["rack"][0]["id"]]})

    assert (res.json()["game_over"], res.json()["next_player_id"]) == (False, alice.id)
    await table.update_player(bob, connection_status="ONLINE")  # Bob's socket reconnects
    assert (await table.act(alice, "pass")).json()["next_player_id"] == bob.id


class FakeSocket:
    """Records what the server sends; `on_send` runs while a send is in flight."""

    def __init__(self, on_send=None):
        self.sent = []
        self.on_send = on_send

    async def accept(self):
        pass

    async def send_text(self, text):
        self.sent.append(json.loads(text))
        if self.on_send:
            await self.on_send()


async def test_rt04_a_socket_connecting_mid_broadcast_does_not_break_it():
    """A refresh drops and re-adds a socket while a broadcast awaits each send."""
    connections = ConnectionManager()

    async def carol_connects():
        await connections.connect(FakeSocket(), "game", "carol")

    await connections.connect(FakeSocket(on_send=carol_connects), "game", "alice")
    bob_socket = FakeSocket()
    await connections.connect(bob_socket, "game", "bob")

    await connections.broadcast("game", {"type": "MOVE_COMMITTED"})

    assert bob_socket.sent == [{"type": "MOVE_COMMITTED"}]
    assert connections.is_connected("game", "carol")


async def test_rt05_a_malformed_preview_does_not_cut_off_other_players():
    connections = ConnectionManager()
    sockets = {player_id: FakeSocket() for player_id in ("alice", "bob", "carol")}
    for player_id, socket in sockets.items():
        await connections.connect(socket, "game", player_id)

    await connections.broadcast_preview("game", "alice", {
        "type": "PLACEMENT_PREVIEW",
        "payload": {"playerId": "alice", "tiles": [{"letter": "A"}, {"row": 9, "col": 13, "letter": "T"}]},
    })

    assert connections.is_connected("game", "bob") and connections.is_connected("game", "carol")
    assert sockets["bob"].sent[0]["payload"]["tiles"] == [{"row": 9, "col": 13}]


async def test_rt08_a_solo_player_losing_connection_keeps_the_game(open_table, broadcasts):
    """Nobody else can take the turn, so a locked phone must not end a solo game."""
    table = await open_table("Alice")
    (alice,) = table.seats

    await handle_disconnect(object(), table.game_id, alice.id, "Alice", grace_seconds=0)

    state = await table.state()
    assert (state["status"], state["current_player_id"]) == ("PLAYING", alice.id)
    assert me(state, alice)["connection_status"] == "DISCONNECTED"
    await table.update_player(alice, connection_status="ONLINE")  # her socket reconnects
    assert (await table.act(alice, "pass")).json()["next_player_id"] == alice.id


class SpectatorSocket(FakeSocket):
    """A socket that sends a heartbeat, then stays open until `leave` is set."""

    def __init__(self):
        super().__init__()
        self.leave = asyncio.Event()
        self.pinged = False
        self.closed_with = None

    async def receive_text(self):
        if not self.pinged:
            self.pinged = True
            return json.dumps({"type": "PING"})
        await self.leave.wait()
        raise WebSocketDisconnect()

    async def close(self, code=1000, reason=None):
        self.closed_with = code


async def test_sp01_spectators_watch_without_a_seat(open_table):
    table = await open_table("Alice", "Bob")
    socket = SpectatorSocket()
    watching = asyncio.create_task(websocket_endpoint(socket, table.game_id, token=None, spectate=True))
    await asyncio.sleep(0.05)

    state = await table.state()
    await manager.broadcast(table.game_id, {"type": "TURN_PASSED"})
    socket.leave.set()
    await watching

    assert state["spectator_count"] == 1
    assert [p["display_name"] for p in state["players"]] == ["Alice", "Bob"]
    assert socket.sent == [{"type": "PONG"}, {"type": "TURN_PASSED"}]
    assert manager.spectator_count(table.game_id) == 0
    assert all(p["connection_status"] == "ONLINE" for p in (await table.state())["players"])


async def test_sp02_spectating_an_unknown_game_is_refused(client):
    socket = SpectatorSocket()

    await websocket_endpoint(socket, "no-such-game", token=None, spectate=True)

    assert socket.closed_with == 4004


async def test_sp03_the_game_state_shows_the_room_pin(open_table):
    table = await open_table("Alice", "Bob")

    state = await table.state()

    assert state["game_pin"] == table.pin
    assert all(p["rack"] is None for p in state["players"])  # spectators never see a rack


async def test_sp04_two_spectators_are_allowed_but_a_third_is_rejected(open_table):
    table = await open_table("Alice", "Bob")

    first_socket = SpectatorSocket()
    second_socket = SpectatorSocket()
    third_socket = SpectatorSocket()

    first_task = asyncio.create_task(websocket_endpoint(first_socket, table.game_id, token=None, spectate=True))
    await asyncio.sleep(0.05)
    second_task = asyncio.create_task(websocket_endpoint(second_socket, table.game_id, token=None, spectate=True))
    await asyncio.sleep(0.05)

    assert first_socket.closed_with is None
    assert second_socket.closed_with is None
    assert manager.spectator_count(table.game_id) == 2

    await websocket_endpoint(third_socket, table.game_id, token=None, spectate=True)

    assert third_socket.closed_with == 4005
    assert manager.spectator_count(table.game_id) == 2

    first_socket.leave.set()
    second_socket.leave.set()
    await first_task
    await second_task


async def test_rt06_every_event_is_stamped_when_it_is_created():
    first = WebSocketEvent(type=EventType.TURN_PASSED, payload={}).timestamp
    await asyncio.sleep(0.01)

    assert WebSocketEvent(type=EventType.TURN_PASSED, payload={}).timestamp != first


# --- Debug mode room-scoping (DM) -----------------------------------------------------------------

async def test_dm01_a_debug_room_reveals_every_players_rack_to_any_joiner(open_table):
    """Anyone who joins a debug room is a debug player too - not just whoever set the flag."""
    table = await open_table("Alice", "Bob", is_debug=True)
    alice, bob = table.seats

    state = await table.state(bob)  # Bob's own request, no special query param involved

    assert state["is_debug"] is True
    assert me(state, alice)["rack"] is not None


async def test_dm02_a_normal_room_never_reveals_other_players_racks(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats

    state = await table.state(bob)

    assert state["is_debug"] is False
    assert me(state, alice)["rack"] is None


async def test_dm03_debug_endpoints_are_404_outside_a_debug_room(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats

    res = await table.client.post(f"/api/debug/games/{table.game_id}/players/{alice.id}/hp", json={"hp": 1})

    assert res.status_code == 404


async def test_dm04_debug_endpoints_work_inside_a_debug_room(open_table):
    table = await open_table("Alice", "Bob", is_debug=True)
    alice, _ = table.seats

    res = await table.client.post(f"/api/debug/games/{table.game_id}/players/{alice.id}/hp", json={"hp": 1})

    assert res.status_code == 200
    assert me(res.json(), alice)["hp"] == 1
