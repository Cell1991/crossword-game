from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.move import (
    ValidateMoveRequest,
    ValidateMoveResponse,
    CommitMoveRequest,
    CommitMoveResponse
)
from app.schemas.events import WebSocketEvent, EventType
from app.services.move_service import MoveService
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/games/{game_id}/moves", tags=["Moves"])

@router.post("/validate", response_model=ValidateMoveResponse)
async def validate_move(
    game_id: str,
    req: ValidateMoveRequest,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db)
):
    return await MoveService.validate_move(db, game_id, x_player_id, req.placed_tiles)

@router.post("", response_model=CommitMoveResponse)
async def commit_move(
    game_id: str,
    req: CommitMoveRequest,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db)
):
    res, game, player = await MoveService.commit_move(db, game_id, x_player_id, req.placed_tiles)

    # Broadcast MOVE_COMMITTED
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.MOVE_COMMITTED,
        payload={
            "playerId": player.id,
            "turnNumber": res.turn_number,
            "placedTiles": [t.model_dump() for t in req.placed_tiles],
            "wordsFormed": [w.model_dump() for w in res.words_formed],
            "scoreEarned": res.score_earned,
            "playerTotalScore": player.score,
            "nextPlayerId": res.next_player_id,
            "boardState": game.board_state
        }
    ).model_dump())

    if res.game_over:
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_ENDED,
            payload={
                "reason": "Game completed",
                "winnerId": res.winner_id
            }
        ).model_dump())

    return res
