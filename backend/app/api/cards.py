import random
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Game, GamePlayer
from app.database.session import get_db
from app.game.board import Board
from app.game.hint import find_hint_candidates
from app.game.tiles import TileService, NotEnoughTilesInBag
from app.schemas.events import WebSocketEvent, EventType
from app.schemas.move import PlacedTileInput
from app.services.game_service import GameService
from app.services.move_service import MoveService
from app.websocket.connection_manager import manager
from app.database.state import bag_tiles, board_state, player_rack, player_cards, replace_board_state, replace_game_tiles, replace_player_cards

router = APIRouter(prefix="/games/{game_id}/cards", tags=["Cards"])


class CardUseRequest(BaseModel):
    card: str
    target_player_id: Optional[str] = None
    letter: Optional[str] = Field(None, min_length=1, max_length=1)
    row: Optional[int] = Field(None, ge=0, le=Board.ROWS - 1)
    col: Optional[int] = Field(None, ge=0, le=Board.COLS - 1)
    own_tile_id: Optional[str] = None
    target_tile_id: Optional[str] = None
    placed_tiles: Optional[list[PlacedTileInput]] = None


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
    if game.status != "PLAYING":
        raise HTTPException(status_code=400, detail="Game is not currently active")
    # Knocked-out players and players who left are out of the game; HEAL must not revive them.
    if player.hp <= 0 or player.connection_status == "OFFLINE":
        raise HTTPException(status_code=403, detail="This player cannot play")

    card = request.card.upper()
    cards = await player_cards(db, player.id)
    if card not in cards:
        raise HTTPException(status_code=400, detail="Card is not in your hand")

    if card == "HINT":
        # find_hint_candidates is a best-effort heuristic (see app/game/hint.py) that can come up
        # empty even when a valid move exists — don't burn the player's card on a failed search.
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="You can only use this on your turn")
        board = await board_state(db, game.id)
        rack = await player_rack(db, player.id)
        candidates = find_hint_candidates(board, [t["letter"] for t in rack], is_first_move=len(board) == 0)
        if not candidates:
            return {"success": True, "found": False}
        row, col = random.choice(candidates)
        cards.remove(card)
        player.cards = cards
        await replace_player_cards(db, player.id, cards)
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.CARD_USED,
            payload={"playerId": player.id, "card": card},
        ).model_dump())
        return {"success": True, "found": True, "row": row, "col": col}

    if card == "SHIELD":
        effect = game.pending_effect
        if effect:
            expires_at = datetime.fromisoformat(effect["expires_at"])
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) >= expires_at:
                effect = None
        targets_me = effect and (
            (effect["type"] == "DAMAGE" and player.id in effect.get("damage", {}))
            or (effect["type"] == "SWAP" and player.id == effect.get("target_player_id"))
        )
        if not targets_me:
            raise HTTPException(status_code=400, detail="No incoming effect to block")

        cards.remove(card)
        await replace_player_cards(db, player.id, cards)
        if effect["type"] == "DAMAGE":
            remaining_damage = {pid: amount for pid, amount in effect["damage"].items() if pid != player.id}
            game.pending_effect = {**effect, "damage": remaining_damage} if remaining_damage else None
        else:
            game.pending_effect = None
        await db.commit()
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.CARD_USED,
            payload={"playerId": player.id, "card": card},
        ).model_dump())
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.EFFECT_RESOLVED,
            payload={"type": effect["type"], "blocked": True, "blockedBy": player.id},
        ).model_dump())
        return {"success": True, "blocked": True}

    cards.remove(card)
    player.cards = cards
    await replace_player_cards(db, player.id, cards)
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.CARD_USED,
        payload={"playerId": player.id, "card": card},
    ).model_dump())

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

    if card == "STEAL_TILE":
        target = await _target_player(db, game_id, request.target_player_id, player.id)
        target_rack = await player_rack(db, target.id)
        if not target_rack:
            return {"success": True, "stolen": False}
        stolen = random.choice(target_rack)
        target.rack = [tile for tile in target_rack if tile["id"] != stolen["id"]]
        player.rack = await player_rack(db, player.id) + [stolen]
        players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
        await replace_game_tiles(db, game.id, game.tile_bag, players)
        return {"success": True, "stolen": True}

    if card == "SPY_SWAP":
        target = await _target_player(db, game_id, request.target_player_id, player.id)
        player_rack_items = await player_rack(db, player.id)
        target_rack_items = await player_rack(db, target.id)
        own = next((tile for tile in player_rack_items if tile["id"] == request.own_tile_id), None)
        other = next((tile for tile in target_rack_items if tile["id"] == request.target_tile_id), None)
        if not own or not other:
            raise HTTPException(status_code=400, detail="Both swap tiles are required")
        await GameService.queue_pending_effect(
            db, game, type="SWAP", source_player_id=player.id, target_player_id=target.id,
            own_tile=own, target_tile=other,
        )
        await db.commit()
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.EFFECT_PENDING,
            payload={
                "type": "SWAP",
                "sourcePlayerId": player.id,
                "targetPlayerId": target.id,
                "expiresAt": game.pending_effect["expires_at"],
            },
        ).model_dump())
        return {"success": True, "pending": True}

    if card == "FREE_EXCHANGE":
        rack = await player_rack(db, player.id)
        if not rack:
            return {"success": True, "exchanged": 0}
        bag = await bag_tiles(db, game.id)
        try:
            new_rack, new_bag = TileService.exchange_tiles(rack, bag, [t["id"] for t in rack])
        except (ValueError, NotEnoughTilesInBag) as error:
            raise HTTPException(status_code=400, detail=str(error))
        player.rack = new_rack
        game.tile_bag = new_bag
        players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
        await replace_game_tiles(db, game.id, game.tile_bag, players)
        return {"success": True, "exchanged": len(new_rack)}

    if card == "MOVE_HEAL":
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="You can only use this on your turn")
        if not request.placed_tiles:
            raise HTTPException(status_code=400, detail="Provide the move you are about to confirm")
        validation = await MoveService.validate_move(db, game_id, player.id, request.placed_tiles)
        if not validation.valid:
            raise HTTPException(status_code=400, detail=validation.reason or "That move is not valid")
        base_points = sum(pt.value for pt in request.placed_tiles)
        player.hp = min(100, player.hp + base_points)
        return {"success": True, "healed": base_points, "hp": player.hp}

    if card == "DOUBLE_DAMAGE":
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="You can only use this on your turn")
        target = await _target_player(db, game_id, request.target_player_id, player.id)
        game.pending_double_target_id = target.id
        return {"success": True, "target_player_id": target.id}

    if card == "FREEZE_TILE":
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="You can only use this on your turn")
        if request.row is None or request.col is None:
            raise HTTPException(status_code=400, detail="Choose a board tile")
        current_board = await board_state(db, game.id)
        if Board.key(request.row, request.col) not in current_board:
            raise HTTPException(status_code=400, detail="Board tile not found")
        game.frozen_tile = {
            "row": request.row, "col": request.col,
            "set_by": player.id, "expires_turn": game.turn_number + 1,
        }
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
