import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.database.models import Game, GamePlayer, Move
from app.database.session import get_db
from app.game.board import Board
from app.game.hint import find_hint_suggestions, find_hint_candidates
from app.game.tiles import TileService, NotEnoughTilesInBag
from app.schemas.events import WebSocketEvent, EventType
from app.schemas.move import PlacedTileInput
from app.services.game_service import GameService
from app.services.move_service import MoveService
from app.websocket.connection_manager import manager
from app.database.state import bag_tiles, board_state, player_rack, player_cards, replace_board_state, replace_game_tiles, replace_player_cards

router = APIRouter(prefix="/games/{game_id}/cards", tags=["Cards"])


class FrozenCellInput(BaseModel):
    row: int = Field(..., ge=0, le=Board.ROWS - 1)
    col: int = Field(..., ge=0, le=Board.COLS - 1)


class CardUseRequest(BaseModel):
    card: str
    target_player_id: Optional[str] = None
    letter: Optional[str] = Field(None, min_length=1, max_length=1)
    row: Optional[int] = Field(None, ge=0, le=Board.ROWS - 1)
    col: Optional[int] = Field(None, ge=0, le=Board.COLS - 1)
    frozen_cells: Optional[list[FrozenCellInput]] = None
    own_tile_id: Optional[str] = None
    target_tile_id: Optional[str] = None
    own_tile_ids: Optional[list[str]] = Field(None, min_length=1, max_length=7)
    target_tile_indices: Optional[list[int]] = Field(None, min_length=1, max_length=7)
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
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="You can only use this on your turn")
        import asyncio
        from app.game.hint import hint_cache

        board = await board_state(db, game.id)
        rack = await player_rack(db, player.id)

        cache_key = hint_cache.compute_cache_key(
            game_id=game.id,
            turn_number=game.turn_number,
            player_id=player.id,
            board_cells=board,
            rack_tiles=rack,
            max_suggestions=3,
        )
        suggestions = hint_cache.get(cache_key)
        if suggestions is None:
            suggestions = await asyncio.to_thread(
                find_hint_suggestions,
                board_cells=board,
                rack_tiles=rack,
                is_first_move=(len(board) == 0),
                max_suggestions=3,
            )
            hint_cache.set(cache_key, suggestions)

        if not suggestions:
            return {"success": True, "found": False, "suggestions": []}
        cards.remove(card)
        player.cards = cards
        await replace_player_cards(db, player.id, cards)

        # Record card event for current turn
        card_event = {
            "card": "HINT",
            "player_id": player.id,
            "player_name": player.display_name,
            "turn_number": game.turn_number,
            "description": "Used Hint card to find word suggestions",
        }
        pending = list(game.pending_card_events or [])
        pending.append(card_event)
        game.pending_card_events = pending
        flag_modified(game, "pending_card_events")
        await db.commit()

        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.CARD_USED,
            payload={"playerId": player.id, "card": card},
        ).model_dump())
        first_tile = suggestions[0]["tiles"][0] if suggestions[0]["tiles"] else {"row": 9, "col": 13}
        return {
            "success": True,
            "found": True,
            "row": first_tile.get("row", 9),
            "col": first_tile.get("col", 13),
            "suggestions": suggestions,
        }

    if card == "SHIELD":
        cards.remove(card)
        player.cards = cards
        # Shield is a one-time full block, not a points-sized pool: no score math, just "armed".
        player.has_shield = True
        player.shield_amount = 0
        await replace_player_cards(db, player.id, cards)

        effect = game.pending_effect
        if effect:
            expires_at = datetime.fromisoformat(effect["expires_at"])
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) >= expires_at:
                effect = None
        targets_me = effect and (
            (effect["type"] == "DAMAGE" and player.id in effect.get("damage", {}))
            or (effect["type"] in ("SWAP", "SPY_SWAP") and player.id == effect.get("target_player_id"))
        )
        blocked = bool(targets_me)

        if blocked:
            player.has_shield = False
            if effect["type"] == "DAMAGE":
                remaining_damage = {pid: amount for pid, amount in effect["damage"].items() if pid != player.id}
                game.pending_effect = {**effect, "damage": remaining_damage} if remaining_damage else None
            else:
                game.pending_effect = None
            flag_modified(player, "has_shield")

        flag_modified(player, "shield_amount")

        # Deliberately no live CARD_USED/EFFECT_RESOLVED broadcast here: who used Shield (and
        # whether it blocked anything) stays hidden until the next move commits and surfaces it
        # via revealed_card_events - that's "announce after the turn ends", not the instant it's used.
        card_event = {
            "card": "SHIELD",
            "player_id": player.id,
            "player_name": player.display_name,
            "turn_number": game.turn_number,
            "blocked": blocked,
            "description": "Blocked an incoming attack with Shield!" if blocked else "Activated Shield (fully blocks the next hit)",
        }
        pending = list(game.pending_card_events or [])
        pending.append(card_event)
        game.pending_card_events = pending
        flag_modified(game, "pending_card_events")

        await db.commit()
        # A silent refresh only - no identity or outcome revealed live.
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_STATE_SYNC,
            payload={"reason": "SHIELD_USED"},
        ).model_dump())
        return {"success": True, "blocked": blocked, "has_shield": player.has_shield, "shield_amount": player.shield_amount}

    if card == "DOUBLE_DAMAGE":
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="Double Damage can only be used on your turn")
        target = await _target_player(db, game_id, request.target_player_id, player.id)
        game.pending_double_target_id = target.id
        cards.remove(card)
        player.cards = cards
        await replace_player_cards(db, player.id, cards)

        card_event = {
            "card": "DOUBLE_DAMAGE",
            "player_id": player.id,
            "player_name": player.display_name,
            "target_player_id": target.id,
            "target_player_name": target.display_name,
            "turn_number": game.turn_number,
            "description": f"Targeted {target.display_name} with Double Damage",
        }
        pending = list(game.pending_card_events or [])
        pending.append(card_event)
        game.pending_card_events = pending
        flag_modified(game, "pending_card_events")
        await db.commit()

        # Deliberately no target reveal here: the victim (and everyone else) only learns who was
        # targeted once the hit actually lands, via MOVE_COMMITTED's doubleDamageTargetId. A bare
        # GAME_STATE_SYNC still lets the caster's own client refresh its hand/armed state.
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_STATE_SYNC,
            payload={"reason": "DOUBLE_DAMAGE_ARMED"},
        ).model_dump())
        return {"success": True, "target_player_id": target.id}

    cards.remove(card)
    player.cards = cards
    await replace_player_cards(db, player.id, cards)

    if card == "HEAL":
        heal_amt = player.score if player.score > 0 else 0
        max_cap = getattr(player, "max_hp", 100) or 100
        old_hp = player.hp
        player.hp = min(max_cap, player.hp + heal_amt)
        actual_heal = player.hp - old_hp

        card_event = {
            "card": "HEAL",
            "player_id": player.id,
            "player_name": player.display_name,
            "amount": actual_heal,
            "hp_after": player.hp,
            "turn_number": game.turn_number,
            "description": f"Healed self for +{actual_heal} HP (100% of {player.score} pts, Current HP: {player.hp})",
        }
        pending = list(game.pending_card_events or [])
        pending.append(card_event)
        game.pending_card_events = pending
        flag_modified(game, "pending_card_events")
        await db.commit()

        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.CARD_USED,
            payload={
                "playerId": player.id,
                "card": card,
                "targetPlayerId": player.id,
                "amount": actual_heal,
                "hp": player.hp,
            },
        ).model_dump())
        return {"success": True, "hp": player.hp}

    if card == "SPY_SWAP":
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="Spy Swap can only be used on your turn")
        target = await _target_player(db, game_id, request.target_player_id, player.id)
        player_rack_items = await player_rack(db, player.id)
        target_rack_items = await player_rack(db, target.id)
        if request.own_tile_ids is not None or request.target_tile_indices is not None:
            own_tile_ids = request.own_tile_ids or []
            target_tile_indices = request.target_tile_indices or []
            if not 1 <= len(own_tile_ids) <= 7 or len(own_tile_ids) != len(set(own_tile_ids)):
                raise HTTPException(status_code=400, detail="Choose one to seven different tiles from your rack")
            if len(target_tile_indices) != len(own_tile_ids) or len(target_tile_indices) != len(set(target_tile_indices)):
                raise HTTPException(status_code=400, detail="Choose the same number of different opponent tiles")
            own_tiles = {tile["id"]: tile for tile in player_rack_items}
            if any(tile_id not in own_tiles for tile_id in own_tile_ids):
                raise HTTPException(status_code=400, detail="A selected tile is no longer in your rack")
            if any(index < 0 or index >= len(target_rack_items) for index in target_tile_indices):
                raise HTTPException(status_code=400, detail="An opponent tile selection is no longer available")
            target_tile_ids = [target_rack_items[index]["id"] for index in target_tile_indices]
            own_tile_by_id = {tile["id"]: tile for tile in player_rack_items}
            target_tile_by_id = {tile["id"]: tile for tile in target_rack_items}
            own_to_target = dict(zip(own_tile_ids, (target_tile_by_id[tile_id] for tile_id in target_tile_ids)))
            target_to_own = dict(zip(target_tile_ids, (own_tile_by_id[tile_id] for tile_id in own_tile_ids)))
            player.rack = [own_to_target.get(tile["id"], tile) for tile in player_rack_items]
            target.rack = [target_to_own.get(tile["id"], tile) for tile in target_rack_items]
            players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
            await replace_game_tiles(db, game.id, await bag_tiles(db, game.id), players)

            card_event = {
                "card": "SPY_SWAP",
                "player_id": player.id,
                "player_name": player.display_name,
                "target_player_id": target.id,
                "target_player_name": target.display_name,
                "count": len(own_tile_ids),
                "turn_number": game.turn_number,
                "description": f"Swapped {len(own_tile_ids)} tile{'s' if len(own_tile_ids) > 1 else ''} with {target.display_name}",
            }
            pending = list(game.pending_card_events or [])
            pending.append(card_event)
            game.pending_card_events = pending
            flag_modified(game, "pending_card_events")
            await db.commit()

            await manager.broadcast(game_id, WebSocketEvent(
                type=EventType.EFFECT_RESOLVED,
                payload={
                    "type": "SPY_SWAP",
                    "performed": True,
                    "sourcePlayerId": player.id,
                    "targetPlayerId": target.id,
                    "count": len(own_tile_ids),
                },
            ).model_dump())
            return {"success": True, "pending": False, "count": len(own_tile_ids)}

        # Keep accepting the original one-tile payload for existing clients.
        own = next((tile for tile in player_rack_items if tile["id"] == request.own_tile_id), None)
        other = next((tile for tile in target_rack_items if tile["id"] == request.target_tile_id), None)
        if not own or not other:
            raise HTTPException(status_code=400, detail="Both swap tiles are required")
        await GameService.queue_pending_effect(
            db, game, type="SWAP", source_player_id=player.id, target_player_id=target.id,
            own_tile=own, target_tile=other,
        )
        card_event = {
            "card": "SPY_SWAP",
            "player_id": player.id,
            "player_name": player.display_name,
            "target_player_id": target.id,
            "target_player_name": target.display_name,
            "count": 1,
            "turn_number": game.turn_number,
            "description": f"Initiated tile swap with {target.display_name}",
        }
        pending = list(game.pending_card_events or [])
        pending.append(card_event)
        game.pending_card_events = pending
        flag_modified(game, "pending_card_events")
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

    if card == "FREEZE_TILE":
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="You can only use this on your turn")

        target_cells: list[tuple[int, int]] = []
        if request.frozen_cells:
            for fc in request.frozen_cells:
                target_cells.append((fc.row, fc.col))
        elif request.row is not None and request.col is not None:
            target_cells.append((request.row, request.col))
        else:
            raise HTTPException(status_code=400, detail="Choose 1 to 3 board tiles to freeze")

        if not (1 <= len(target_cells) <= 3) or len(target_cells) != len(set(target_cells)):
            raise HTTPException(status_code=400, detail="Choose 1 to 3 unique board tiles to freeze")

        current_board = await board_state(db, game.id)
        for r, c in target_cells:
            if Board.key(r, c) not in current_board:
                raise HTTPException(status_code=400, detail=f"Board tile at ({r}, {c}) not found")

        # Block every opponent's turn until this wraps back around to the freezer, not just the
        # next one - with N players in rotation that is N-1 turns, regardless of table size.
        all_players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
        turns_to_block = max(1, len(GameService.eligible_players(all_players)) - 1)
        new_frozen = [
            {
                "row": r, "col": c,
                "set_by": player.id, "expires_turn": game.turn_number + turns_to_block,
            }
            for r, c in target_cells
        ]
        game.frozen_tile = new_frozen
        flag_modified(game, "frozen_tile")

        card_event = {
            "card": "FREEZE_TILE",
            "player_id": player.id,
            "player_name": player.display_name,
            "count": len(target_cells),
            "cells": [{"row": r, "col": c} for r, c in target_cells],
            "turn_number": game.turn_number,
            "description": f"Froze {len(target_cells)} board tile{'s' if len(target_cells) > 1 else ''}",
        }
        pending = list(game.pending_card_events or [])
        pending.append(card_event)
        game.pending_card_events = pending
        flag_modified(game, "pending_card_events")
        await db.commit()

        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.CARD_USED,
            payload={
                "playerId": player.id,
                "card": card,
                "cells": [{"row": r, "col": c} for r, c in target_cells],
                "row": target_cells[0][0],
                "col": target_cells[0][1],
            },
        ).model_dump())
        return {"success": True, "count": len(target_cells)}

    if card == "DESTROY_TILE":
        if game.current_player_id != player.id:
            raise HTTPException(status_code=400, detail="Destroy Tile can only be used on your turn")
        if request.row is None or request.col is None or Board.is_center(request.row, request.col):
            raise HTTPException(status_code=400, detail="Choose a non-center board tile")
        key = Board.key(request.row, request.col)
        current_board = await board_state(db, game.id)
        if key not in current_board:
            raise HTTPException(status_code=400, detail="Board tile not found")
        destroyed_letter = current_board.get(key, {}).get("letter", "")
        board = dict(current_board)
        del board[key]
        game.board_state = board
        await replace_board_state(db, game.id, board)

        card_event = {
            "card": "DESTROY_TILE",
            "player_id": player.id,
            "player_name": player.display_name,
            "row": request.row,
            "col": request.col,
            "destroyed_letter": destroyed_letter,
            "turn_number": game.turn_number,
            "description": f"Destroyed board tile '{destroyed_letter}' at ({request.row}, {request.col})",
        }
        pending = list(game.pending_card_events or [])
        pending.append(card_event)
        game.pending_card_events = pending
        flag_modified(game, "pending_card_events")
        await db.commit()

        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.CARD_USED,
            payload={
                "playerId": player.id,
                "card": card,
                "row": request.row,
                "col": request.col,
            },
        ).model_dump())
        return {"success": True}

    raise HTTPException(status_code=400, detail="Unknown card")


