"""End-to-end game scenarios driven through the HTTP API.

Each test is one row of docs/TEST_SCENARIOS.md (the scenario id is in the test name).
Racks, bag and board are staged with GameTable helpers so every outcome is exact.
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.game.board import Board
from app.schemas.events import EventType, WebSocketEvent
from app.services.move_service import MoveService
from fastapi import WebSocketDisconnect

from app.websocket.connection_manager import ConnectionManager, manager
from app.websocket.handlers import handle_disconnect, websocket_endpoint

pytestmark = pytest.mark.asyncio

# The centre star. The first word must cover it, so most scenarios play CAT across it.
ROW, COL = Board.CENTER


def me(state, seat):
    return next(p for p in state["players"] if p["id"] == seat.id)


async def resolve_damage(table):
    """Fast-forward past the SHIELD window and finalize the pending DAMAGE/SWAP effect."""
    pending = (await table.state())["pending_effect"]
    expired = {**pending, "expires_at": (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()}
    await table.update_game(pending_effect=expired)
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
    assert "เต็ม" in res.json()["detail"]  # room is full for players (spectating is a separate WS-only path)


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
    assert (res.json()["game_over"], res.json()["winner_id"]) == (True, alice.id)


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
    # The move commits immediately, but the KO only lands once the pending damage resolves.
    assert res.json()["game_over"] is False
    resolved = await resolve_damage(table)
    assert (resolved.json()["status"], resolved.json()["game_over"], resolved.json()["winner_id"]) == ("resolved", True, alice.id)
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

    assert res.json()["game_over"] is True
    assert (await table.state())["status"] == "FINISHED"


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

    assert res.json()["game_over"] is True


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
    await table.act(bob, "leave")

    res = await table.act(alice, "pass")

    assert (res.json()["game_over"], res.json()["winner_id"]) == (True, alice.id)


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

    assert (res.json()["game_over"], res.json()["winner_id"]) == (True, carol.id)


# --- Power cards (CD) ----------------------------------------------------------------------------

async def test_cd01_cannot_use_a_card_you_do_not_hold(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats

    res = await table.act(alice, "cards/use", {"card": "HEAL"})

    assert res.status_code == 400


async def test_cd02_draw_tile_card_adds_a_tile_from_the_bag(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_cards(alice, ["DRAW_TILE"])

    res = await table.act(alice, "cards/use", {"card": "DRAW_TILE"})

    assert res.json() == {"success": True, "drawn": 1}
    state = await table.state(alice)
    assert (len(me(state, alice)["rack"]), state["tile_bag_count"], me(state, alice)["cards"]) == (8, 85, [])


async def test_cd03_banned_letter_blocks_the_next_player(open_table):
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
    await table.set_cards(alice, ["BAN_LETTER"])
    assert (await table.act(alice, "cards/use", {"card": "BAN_LETTER", "letter": "A"})).status_code == 200
    await table.act(alice, "pass")
    await table.set_tiles(racks={bob: "CATSEIO"})

    res = await table.place(bob, ROW, COL - 1, "CAT")

    assert res.status_code == 400
    assert "banned" in res.json()["detail"]


async def test_cd04_free_exchange_swaps_the_whole_rack_without_ending_the_turn(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_cards(alice, ["FREE_EXCHANGE"])
    await table.set_tiles(racks={alice: "CATSEIO"}, bag="RSTLNEDGHIOAUMPFYWB")
    old_ids = {t["id"] for t in (await table.player(alice))["rack"]}

    res = await table.act(alice, "cards/use", {"card": "FREE_EXCHANGE"})

    assert res.json()["success"] is True
    state = await table.state(alice)
    new_ids = {t["id"] for t in me(state, alice)["rack"]}
    assert old_ids.isdisjoint(new_ids) and len(new_ids) == 7
    assert (state["current_player_id"], state["turn_number"]) == (alice.id, 1)


async def test_cd05_move_heal_heals_by_the_pending_moves_base_score(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.update_player(alice, hp=50)
    await table.set_cards(alice, ["MOVE_HEAL"])
    await table.set_tiles(racks={alice: "CATSEIO"})
    rack = (await table.player(alice))["rack"]
    cat = [next(t for t in rack if t["letter"] == letter) for letter in "CAT"]
    placed = [
        {"row": ROW, "col": COL - 1 + i, "tile_id": t["id"], "letter": t["letter"], "value": t["value"]}
        for i, t in enumerate(cat)
    ]

    invalid = await table.act(alice, "cards/use", {"card": "MOVE_HEAL", "placed_tiles": [
        {"row": 0, "col": 0, "tile_id": cat[0]["id"], "letter": "C", "value": 3}
    ]})
    assert invalid.status_code == 400
    assert me(await table.state(alice), alice)["cards"] == ["MOVE_HEAL"]  # rejected use doesn't consume the card

    res = await table.act(alice, "cards/use", {"card": "MOVE_HEAL", "placed_tiles": placed})

    assert res.json() == {"success": True, "healed": 5, "hp": 55}
    assert me(await table.state(alice), alice)["hp"] == 55


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


async def test_cd08_shield_blocks_damage_for_the_blocker_only(open_table):
    table = await open_table("Alice", "Bob", "Carol")
    alice, bob, carol = table.seats
    await table.set_cards(bob, ["SHIELD"])
    await table.set_tiles(racks={alice: "CATSEIO"})

    await table.place(alice, ROW, COL - 1, "CAT")
    assert (await table.act(bob, "cards/use", {"card": "SHIELD"})).json() == {"success": True, "blocked": True}
    await resolve_damage(table)

    state = await table.state()
    assert [me(state, seat)["hp"] for seat in (alice, bob, carol)] == [100, 100, 95]


async def test_cd09_shield_without_an_incoming_effect_is_rejected(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_cards(alice, ["SHIELD"])

    res = await table.act(alice, "cards/use", {"card": "SHIELD"})

    assert res.status_code == 400


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

    assert (await table.act(bob, "cards/use", {"card": "SHIELD"})).json() == {"success": True, "blocked": True}

    assert letters((await table.player(alice))["rack"]) == before_alice
    assert letters((await table.player(bob))["rack"]) == before_bob


async def test_cd11_hint_returns_a_genuinely_valid_placement(open_table):
    table = await open_table("Alice", "Bob")
    alice, _ = table.seats
    await table.set_cards(alice, ["HINT"])
    await table.set_tiles(racks={alice: "CATSEIO"})

    res = await table.act(alice, "cards/use", {"card": "HINT"})

    assert res.json()["success"] is True and res.json()["found"] is True
    placed = await table.place(alice, res.json()["row"], res.json()["col"], "CAT")
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


# --- Realtime sync (RT) --------------------------------------------------------------------------

@pytest.mark.parametrize("action, event_type", [
    ("pass", "TURN_PASSED"),
    ("exchange", "TILES_EXCHANGED"),
    ("leave", "PLAYER_LEFT"),
    ("moves", "MOVE_COMMITTED"),
])
async def test_rt01_players_hear_about_a_turn_change_only_after_it_is_saved(open_table, monkeypatch, action, event_type):
    """Clients reload the game the moment an event arrives, so the new turn must already be committed."""
    table = await open_table("Alice", "Bob")
    alice, bob = table.seats
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
