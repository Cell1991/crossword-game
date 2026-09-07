import random
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Game, GamePlayer
from app.database.session import get_db
from app.game.board import Board
from app.game.tiles import TileService
from app.database.state import bag_tiles, board_state, player_rack, player_cards, replace_board_state, replace_game_tiles, replace_player_cards

router = APIRouter(prefix="/games/{game_id}/cards", tags=["Cards"])


class CardUseRequest(BaseModel):
    card: str
    target_player_id: Optional[str] = None
    letter: Optional[str] = Field(None, min_length=1, max_length=1)
    row: Optional[int] = Field(None, ge=0, le=14)
    col: Optional[int] = Field(None, ge=0, le=14)
    own_tile_id: Optional[str] = None
    target_tile_id: Optional[str] = None


@router.post("/use")
async def use_card(
    game_id: str,
    request: CardUseRequest,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db),
):
    game = (await db.execute(select(Game).where(Game.id == game_id))).scalar_one_or_none()
    player = (await db.execute(select(GamePlayer).where(GamePlayer.id == x_player_id, GamePlayer.game_id == game_id))).scalar_one_or_none()
    if not game or not player:
        raise HTTPException(status_code=404, detail="Game or player not found")

    card = request.card.upper()
    cards = await player_cards(db, player.id)
    if card not in cards:
        raise HTTPException(status_code=400, detail="Card is not in your hand")
    cards.remove(card)
    player.cards = cards
    await replace_player_cards(db, player.id, cards)

    if card == "DRAW_TILE":
        bag = await bag_tiles(db, game.id)
        drawn, game.tile_bag = TileService.draw_tiles(bag, 1)
        player.rack = await player_rack(db, player.id) + drawn
        players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
        await replace_game_tiles(db, game.id, game.tile_bag, players)
        return {"success": True, "drawn": len(drawn)}

    if card == "HEAL":
        player.hp = min(100, player.hp + sum(int(tile["value"]) for tile in await player_rack(db, player.id)))
        return {"success": True, "hp": player.hp}

    if card in {"STEAL_TILE", "SPY_SWAP"}:
        target = await _target_player(db, game_id, request.target_player_id, player.id)
        if card == "STEAL_TILE":
            target_rack = await player_rack(db, target.id)
            if not target_rack:
                return {"success": True, "stolen": False}
            stolen = random.choice(target_rack)
            target.rack = [tile for tile in target_rack if tile["id"] != stolen["id"]]
            player.rack = await player_rack(db, player.id) + [stolen]
            players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
            await replace_game_tiles(db, game.id, game.tile_bag, players)
            return {"success": True, "stolen": True}
        player_rack_items = await player_rack(db, player.id)
        target_rack_items = await player_rack(db, target.id)
        own = next((tile for tile in player_rack_items if tile["id"] == request.own_tile_id), None)
        other = next((tile for tile in target_rack_items if tile["id"] == request.target_tile_id), None)
        if not own or not other:
            raise HTTPException(status_code=400, detail="Both swap tiles are required")
        player.rack = [other if tile["id"] == own["id"] else tile for tile in player_rack_items]
        target.rack = [own if tile["id"] == other["id"] else tile for tile in target_rack_items]
        players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
        await replace_game_tiles(db, game.id, game.tile_bag, players)
        return {"success": True}

    if card == "DESTROY_TILE":
        if request.row is None or request.col is None or Board.is_center(request.row, request.col):
            raise HTTPException(status_code=400, detail="Choose a non-center board tile")
        key = Board.key(request.row, request.col)
        current_board = await board_state(db, game.id)
        if key not in current_board:
            raise HTTPException(status_code=400, detail="Board tile not found")
        board = dict(current_board)
        del board[key]
        game.board_state = board
        await replace_board_state(db, game.id, board)
        return {"success": True}

    if card == "BAN_LETTER":
        if not request.letter or not request.letter.isalpha():
            raise HTTPException(status_code=400, detail="Choose a letter")
        game.banned_letter = request.letter.upper()
        game.banned_until_turn = game.turn_number + 1
        game.banned_by_player_id = player.id
        return {"success": True, "letter": game.banned_letter}

    raise HTTPException(status_code=400, detail="Unknown card")


async def _target_player(db: AsyncSession, game_id: str, target_id: Optional[str], own_id: str) -> GamePlayer:
    if not target_id or target_id == own_id:
        raise HTTPException(status_code=400, detail="Choose an opponent")
    target = (await db.execute(select(GamePlayer).where(GamePlayer.id == target_id, GamePlayer.game_id == game_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target player not found")
    return target
