from typing import Optional
from fastapi import APIRouter, Depends, Header, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.game import GameStateResponse
from app.schemas.move import ExchangeTilesRequest
from app.schemas.events import WebSocketEvent, EventType
from app.services.game_service import GameService
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/games", tags=["Games"])

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
