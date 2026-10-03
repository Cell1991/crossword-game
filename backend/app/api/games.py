import asyncio
from collections import defaultdict
from typing import Optional, Any
from fastapi import APIRouter, Depends, Header, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.game import GameStateResponse
from app.schemas.move import ExchangeTilesRequest, PlacedTileInput
from app.schemas.room import RematchResponse
from app.schemas.events import WebSocketEvent, EventType
from app.services.game_service import GameService
from app.services.room_service import RoomService
from app.services.move_service import MoveService
from app.services.bot_service import BotService
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/games", tags=["Games"])

# SQLite ignores SELECT ... FOR UPDATE, so players pressing Play Again at the same moment would
# each open their own lobby. Serialize rematch requests per game in this process instead.
_rematch_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

@router.get("/{game_id}", response_model=GameStateResponse)
async def get_game(
    game_id: str,
    token: Optional[str] = Query(None),
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    db: AsyncSession = Depends(get_db)
):
    session_token = token or x_session_token
    requesting_player_id = None
    if session_token:
        player = await GameService.get_player_by_token(db, session_token)
        if player:
            requesting_player_id = player.id

    # Auto-recovery: a scheduled task may be lost on process restart. If a bot turn has
    # been idle for the same short fallback window, execute it while assembling the state.
    from sqlalchemy import select
    from app.database.models import Game, GamePlayer, get_utc_now
    stmt_g = select(Game).where(Game.id == game_id)
    game_obj = (await db.execute(stmt_g)).scalar_one_or_none()
    if game_obj and game_obj.status == "PLAYING" and game_obj.current_player_id:
        stmt_p = select(GamePlayer).where(GamePlayer.id == game_obj.current_player_id)
        curr_p = (await db.execute(stmt_p)).scalar_one_or_none()
        if BotService.is_bot_player(curr_p):
            from datetime import timezone
            now = get_utc_now()
            started = game_obj.turn_started_at or game_obj.created_at
            if started:
                if started.tzinfo is None:
                    started = started.replace(tzinfo=timezone.utc)
                if (now - started).total_seconds() >= 6.0:
                    await BotService.execute_bot_move_now(db, game_id, curr_p.id)

    # Whether racks are revealed comes from the room's own is_debug flag (see get_game_state),
    # not from anything the client claims - a client can't ask its way into seeing opponents' tiles.
    state = await GameService.get_game_state(db, game_id, requesting_player_id)
    state.spectator_count = manager.spectator_count(game_id)
    return state

@router.post("/{game_id}/pass")
async def pass_turn(
    game_id: str,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db)
):
    game, is_over, reason, winner_id = await GameService.pass_turn(db, game_id, x_player_id)
    # Save before telling anyone: clients reload the game the moment an event arrives.
    await db.commit()

    # Broadcast turn passed
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.TURN_PASSED,
        payload={
            "passedPlayerId": x_player_id,
            "nextPlayerId": game.current_player_id,
            "turnNumber": game.turn_number,
            "consecutivePasses": game.consecutive_passes
        }
    ).model_dump())

    if is_over:
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_ENDED,
            payload={
                "reason": reason,
                "winnerId": winner_id
            }
        ).model_dump())
    elif game.current_player_id:
        from sqlalchemy import select
        from app.database.models import GamePlayer
        stmt_next = select(GamePlayer).where(GamePlayer.id == game.current_player_id)
        next_p = (await db.execute(stmt_next)).scalar_one_or_none()
        if BotService.is_bot_player(next_p):
            asyncio.create_task(
                BotService.schedule_auto_bot_turn(game_id, next_p.id, game.turn_number, delay_seconds=6.0)
            )

    return {
        "status": "passed",
        "next_player_id": game.current_player_id,
        "turn_number": game.turn_number,
        "game_over": is_over,
        "winner_id": winner_id
    }

