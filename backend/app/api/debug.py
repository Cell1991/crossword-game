from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.models import Game, GamePlayer
from app.database.session import get_db
from app.database.state import player_cards, player_rack, replace_game_tiles, replace_player_cards
from app.game.tiles import DEFAULT_LETTER_VALUES
from app.schemas.game import GameStateResponse
from app.services.game_service import GameService
from app.services.move_service import MoveService

router = APIRouter(prefix="/debug/games/{game_id}/players/{player_id}", tags=["Debug"])


def _require_debug_mode():
    if not settings.DEBUG_MODE:
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
    _require_debug_mode()
    _, player = await _load_game_and_player(db, game_id, player_id)
    player.hp = max(0, request.hp)
    return await GameService.get_game_state(db, game_id, reveal_all=True)


class SetRackTileRequest(BaseModel):
    slot: int = Field(ge=0)
    letter: str = Field(min_length=1, max_length=1)


@router.post("/rack-tile", response_model=GameStateResponse)
async def set_rack_tile(game_id: str, player_id: str, request: SetRackTileRequest, db: AsyncSession = Depends(get_db)):
    _require_debug_mode()
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
    return await GameService.get_game_state(db, game_id, reveal_all=True)


class GrantCardRequest(BaseModel):
    card: str


@router.post("/cards", response_model=GameStateResponse)
async def grant_card(game_id: str, player_id: str, request: GrantCardRequest, db: AsyncSession = Depends(get_db)):
    _require_debug_mode()
    _, player = await _load_game_and_player(db, game_id, player_id)
    card = request.card.upper()
    if card not in MoveService.CARD_TYPES:
        raise HTTPException(status_code=400, detail="Unknown card")
    cards = await player_cards(db, player_id)
    cards.append(card)
    player.cards = cards
    await replace_player_cards(db, player_id, cards)
    return await GameService.get_game_state(db, game_id, reveal_all=True)
