from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.models import Game, GamePlayer, GameRoom
from app.database.session import get_db
from app.database.state import player_cards, player_rack, replace_game_tiles, replace_player_cards
from app.game.tiles import DEFAULT_LETTER_VALUES
from app.schemas.events import WebSocketEvent, EventType
from app.schemas.game import GameStateResponse
from app.services.game_service import GameService
from app.services.move_service import MoveService
from app.websocket.connection_manager import manager

router = APIRouter(prefix="/debug/games/{game_id}/players/{player_id}", tags=["Debug"])


async def _require_debug_mode(db: AsyncSession, game_id: str):
    """These tools only exist inside a room actually created with is_debug=True - not any game."""
    if not settings.DEBUG_MODE:
        raise HTTPException(status_code=404, detail="Not found")
    room = (await db.execute(select(GameRoom).where(GameRoom.id == game_id))).scalar_one_or_none()
    if not room or not room.is_debug:
        raise HTTPException(status_code=404, detail="Not found")


async def _load_game_and_player(db: AsyncSession, game_id: str, player_id: str) -> tuple[Game, GamePlayer]:
    game = (await db.execute(select(Game).where(Game.id == game_id))).scalar_one_or_none()
    player = (await db.execute(
        select(GamePlayer).where(GamePlayer.id == player_id, GamePlayer.game_id == game_id)
    )).scalar_one_or_none()
    if not game or not player:
        raise HTTPException(status_code=404, detail="Game or player not found")
    return game, player


class SetHpRequest(BaseModel):
    hp: int


@router.post("/hp", response_model=GameStateResponse)
async def set_hp(game_id: str, player_id: str, request: SetHpRequest, db: AsyncSession = Depends(get_db)):
    await _require_debug_mode(db, game_id)
    game, player = await _load_game_and_player(db, game_id, player_id)
    player.hp = max(0, request.hp)
    stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
    players = (await db.execute(stmt_players)).scalars().all()
    validation = await GameService.ensure_turn_order_valid(db, game, players)
    await db.commit()
    if validation["turn_advanced"]:
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.TURN_PASSED,
            payload={
                "passedPlayerId": validation["passed_player_id"],
                "nextPlayerId": game.current_player_id,
                "turnNumber": game.turn_number,
                "consecutivePasses": game.consecutive_passes,
                "reason": "ELIMINATED",
            }
        ).model_dump())
    elif validation["game_over"]:
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_ENDED,
            payload={"reason": validation["reason"] or "Game completed", "winnerId": validation["winner_id"]},
        ).model_dump())
    state = await GameService.get_game_state(db, game_id, reveal_all=True)
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.SNAPSHOT,
        payload=state.model_dump()
    ).model_dump())
    return state


class SetRackTileRequest(BaseModel):
    slot: int = Field(ge=0)
    letter: str = Field(min_length=1, max_length=1)


@router.post("/rack-tile", response_model=GameStateResponse)
async def set_rack_tile(game_id: str, player_id: str, request: SetRackTileRequest, db: AsyncSession = Depends(get_db)):
    await _require_debug_mode(db, game_id)
    game, player = await _load_game_and_player(db, game_id, player_id)
    rack = await player_rack(db, player_id)
    if request.slot >= len(rack):
        raise HTTPException(status_code=400, detail="That rack slot is empty")
    letter = request.letter.upper()
    rack[request.slot] = {
        "id": rack[request.slot]["id"],
        "letter": letter,
        "value": DEFAULT_LETTER_VALUES.get(letter, 1),
    }
    player.rack = rack
    players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game_id))).scalars().all()
    await replace_game_tiles(db, game_id, game.tile_bag, players)
    await db.commit()
    state = await GameService.get_game_state(db, game_id, reveal_all=True)
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.SNAPSHOT,
        payload=state.model_dump()
    ).model_dump())
    return state


class GrantCardRequest(BaseModel):
    card: str


@router.post("/cards", response_model=GameStateResponse)
async def grant_card(game_id: str, player_id: str, request: GrantCardRequest, db: AsyncSession = Depends(get_db)):
    await _require_debug_mode(db, game_id)
    _, player = await _load_game_and_player(db, game_id, player_id)
    card = request.card.upper()
    if card not in MoveService.CARD_TYPES:
        raise HTTPException(status_code=400, detail="Unknown card")
    cards = await player_cards(db, player_id)
    cards.append(card)
    player.cards = cards
    await replace_player_cards(db, player_id, cards)
    await db.commit()
    state = await GameService.get_game_state(db, game_id, reveal_all=True)
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.SNAPSHOT,
        payload=state.model_dump()
    ).model_dump())
    return state


@router.delete("/cards", response_model=GameStateResponse)
async def clear_cards(
    game_id: str,
    player_id: str,
    card_index: int | None = None,
    db: AsyncSession = Depends(get_db)
):
    await _require_debug_mode(db, game_id)
    _, player = await _load_game_and_player(db, game_id, player_id)
    cards = await player_cards(db, player_id)
    if card_index is not None:
        if 0 <= card_index < len(cards):
            cards.pop(card_index)
    else:
        cards = []
    player.cards = cards
    await replace_player_cards(db, player_id, cards)
    await db.commit()
    state = await GameService.get_game_state(db, game_id, reveal_all=True)
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.SNAPSHOT,
        payload=state.model_dump()
    ).model_dump())
    return state

