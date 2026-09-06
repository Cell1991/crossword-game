import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import generate_game_pin, generate_session_token
from app.database.models import GameRoom, Game, GamePlayer, get_utc_now
from app.game.tiles import TileService

class RoomService:

    @staticmethod
    async def create_room(db: AsyncSession, host_name: str) -> tuple[GameRoom, Game, GamePlayer]:
        # Generate unique 6-digit PIN
        for _ in range(10):
            pin = generate_game_pin()
            existing = await db.execute(select(GameRoom).where(GameRoom.game_pin == pin))
            if not existing.scalar_one_or_none():
                break
        else:
            raise HTTPException(status_code=500, detail="Could not generate unique game PIN")

        room_id = str(uuid.uuid4())
        host_id = str(uuid.uuid4())
        session_token = generate_session_token()

        # Initialize tile bag
        tile_bag = TileService.create_tile_bag()

        room = GameRoom(
            id=room_id,
            game_pin=pin,
            host_player_id=host_id,
            status="WAITING"
        )
        game = Game(
            id=room_id,
            status="WAITING",
            current_player_id=None,
            turn_number=1,
            consecutive_passes=0,
            board_state={},
            tile_bag=tile_bag
        )
        host_player = GamePlayer(
            id=host_id,
            game_id=room_id,
            display_name=host_name.strip(),
            is_host=True,
            score=0,
            rack=[],
            turn_order=0,
            connection_status="ONLINE",
            session_token=session_token
        )

        db.add(room)
        db.add(game)
        db.add(host_player)
        await db.flush()

        return room, game, host_player

    @staticmethod
    async def join_room(db: AsyncSession, game_pin: str, player_name: str) -> tuple[GameRoom, Game, GamePlayer]:
        stmt = select(GameRoom).where(GameRoom.game_pin == game_pin)
        res = await db.execute(stmt)
        room = res.scalar_one_or_none()

        if not room:
            raise HTTPException(status_code=404, detail="Invalid Game PIN: Room not found")

        if room.status != "WAITING":
            raise HTTPException(status_code=400, detail="Game has already started or finished")

        # Check existing players
        stmt_players = select(GamePlayer).where(GamePlayer.game_id == room.id)
        res_players = await db.execute(stmt_players)
        existing_players = res_players.scalars().all()

        if len(existing_players) >= settings.MAX_PLAYERS:
            raise HTTPException(status_code=400, detail="Room is full (max players reached)")

        player_id = str(uuid.uuid4())
        session_token = generate_session_token()

        new_player = GamePlayer(
            id=player_id,
            game_id=room.id,
            display_name=player_name.strip(),
            is_host=False,
            score=0,
            rack=[],
            turn_order=len(existing_players),
            connection_status="ONLINE",
            session_token=session_token
        )

        db.add(new_player)
        await db.flush()

        stmt_game = select(Game).where(Game.id == room.id)
        game = (await db.execute(stmt_game)).scalar_one()

        return room, game, new_player

    @staticmethod
    async def get_room_details(db: AsyncSession, game_pin: str) -> tuple[GameRoom, list[GamePlayer]]:
        stmt = select(GameRoom).where(GameRoom.game_pin == game_pin)
        res = await db.execute(stmt)
        room = res.scalar_one_or_none()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == room.id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        return room, list(players)

    @staticmethod
    async def start_game(db: AsyncSession, room_id: str, host_player_id: str) -> Game:
        stmt = select(GameRoom).where(GameRoom.id == room_id)
        room = (await db.execute(stmt)).scalar_one_or_none()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")

        if room.host_player_id != host_player_id:
            raise HTTPException(status_code=403, detail="Only the host can start the game")

        if room.status != "WAITING":
            raise HTTPException(status_code=400, detail="Game has already started")

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == room.id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        # Deal starting rack to each player
        stmt_game = select(Game).where(Game.id == room.id)
        game = (await db.execute(stmt_game)).scalar_one()

        bag = list(game.tile_bag)
        for player in players:
            rack, bag = TileService.draw_tiles(bag, settings.RACK_SIZE)
            player.rack = rack

        game.tile_bag = bag
        game.status = "PLAYING"
        game.current_player_id = players[0].id if players else None
        room.status = "PLAYING"
        room.started_at = get_utc_now()

        await db.flush()
        return game
