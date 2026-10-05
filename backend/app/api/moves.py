from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.models import GamePlayer
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
    res, game, player = await MoveService.commit_move(
        db, game_id, x_player_id, req.placed_tiles,
        freeze_tile_ids=req.freeze_tile_ids,
        use_heal=bool(req.use_heal),
    )
    # Save before telling anyone: clients reload the game the moment an event arrives.
    await db.commit()

    stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id)
    all_game_players = (await db.execute(stmt_players)).scalars().all()

    # Broadcast MOVE_COMMITTED
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.MOVE_COMMITTED,
        payload={
            "playerId": player.id,
            "turnNumber": game.turn_number,
            "placedTiles": [t.model_dump() for t in req.placed_tiles],
            "wordsFormed": [w.model_dump() for w in res.words_formed],
            "scoreEarned": res.score_earned,
            "playerTotalScore": player.score,
            "nextPlayerId": res.next_player_id,
            "boardState": game.board_state,
            "pendingEffect": game.pending_effect,
            "frozenTile": game.frozen_tile,
            "cardAwarded": res.card_awarded,
            "cardsAwarded": res.cards_awarded,
            "damageDealt": res.damage_dealt,
            "doubleDamageTargetId": res.double_damage_target_id,
            "healedAmount": res.healed_amount,
            "revealedCardEvents": res.revealed_card_events,
            "players": [
                {
                    "id": p.id,
                    "hp": p.hp,
                    "score": p.score,
                    "cards": p.cards or [],
                }
                for p in all_game_players
            ],
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
    elif res.next_player_id:
        import asyncio
        from app.services.bot_service import BotService
        stmt_next = select(GamePlayer).where(GamePlayer.id == res.next_player_id)
        next_p = (await db.execute(stmt_next)).scalar_one_or_none()
        if BotService.is_bot_player(next_p):
            asyncio.create_task(
                BotService.schedule_auto_bot_turn(game_id, next_p.id, game.turn_number, delay_seconds=BotService.FALLBACK_DELAY_SECONDS)
            )

    return res