@router.post("/{game_id}/exchange")
async def exchange_tiles(
    game_id: str,
    req: ExchangeTilesRequest,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db)
):
    game, exchanged, is_over, reason, winner_id = await GameService.exchange_tiles(
        db, game_id, x_player_id, req.tile_ids
    )
    await db.commit()

    if exchanged:
        # Everyone learns how many tiles were swapped, never which letters.
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.TILES_EXCHANGED,
            payload={
                "playerId": x_player_id,
                "count": len(req.tile_ids),
                "nextPlayerId": game.current_player_id,
                "turnNumber": game.turn_number
            }
        ).model_dump())
    else:
        # Asking for more tiles than the bag holds counts as a pass (rules §5).
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.TURN_PASSED,
            payload={
                "passedPlayerId": x_player_id,
                "nextPlayerId": game.current_player_id,
                "turnNumber": game.turn_number,
                "consecutivePasses": game.consecutive_passes
            }
        ).model_dump())

    if is_over:
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_ENDED,
            payload={
                "reason": reason,
                "winnerId": winner_id
            }
        ).model_dump())
    elif game.current_player_id:
        from sqlalchemy import select
        from app.database.models import GamePlayer
        stmt_next = select(GamePlayer).where(GamePlayer.id == game.current_player_id)
        next_p = (await db.execute(stmt_next)).scalar_one_or_none()
        if BotService.is_bot_player(next_p):
            asyncio.create_task(
                BotService.schedule_auto_bot_turn(game_id, next_p.id, game.turn_number, delay_seconds=2.8)
            )

    return {
        "status": "exchanged" if exchanged else "passed",
        "exchanged_count": len(req.tile_ids) if exchanged else 0,
        "next_player_id": game.current_player_id,
        "turn_number": game.turn_number,
        "game_over": is_over,
        "winner_id": winner_id
    }

@router.post("/{game_id}/timeout")
async def timeout_turn(game_id: str, db: AsyncSession = Depends(get_db)):
    game, expired, reason, winner_id = await GameService.expire_turn_if_needed(db, game_id)
    if not expired:
        return {"status": "active", "expired": False, "turn_number": game.turn_number}
    await db.commit()

    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.TURN_PASSED,
        payload={
            "passedPlayerId": None,
            "nextPlayerId": game.current_player_id,
            "turnNumber": game.turn_number,
            "consecutivePasses": game.consecutive_passes,
            "reason": "TIMEOUT"
        }
    ).model_dump())
    if game.status == "FINISHED":
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_ENDED,
            payload={"reason": reason or "TIMEOUT", "winnerId": winner_id}
        ).model_dump())
    return {"status": "expired", "expired": True, "turn_number": game.turn_number, "game_over": game.status == "FINISHED"}


@router.post("/{game_id}/effects/resolve")
async def resolve_pending_effect(game_id: str, db: AsyncSession = Depends(get_db)):
    game, resolved, payload = await GameService.finalize_pending_effect_if_needed(db, game_id)
    if not resolved:
        return {"status": "pending" if game.pending_effect else "none"}
    await db.commit()

    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.EFFECT_RESOLVED,
        payload={**payload, "blocked": False},
    ).model_dump())
    if payload.get("game_over"):
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_ENDED,
            payload={"reason": payload.get("reason") or "Game completed", "winnerId": payload.get("winner_id")},
        ).model_dump())
    elif payload.get("turn_advanced"):
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.TURN_PASSED,
            payload={
                "passedPlayerId": payload.get("passed_player_id"),
                "nextPlayerId": game.current_player_id,
                "turnNumber": game.turn_number,
                "consecutivePasses": game.consecutive_passes,
                "reason": "ELIMINATED",
            }
        ).model_dump())
        stmt_next = select(GamePlayer).where(GamePlayer.id == game.current_player_id)
        next_p = (await db.execute(stmt_next)).scalar_one_or_none()
        if BotService.is_bot_player(next_p):
            asyncio.create_task(
                BotService.schedule_auto_bot_turn(game_id, next_p.id, game.turn_number, delay_seconds=2.8)
            )
    return {"status": "resolved", **payload}


