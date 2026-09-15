"""Shared fixtures for the backend test suite.

API tests drop and recreate every table, so they must never touch the developer's
crossword.db or the docker Postgres database. DATABASE_URL is pointed at a throwaway
SQLite file here, before the app (and its engine) is imported by any test module.
Set TEST_DATABASE_URL to run the suite against a different disposable database.
"""
import os
import tempfile

_TEST_DB_PATH = os.path.join(tempfile.gettempdir(), f"crossword-test-{os.getpid()}.db").replace("\\", "/")
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", f"sqlite+aiosqlite:///{_TEST_DB_PATH}")

from dataclasses import dataclass  # noqa: E402
from typing import Any  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.database.models import Base, Game, GamePlayer, Move  # noqa: E402
from app.database.session import AsyncSessionLocal, engine  # noqa: E402
from app.database.state import (  # noqa: E402
    bag_tiles, player_rack, replace_board_state, replace_game_tiles, replace_player_cards,
)
from app.game.tiles import DEFAULT_LETTER_VALUES  # noqa: E402
from app.websocket.connection_manager import manager  # noqa: E402
from main import app  # noqa: E402


def pytest_sessionfinish(session, exitstatus):
    try:
        os.remove(_TEST_DB_PATH)
    except OSError:
        pass


@dataclass(frozen=True)
class Seat:
    """One player sitting at a test table."""
    id: str
    token: str
    name: str


def make_tiles(letters: str, prefix: str) -> list[dict[str, Any]]:
    return [
        {"id": f"{prefix}-{index}", "letter": letter, "value": DEFAULT_LETTER_VALUES[letter]}
        for index, letter in enumerate(letters)
    ]


class GameTable:
    """Drives one game through the HTTP API and stages exact situations straight in the database."""

    def __init__(self, client: AsyncClient, game_id: str, pin: str, seats: list[Seat]):
        self.client = client
        self.game_id = game_id
        self.pin = pin
        self.seats = seats

    async def start(self, seat: Seat | None = None):
        host = seat or self.seats[0]
        return await self.client.post(f"/api/rooms/{self.pin}/start", headers={"X-Player-ID": host.id})

    async def state(self, seat: Seat | None = None) -> dict[str, Any]:
        query = f"?token={seat.token}" if seat else ""
        res = await self.client.get(f"/api/games/{self.game_id}{query}")
        assert res.status_code == 200, res.text
        return res.json()

    async def player(self, seat: Seat) -> dict[str, Any]:
        return next(p for p in (await self.state(seat))["players"] if p["id"] == seat.id)

    async def act(self, seat: Seat, action: str, json: dict[str, Any] | None = None):
        """POST /api/games/{id}/{action} as `seat`, e.g. act(alice, "pass")."""
        return await self.client.post(
            f"/api/games/{self.game_id}/{action}", headers={"X-Player-ID": seat.id}, json=json
        )

    async def place(self, seat: Seat, row: int, col: int, word: str, *, down: bool = False, validate: bool = False):
        """Play `word` from the seat's rack starting at (row, col). A '.' skips a cell already on the board."""
        available = list((await self.player(seat))["rack"])
        placed = []
        for offset, letter in enumerate(word):
            if letter == ".":
                continue
            tile = next(t for t in available if t["letter"] == letter)
            available.remove(tile)
            placed.append({
                "row": row + (offset if down else 0),
                "col": col + (0 if down else offset),
                "tile_id": tile["id"],
                "letter": letter,
                "value": tile["value"],
            })
        return await self.act(seat, "moves/validate" if validate else "moves", {"placed_tiles": placed})

    async def set_tiles(self, racks: dict[Seat, str] | None = None, bag: str | None = None) -> None:
        """Replace racks and/or the bag with known letters so a scenario is deterministic."""
        async with AsyncSessionLocal() as db:
            game = await db.get(Game, self.game_id)
            players = await self._players(db)
            for player in players:
                player.rack = await player_rack(db, player.id)
            for seat, letters in (racks or {}).items():
                next(p for p in players if p.id == seat.id).rack = make_tiles(letters, seat.name)
            game.tile_bag = make_tiles(bag, "bag") if bag is not None else await bag_tiles(db, self.game_id)
            await replace_game_tiles(db, self.game_id, game.tile_bag, players)
            await db.commit()

    async def set_board(self, cells: dict[tuple[int, int], str]) -> None:
        """Put committed tiles on the board, e.g. {(7, 7): "A"}."""
        state = {
            f"{row}_{col}": {
                "row": row, "col": col, "letter": letter, "value": DEFAULT_LETTER_VALUES[letter],
                "player_id": self.seats[0].id, "turn_number": 0,
            }
            for (row, col), letter in cells.items()
        }
        async with AsyncSessionLocal() as db:
            game = await db.get(Game, self.game_id)
            game.board_state = state
            await replace_board_state(db, self.game_id, state)
            await db.commit()

    async def update_game(self, **fields: Any) -> None:
        async with AsyncSessionLocal() as db:
            game = await db.get(Game, self.game_id)
            for name, value in fields.items():
                setattr(game, name, value)
            await db.commit()

    async def update_player(self, seat: Seat, **fields: Any) -> None:
        async with AsyncSessionLocal() as db:
            player = await db.get(GamePlayer, seat.id)
            for name, value in fields.items():
                setattr(player, name, value)
            await db.commit()

    async def moves(self) -> list[Move]:
        async with AsyncSessionLocal() as db:
            stmt = select(Move).where(Move.game_id == self.game_id).order_by(Move.created_at)
            return list((await db.execute(stmt)).scalars().all())

    async def bag(self) -> list[dict[str, Any]]:
        async with AsyncSessionLocal() as db:
            return await bag_tiles(db, self.game_id)

    async def set_cards(self, seat: Seat, cards: list[str]) -> None:
        async with AsyncSessionLocal() as db:
            player = await db.get(GamePlayer, seat.id)
            player.cards = cards
            await replace_player_cards(db, seat.id, cards)
            await db.commit()

    async def _players(self, db) -> list[GamePlayer]:
        stmt = select(GamePlayer).where(GamePlayer.game_id == self.game_id).order_by(GamePlayer.turn_order)
        return list((await db.execute(stmt)).scalars().all())


@pytest_asyncio.fixture
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
        yield http
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def open_table(client):
    """Factory: seat the named players in a new room (the first one hosts) and start the game."""
    async def _open(*names: str, start: bool = True, turn_time_limit: int | None = None) -> GameTable:
        host_name, *guest_names = names
        created = await client.post("/api/rooms", json={"host_name": host_name, "turn_time_limit": turn_time_limit})
        assert created.status_code == 200, created.text
        room = created.json()
        seats = [Seat(room["host_player_id"], room["session_token"], host_name)]
        for name in guest_names:
            joined = await client.post(
                f"/api/rooms/{room['game_pin']}/join", json={"game_pin": room["game_pin"], "player_name": name}
            )
            assert joined.status_code == 200, joined.text
            seats.append(Seat(joined.json()["player_id"], joined.json()["session_token"], name))
        table = GameTable(client, room["game_id"], room["game_pin"], seats)
        if start:
            started = await table.start()
            assert started.status_code == 200, started.text
        return table
    return _open


@pytest.fixture
def broadcasts(monkeypatch):
    """Collect every WebSocket broadcast instead of sending it."""
    sent: list[dict[str, Any]] = []

    async def capture(game_id: str, message: dict[str, Any]) -> None:
        sent.append(message)

    monkeypatch.setattr(manager, "broadcast", capture)
    return sent
