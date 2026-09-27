import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import generate_game_pin, generate_session_token
from app.database.models import GameRoom, Game, GamePlayer, get_utc_now
from app.game.tiles import TileService
from app.database.state import replace_game_tiles
from app.websocket.connection_manager import manager

class RoomService:

    @staticmethod
    async def create_room(
        db: AsyncSession,
        host_name: str,
        turn_time_limit: int | None = None,
        is_debug: bool = False,
        game_mode: str = "HP",
        max_turns: int | None = None,
    ) -> tuple[GameRoom, Game, GamePlayer]:
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
            status="WAITING",
            turn_time_limit=turn_time_limit,
            is_debug=is_debug and settings.DEBUG_MODE,
            game_mode=game_mode,
            max_turns=max_turns,
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
        await replace_game_tiles(db, room_id, tile_bag, [host_player])

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
            spectator_count = manager.spectator_count(room.id)
            if spectator_count < settings.MAX_SPECTATORS:
                raise HTTPException(
                    status_code=400,
                    detail="ห้องนี้เต็มสำหรับผู้เล่นแล้ว แต่ยังมีพื้นที่สำหรับผู้ชมอยู่ คุณสามารถเข้าร่วมในโหมดผู้ชมได้เลย"
                )
            raise HTTPException(
                status_code=400,
                detail="ห้องนี้เต็มทั้งผู้เล่นและผู้ชมแล้ว คราวนี้เลือกห้องอื่นเพื่อร่วมสนุกกันต่อไปนะ"
            )

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
    async def leave_room(db: AsyncSession, game_pin: str, player_id: str) -> GameRoom:
        """Take a player out of a room that has not started. A leaving host hands the room to the next player."""
        room, players = await RoomService.get_room_details(db, game_pin)
        if room.status != "WAITING":
            raise HTTPException(status_code=400, detail="Game has already started or finished")
        player = next((p for p in players if p.id == player_id), None)
        if not player:
            raise HTTPException(status_code=404, detail="Player not found in this room")

        await db.delete(player)
        remaining = [p for p in players if p.id != player_id]
        # Keep seats contiguous: join_room seats newcomers at len(players).
        for seat, remaining_player in enumerate(remaining):
            remaining_player.turn_order = seat
        if player.is_host:
            if remaining:
                remaining[0].is_host = True
                room.host_player_id = remaining[0].id
            else:
                room.status = "ABANDONED"
        await db.flush()
        return room

    @staticmethod
    async def open_rematch_room(db: AsyncSession, room: GameRoom) -> Optional[GameRoom]:
        """The lobby this finished room's players are gathering in, while it still takes players."""
        if not room.rematch_pin:
            return None
        rematch = (await db.execute(
            select(GameRoom).where(GameRoom.game_pin == room.rematch_pin)
        )).scalar_one_or_none()
        return rematch if rematch and rematch.status == "WAITING" else None

    @staticmethod
    async def rematch(db: AsyncSession, game_id: str, player_id: str) -> tuple[GameRoom, Game, GamePlayer, bool]:
        """
        Seat a player of a finished game in a new lobby with the same settings. The first player to
        ask opens it as host; everyone after joins it, until it starts or empties, when the next
        player to ask opens a fresh one. Returns (room, game, player, created).
        """
        # Lock the old room so two players asking at once cannot open two lobbies.
        room = (await db.execute(
            select(GameRoom).where(GameRoom.id == game_id).with_for_update()
        )).scalar_one_or_none()
        game = (await db.execute(select(Game).where(Game.id == game_id))).scalar_one_or_none()
        if not room or not game:
            raise HTTPException(status_code=404, detail="Game not found")
        if game.status != "FINISHED":
            raise HTTPException(status_code=400, detail="The game is not over yet")
        player = (await db.execute(select(GamePlayer).where(
            GamePlayer.id == player_id, GamePlayer.game_id == game_id
        ))).scalar_one_or_none()
        if not player:
            raise HTTPException(status_code=403, detail="Only players of this game can play again")

        open_room = await RoomService.open_rematch_room(db, room)
        if open_room:
            new_room, new_game, new_player = await RoomService.join_room(db, open_room.game_pin, player.display_name)
            return new_room, new_game, new_player, False

        new_room, new_game, new_player = await RoomService.create_room(
            db, player.display_name, room.turn_time_limit,
            is_debug=room.is_debug, game_mode=room.game_mode, max_turns=room.max_turns,
        )
        room.rematch_pin = new_room.game_pin
        await db.flush()
        return new_room, new_game, new_player, True

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
        if len(players) < settings.MIN_PLAYERS:
            raise HTTPException(status_code=400, detail=f"At least {settings.MIN_PLAYERS} players are needed to start")

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
        game.max_turns = room.max_turns if room.game_mode == "TURNS" else None
        room.status = "PLAYING"
        room.started_at = get_utc_now()
        game.turn_started_at = get_utc_now()

        await replace_game_tiles(db, game.id, bag, players)

        await db.flush()
        return game