@router.post("/{game_id}/leave")
async def leave_game(
    game_id: str,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db),
):
    game, is_over, reason, winner_id = await GameService.leave_game(db, game_id, x_player_id)
    await db.commit()
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.PLAYER_LEFT,
        payload={"playerId": x_player_id, "nextPlayerId": game.current_player_id, "turnNumber": game.turn_number},
    ).model_dump())
    if is_over or game.status == "FINISHED":
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_ENDED,
            payload={"reason": reason or "PLAYER_LEFT", "winnerId": winner_id},
        ).model_dump())
    return {"status": "left", "next_player_id": game.current_player_id, "game_over": game.status == "FINISHED"}


@router.post("/{game_id}/rematch", response_model=RematchResponse)
async def rematch(
    game_id: str,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Play again: open a lobby with this game's settings, or join the one another player already opened."""
    async with _rematch_locks[game_id]:
        room, new_game, player, created = await RoomService.rematch(db, game_id, x_player_id)
        await db.commit()

    if created:
        # Everyone still on the game-over screen can follow into the new lobby.
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.REMATCH_CREATED,
            payload={"playerId": x_player_id, "displayName": player.display_name, "gamePin": room.game_pin},
        ).model_dump())
    else:
        await manager.broadcast(room.id, WebSocketEvent(
            type=EventType.PLAYER_JOINED,
            payload={
                "playerId": player.id,
                "displayName": player.display_name,
                "isHost": player.is_host,
                "turnOrder": player.turn_order,
            },
        ).model_dump())

    return RematchResponse(
        game_id=new_game.id,
        game_pin=room.game_pin,
        player_id=player.id,
        session_token=player.session_token,
        display_name=player.display_name,
        is_host=player.is_host,
        created=created,
    )


@router.post("/{game_id}/bot/plan")
async def plan_bot_move(
    game_id: str,
    difficulty: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Calculates the bot's next move based on its rack and difficulty setting."""
    return await BotService.plan_bot_move(db, game_id, difficulty)


@router.post("/{game_id}/bot/execute")
async def execute_bot_move(
    game_id: str,
    req: dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    """Executes a previously planned bot move, pass, or exchange."""
    bot_player_id = req.get("bot_player_id")
    action = req.get("action", "PASS")
    if not bot_player_id:
        raise HTTPException(status_code=400, detail="Missing bot_player_id")

    # The client sends the plan it animated. If it had no move to play, decide here instead, so the
    # turn is still spent on whatever the rack genuinely allows (a move, an exchange, or a pass).
    if action != "MOVE" or not req.get("tiles"):
        outcome = await BotService.execute_bot_move_now(db, game_id, bot_player_id)
        if outcome is None:
            raise HTTPException(status_code=409, detail="The bot has no turn to take right now")
        return outcome

    if action == "MOVE":
        tiles_data = req.get("tiles", [])
        placed_tiles = [PlacedTileInput(**t) for t in tiles_data]
        res, game, player = await MoveService.commit_move(db, game_id, bot_player_id, placed_tiles)
        await db.commit()

        # Broadcast MOVE_COMMITTED
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.MOVE_COMMITTED,
            payload={
                "playerId": player.id,
                "turnNumber": game.turn_number,
                "placedTiles": [t.model_dump() for t in placed_tiles],
                "wordsFormed": [w.model_dump() for w in res.words_formed],
                "scoreEarned": res.score_earned,
                "playerTotalScore": player.score,
                "nextPlayerId": res.next_player_id,
                "boardState": game.board_state,
                "pendingEffect": game.pending_effect,
                "cardAwarded": res.card_awarded,
                "cardsAwarded": res.cards_awarded,
            }
        ).model_dump())

        if res.game_over:
            await manager.broadcast(game_id, WebSocketEvent(
                type=EventType.GAME_ENDED,
                payload={"reason": "Game completed", "winnerId": res.next_player_id},
            ).model_dump())
        elif res.next_player_id:
            from sqlalchemy import select
            from app.database.models import GamePlayer
            stmt_next = select(GamePlayer).where(GamePlayer.id == res.next_player_id)
            next_p = (await db.execute(stmt_next)).scalar_one_or_none()
            if BotService.is_bot_player(next_p):
                asyncio.create_task(
                    BotService.schedule_auto_bot_turn(game_id, next_p.id, game.turn_number, delay_seconds=6.0)
                )

        return {
            "status": "success",
            "action": "MOVE",
            "score_earned": res.score_earned,
            "next_player_id": res.next_player_id,
            "board_state": game.board_state,
            "turn_number": game.turn_number,
            "player_total_score": player.score,
            "placed_tiles": [t.model_dump() for t in placed_tiles],
            "words_formed": [w.model_dump() for w in res.words_formed],
        }

    elif action == "EXCHANGE":
        tile_ids = req.get("tile_ids", [])
        game, exchanged, is_over, reason, winner_id = await GameService.exchange_tiles(db, game_id, bot_player_id, tile_ids)
        await db.commit()
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.TILES_EXCHANGED if exchanged else EventType.TURN_PASSED,
            payload={
                "playerId": bot_player_id,
                "count": len(tile_ids) if exchanged else 0,
                "nextPlayerId": game.current_player_id,
                "turnNumber": game.turn_number,
            }
        ).model_dump())
        return {
            "status": "success",
            "action": "EXCHANGE",
            "next_player_id": game.current_player_id,
            "board_state": game.board_state,
            "turn_number": game.turn_number,
        }

    else:
        game, is_over, reason, winner_id = await GameService.pass_turn(db, game_id, bot_player_id)
        await db.commit()
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.TURN_PASSED,
            payload={
                "passedPlayerId": bot_player_id,
                "nextPlayerId": game.current_player_id,
                "turnNumber": game.turn_number,
                "consecutivePasses": game.consecutive_passes,
            }
        ).model_dump())
        return {
            "status": "success",
            "action": "PASS",
            "next_player_id": game.current_player_id,
            "board_state": game.board_state,
            "turn_number": game.turn_number,
        }