class SpySwapPeekRequest(BaseModel):
    target_player_id: str


@router.post("/spy-swap/peek")
async def peek_spy_swap_target(
    game_id: str,
    request: SpySwapPeekRequest,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db),
):
    """Reveals an opponent's rack letters to the Spy Swap caster only, so they can pick
    deliberately instead of blind-guessing by index. Read-only: costs nothing, spends no card -
    only Confirm Swap (the existing /use endpoint) actually consumes the card and trades tiles."""
    game = (await db.execute(select(Game).where(Game.id == game_id))).scalar_one_or_none()
    player = (await db.execute(select(GamePlayer).where(GamePlayer.id == x_player_id, GamePlayer.game_id == game_id))).scalar_one_or_none()
    if not game or not player:
        raise HTTPException(status_code=404, detail="Game or player not found")
    if game.status != "PLAYING":
        raise HTTPException(status_code=400, detail="Game is not currently active")
    if game.current_player_id != player.id:
        raise HTTPException(status_code=400, detail="Spy Swap can only be used on your turn")
    cards = await player_cards(db, player.id)
    if "SPY_SWAP" not in cards:
        raise HTTPException(status_code=400, detail="You don't have a Spy Swap card")

    target = await _target_player(db, game_id, request.target_player_id, player.id)
    target_rack = await player_rack(db, target.id)
    return {
        "success": True,
        "target_player_id": target.id,
        "rack": [{"letter": t.get("letter", ""), "value": t.get("value", 0)} for t in target_rack],
    }


async def _target_player(db: AsyncSession, game_id: str, target_id: Optional[str], own_id: str) -> GamePlayer:
    if not target_id or target_id == own_id:
        raise HTTPException(status_code=400, detail="Choose an opponent")
    target = (await db.execute(select(GamePlayer).where(GamePlayer.id == target_id, GamePlayer.game_id == game_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target player not found")
    return target
