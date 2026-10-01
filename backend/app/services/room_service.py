import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import generate_game_pin, generate_session_token
from app.database.models import GameRoom, Game, GamePlayer, get_utc_now
from app.game.tiles import TileService
from app.websocket.connection_manager import manager
from app.schemas.events import WebSocketEvent, EventType

class RoomService:

    @staticmethod
    async def create_room(
        db: AsyncSession,
        host_name: str,
        turn_time_limit: int | None = None,
        is_debug: bool = False,
        game_mode: str = "HP",
        max_turns: int | None = None,
        starting_hp: int | None = None,
        max_players: int | None = 4,
    ) -> tuple[GameRoom, Game, GamePlayer]:
        pin = generate_game_pin()
        room_id = str(uuid.uuid4())
        host_id = str(uuid.uuid4())
        session_token = generate_session_token()

        # Initialize tile bag
        tile_bag = TileService.create_tile_bag()

        hp_setting = (starting_hp if starting_hp is not None else 100) if game_mode == "HP" else None

        room = GameRoom(
            id=room_id,
            game_pin=pin,
            host_player_id=host_id,
            status="WAITING",
            turn_time_limit=turn_time_limit,
            is_debug=is_debug and settings.DEBUG_MODE,
            game_mode=game_mode,
            max_turns=max_turns,
            starting_hp=hp_setting,
            max_players=max_players,
            created_at=get_utc_now(),
        )
        game = Game(
            id=room_id,
            status="WAITING",
            current_player_id=None,
            turn_number=1,
            max_turns=max_turns if game_mode == "TURNS" else None,
            starting_hp=hp_setting,
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
        stmt = (
            select(GameRoom, GamePlayer)
            .outerjoin(GamePlayer, GamePlayer.game_id == GameRoom.id)
            .where(GameRoom.game_pin == game_pin)
            .order_by(GamePlayer.turn_order)
        )
        rows = (await db.execute(stmt)).all()
        if not rows:
            raise HTTPException(status_code=404, detail="Invalid Game PIN: Room not found")

        room = rows[0][0]
        if room.status == "EXPIRED" or RoomService.is_room_expired(room):
            room.status = "EXPIRED"
            await db.commit()
            raise HTTPException(
                status_code=410,
                detail=f"This room has expired because the game was not started within {settings.ROOM_EXPIRY_MINUTES} minutes."
            )
        if room.status != "WAITING":
            raise HTTPException(status_code=400, detail="Game has already started or finished")

        # Check existing players
        existing_players = [row[1] for row in rows if row[1] is not None]
        room_max_players = getattr(room, "max_players", None)

        if room_max_players is not None and len(existing_players) >= room_max_players:
            spectator_count = manager.spectator_count(room.id)
            if spectator_count < settings.MAX_SPECTATORS:
                raise HTTPException(
                    status_code=400,
                    detail="This room is full for players, but spectator spots are still available. You can join as a spectator."
                )
            raise HTTPException(
                status_code=400,
                detail="This room is full for both players and spectators. Please choose another room."
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

        # Shared PK between GameRoom and Game avoids redundant select(Game) network roundtrip
        stub_game = type("StubGame", (), {"id": room.id})()

        return room, stub_game, new_player

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
            starting_hp=room.starting_hp,
        )
        room.rematch_pin = new_room.game_pin
        await db.flush()
        return new_room, new_game, new_player, True

    @staticmethod
    async def get_room_details(db: AsyncSession, game_pin: str) -> tuple[GameRoom, list[GamePlayer]]:
        stmt = (
            select(GameRoom, GamePlayer)
            .outerjoin(GamePlayer, GamePlayer.game_id == GameRoom.id)
            .where(GameRoom.game_pin == game_pin)
            .order_by(GamePlayer.turn_order)
        )
        rows = (await db.execute(stmt)).all()
        if not rows:
            raise HTTPException(status_code=404, detail="Room not found")

        room = rows[0][0]
        if room.status == "EXPIRED" or RoomService.is_room_expired(room):
            room.status = "EXPIRED"
            await db.commit()
            raise HTTPException(
                status_code=410,
                detail=f"This room has expired because the game was not started within {settings.ROOM_EXPIRY_MINUTES} minutes."
            )
        players = [row[1] for row in rows if row[1] is not None]

        return room, players

    @staticmethod
    async def start_game(db: AsyncSession, room_id: str, host_player_id: str) -> Game:
        stmt = (
            select(GameRoom, Game, GamePlayer)
            .join(Game, Game.id == GameRoom.id)
            .outerjoin(GamePlayer, GamePlayer.game_id == GameRoom.id)
            .where(GameRoom.id == room_id)
            .order_by(GamePlayer.turn_order)
        )
        rows = (await db.execute(stmt)).all()
        if not rows:
            raise HTTPException(status_code=404, detail="Room not found")

        room = rows[0][0]
        game = rows[0][1]
        players = [row[2] for row in rows if row[2] is not None]

        if room.host_player_id != host_player_id:
            raise HTTPException(status_code=403, detail="Only the host can start the game")

        if room.status != "WAITING":
            raise HTTPException(status_code=400, detail="Game has already started")

        if len(players) < settings.MIN_PLAYERS:
            raise HTTPException(status_code=400, detail=f"At least {settings.MIN_PLAYERS} players are needed to start")

        # Deal starting rack to each player
        base_hp = room.starting_hp if room.starting_hp is not None else 100
        starting_hp = base_hp + max(0, len(players) - 2) * 20
        bag = list(game.tile_bag)
        for player in players:
            player.hp = starting_hp
            player.max_hp = starting_hp
            rack, bag = TileService.draw_tiles(bag, settings.RACK_SIZE)
            player.rack = rack

        game.tile_bag = bag
        game.status = "PLAYING"
        game.current_player_id = players[0].id if players else None
        game.max_turns = room.max_turns if room.game_mode == "TURNS" else None
        game.starting_hp = base_hp
        room.status = "PLAYING"
        room.started_at = get_utc_now()
        game.turn_started_at = get_utc_now()

        await db.flush()
        return game

    @staticmethod
    async def list_active_rooms(db: AsyncSession, limit: int = 30) -> list[dict]:
        stmt = (
            select(GameRoom, GamePlayer)
            .outerjoin(GamePlayer, GamePlayer.game_id == GameRoom.id)
            .where(GameRoom.status.in_(["WAITING", "PLAYING"]))
            .order_by(GameRoom.created_at.desc().nullslast())
        )
        rows = (await db.execute(stmt)).all()

        rooms_map: dict[str, tuple[GameRoom, list[GamePlayer]]] = {}
        for room, player in rows:
            if room.id not in rooms_map:
                rooms_map[room.id] = (room, [])
            if player is not None:
                rooms_map[room.id][1].append(player)

        results = []
        has_expired_updates = False
        for room, players in rooms_map.values():
            try:
                if not players:
                    continue
                if room.status == "WAITING" and RoomService.is_room_expired(room):
                    room.status = "EXPIRED"
                    has_expired_updates = True
                    continue

                host = next((p for p in players if p.is_host or p.id == room.host_player_id), players[0])
                host_name = (host.display_name or "Host").strip() or "Host"
                results.append({
                    "id": str(room.id),
                    "game_pin": str(room.game_pin),
                    "status": str(room.status),
                    "host_name": host_name,
                    "player_count": len(players),
                    "max_players": getattr(room, "max_players", None) or 4,
                    "turn_time_limit": room.turn_time_limit,
                    "game_mode": str(room.game_mode or "HP").upper(),
                    "max_turns": room.max_turns,
                    "starting_hp": room.starting_hp if room.starting_hp is not None else 100,
                    "is_debug": bool(room.is_debug),
                    "created_at": room.created_at or get_utc_now(),
                })
                if len(results) >= limit:
                    break
            except Exception:
                continue

        if has_expired_updates:
            try:
                await db.commit()
            except Exception:
                pass

        return results

    @staticmethod
    def is_room_expired(room: GameRoom, timeout_minutes: int | None = None) -> bool:
        if timeout_minutes is None:
            timeout_minutes = settings.ROOM_EXPIRY_MINUTES
        if room.status != "WAITING":
            return False
        if not room.created_at:
            # Stale waiting room with missing timestamp is treated as expired
            return True
        created_at = room.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = (now - created_at).total_seconds()
        return diff >= (timeout_minutes * 60)

    @staticmethod
    async def expire_inactive_rooms(db: AsyncSession, timeout_minutes: int | None = None) -> list[str]:
        """
        Check for rooms that are still WAITING after timeout_minutes (default 10) and dissolve them.
        Kicks all players out and marks room as EXPIRED.
        """
        if timeout_minutes is None:
            timeout_minutes = settings.ROOM_EXPIRY_MINUTES

        stmt = select(GameRoom).where(GameRoom.status == "WAITING")
        rooms = (await db.execute(stmt)).scalars().all()

        expired_room_ids = []
        for room in rooms:
            if RoomService.is_room_expired(room, timeout_minutes):
                room.status = "EXPIRED"
                expired_room_ids.append(room.id)
                # Broadcast ROOM_EXPIRED to any connected WebSockets
                await manager.broadcast(room.id, WebSocketEvent(
                    type=EventType.ROOM_EXPIRED,
                    payload={
                        "roomId": room.id,
                        "gamePin": room.game_pin,
                        "reason": f"Room dissolved after {timeout_minutes} minutes of inactivity."
                    }
                ).model_dump())

        if expired_room_ids:
            await db.flush()

        return expired_room_ids