@router.get("/{game_id}/grimoire")
async def get_grimoire_words(
    game_id: str,
    token: Optional[str] = Query(None),
    x_session_token: Optional[str] = Header(None, alias="X-Session-Token"),
    x_player_id: Optional[str] = Header(None, alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns up to 20 playable words of length >= 3 for the requesting player's rack and current board.
    If grimoire mode is disabled for the match, returns enabled=False.
    """
    from sqlalchemy import select
    from app.database.models import Game, GameRoom, GamePlayer
    from app.database.state import board_state, player_rack
    from app.game.grimoire import find_grimoire_words

    stmt_game = select(Game).where(Game.id == game_id)
    game = (await db.execute(stmt_game)).scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    stmt_room = select(GameRoom).where(GameRoom.id == game_id)
    room = (await db.execute(stmt_room)).scalar_one_or_none()

    is_enabled = bool(getattr(game, "enable_grimoire", False) or (room and getattr(room, "enable_grimoire", False)))
    if not is_enabled:
        return {
            "enabled": False,
            "words": [],
            "count": 0,
            "message": "โหมดตำราถูกล็อคเนื่องจากไม่ได้เปิดใช้งานสำหรับห้องนี้",
        }

    # Identify the requesting player
    session_token = token or x_session_token
    player = None
    if session_token:
        player = await GameService.get_player_by_token(db, session_token)
    elif x_player_id:
        stmt_p = select(GamePlayer).where(GamePlayer.id == x_player_id, GamePlayer.game_id == game_id)
        player = (await db.execute(stmt_p)).scalar_one_or_none()

    if not player:
        if game.current_player_id:
            stmt_p = select(GamePlayer).where(GamePlayer.id == game.current_player_id)
            player = (await db.execute(stmt_p)).scalar_one_or_none()

    if not player:
        return {
            "enabled": True,
            "words": [],
            "count": 0,
            "message": "Player not found.",
        }

    rack = await player_rack(db, player.id)
    board = await board_state(db, game_id)

    words = find_grimoire_words(
        board_cells=board,
        rack_tiles=rack,
        is_first_move=(len(board) == 0),
        max_words=20,
        min_len=3,
    )

    return {
        "enabled": True,
        "words": words,
        "count": len(words),
        "turn_number": game.turn_number,
    }


