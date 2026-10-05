import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select
from fastapi import HTTPException

from app.database.models import Game, GamePlayer, Move, get_utc_now
from app.game.rules import RuleEngine
from app.game.game_end import GameEndService
from app.game.tiles import TileService
from app.services.game_service import GameService
from app.schemas.move import PlacedTileInput, ValidateMoveResponse, CommitMoveResponse, WordFormed, CellPosition
from app.game.board import Board
from app.database.state import (
    bag_tiles, board_state, player_rack, replace_board_state, replace_game_tiles, replace_player_cards,
)
from app.services.game_service import GameService
import random

class MoveService:

    # Every card a player can hold. Must stay in step with the handlers in app/api/cards.py and
    # with CARD_TYPES in frontend/lib/types.ts: a card missing here can never be awarded, and one
    # missing from the frontend list is awarded but never rendered.
    CARD_TYPES = (
        "HINT", "SPY_SWAP", "DESTROY_TILE", "HEAL", "DOUBLE_DAMAGE", "SHIELD", "FREEZE_TILE",
    )
    # Cards that only act on HP. Turn-count games deal no damage, so these would do nothing there.
    HP_CARD_TYPES = frozenset({"HEAL", "DOUBLE_DAMAGE", "SHIELD"})

    @classmethod
    def card_pool(cls, game: Game) -> tuple[str, ...]:
        """The cards a SECRET_POWER square (or Fancy's per-turn draw) can award in this game."""
        if game.game_mode in ("HP", "FANCY"):
            return cls.CARD_TYPES
        return ()  # CLASSIC and Quick Play (TURNS) have no cards at all

    @classmethod
    def _verify_tile_ownership(cls, player_rack: list[dict[str, Any]], placed_tiles: list[PlacedTileInput]) -> tuple[bool, str | None]:
        available = list(player_rack)
        for pt in placed_tiles:
            matched_idx = None
            # 1. Match by tile_id if given
            if pt.tile_id:
                for idx, t in enumerate(available):
                    t_id = t.get("id") or t.get("tile_id")
                    if t_id == pt.tile_id:
                        if t.get("letter", "").upper() == "BLANK" or t.get("letter", "").upper() == pt.letter.upper():
                            matched_idx = idx
                            break

            # 2. Match exact letter if tile_id didn't match
            if matched_idx is None:
                l = pt.letter.upper()
                for idx, t in enumerate(available):
                    if t.get("letter", "").upper() == l:
                        matched_idx = idx
                        break

            # 3. Match any available BLANK tile as wildcard fallback
            if matched_idx is None:
                for idx, t in enumerate(available):
                    if t.get("letter", "").upper() == "BLANK":
                        matched_idx = idx
                        break

            if matched_idx is None:
                return False, f"Tile '{pt.letter}' is not in your rack or has already been placed"

            available.pop(matched_idx)

        return True, None

    @staticmethod
    def _apply_rack_values(player_rack: list[dict[str, Any]], placed_tiles: list[PlacedTileInput]) -> None:
        """Score tiles by the server's letter values, overwriting whatever `value` the client sent."""
        rack_copy = list(player_rack)
        for tile in placed_tiles:
            tile.letter = tile.letter.upper()
            matched = None
            if tile.tile_id:
                for i, r in enumerate(rack_copy):
                    r_id = r.get("id") or r.get("tile_id")
                    if r_id == tile.tile_id:
                        matched = rack_copy.pop(i)
                        break
            if not matched:
                for i, r in enumerate(rack_copy):
                    if r.get("letter", "").upper() == tile.letter:
                        matched = rack_copy.pop(i)
                        break
            if not matched:
                for i, r in enumerate(rack_copy):
                    if r.get("letter", "").upper() == "BLANK":
                        matched = rack_copy.pop(i)
                        break

            if matched and matched.get("letter", "").upper() == "BLANK":
                tile.value = 0
            elif matched:
                tile.value = matched.get("value", 1)
            else:
                tile.value = 0

    @staticmethod
    def _words_formed(words: list[Any], breakdown: list[dict[str, Any]]) -> list[WordFormed]:
        # The breakdown lists the words in the same order (followed by any all-tiles bonus),
        # with letter multipliers already applied.
        return [WordFormed(word=w.word, score=b["total"], cells=w.cells) for w, b in zip(words, breakdown)]

    @classmethod
    async def validate_move(
        cls,
        db: AsyncSession,
        game_id: str,
        player_id: str,
        placed_tiles: list[PlacedTileInput]
    ) -> ValidateMoveResponse:
        # Fast non-locking query for move validation
        stmt_game = select(Game).where(Game.id == game_id)
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        if game.status != "PLAYING":
            return ValidateMoveResponse(valid=False, reason="Game is not currently active")

        # Players may validate off-turn to practise a word; committing still requires the turn.

        stmt_player = select(GamePlayer).where(GamePlayer.id == player_id)
        player = (await db.execute(stmt_player)).scalar_one_or_none()
        if not player:
            return ValidateMoveResponse(valid=False, reason="Player not found in game")
        if player.hp <= 0 or player.connection_status == "OFFLINE":
            return ValidateMoveResponse(valid=False, reason="This player cannot play")

        # Use fast in-memory JSON state to avoid redundant remote DB roundtrips
        normalized_board = game.board_state or {}
        normalized_rack = player.rack or []
        # Verify tile ownership in rack
        owns_tiles, err_ownership = cls._verify_tile_ownership(normalized_rack, placed_tiles)
        if not owns_tiles:
            return ValidateMoveResponse(valid=False, reason=err_ownership)
        cls._apply_rack_values(normalized_rack, placed_tiles)
        if game.banned_letter and game.banned_until_turn and game.turn_number <= game.banned_until_turn:
            if any(tile.letter.upper() == game.banned_letter and player.id != game.banned_by_player_id for tile in placed_tiles):
                return ValidateMoveResponse(valid=False, reason=f"Letter '{game.banned_letter}' is banned this turn")

        # Run authoritative rule engine
        placed_dicts = [pt.model_dump() for pt in placed_tiles]
        is_first = len(normalized_board) == 0

        valid, err, words, score, breakdown = RuleEngine.validate_move(
            board_cells=normalized_board,
            placed_tiles=placed_dicts,
            is_first_move=is_first
        )

        if valid and game.frozen_tile:
            frozen_cells = []
            if isinstance(game.frozen_tile, list):
                frozen_cells = [
                    (ft["row"], ft["col"]) for ft in game.frozen_tile
                    if game.turn_number <= ft.get("expires_turn", 0) and player.id != ft.get("set_by")
                ]
            elif isinstance(game.frozen_tile, dict) and game.turn_number <= game.frozen_tile.get("expires_turn", 0) and player.id != game.frozen_tile.get("set_by"):
                frozen_cells = [(game.frozen_tile["row"], game.frozen_tile["col"])]

            if any(fc in w.cells for fc in frozen_cells for w in words):
                valid, err, score = False, "That letter is frozen this turn", 0

        words_formed = cls._words_formed(words, breakdown)

        return ValidateMoveResponse(
            valid=valid,
            reason=err,
            words_formed=words_formed,
            estimated_score=score if valid else 0,
            bingo_bonus=50 if (valid and len(placed_tiles) >= 7) else 0,
        )


    @classmethod
    async def commit_move(
        cls,
        db: AsyncSession,
        game_id: str,
        player_id: str,
        placed_tiles: list[PlacedTileInput],
        freeze_tile_ids: list[str] | None = None,
        freeze_board_cells: list[CellPosition] | None = None,
        use_heal: bool = False,
    ) -> tuple[CommitMoveResponse, Game, GamePlayer]:
        stmt_game = select(Game).where(Game.id == game_id).with_for_update()
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        if game.status != "PLAYING":
            raise HTTPException(status_code=400, detail="Game is not currently active")

        if game.current_player_id != player_id:
            raise HTTPException(status_code=403, detail="It is not your turn to play")

        stmt_player = select(GamePlayer).where(GamePlayer.id == player_id)
        player = (await db.execute(stmt_player)).scalar_one_or_none()
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        if player.hp <= 0 or player.connection_status == "OFFLINE":
            raise HTTPException(status_code=403, detail="This player cannot play")

        normalized_board = game.board_state if (game.board_state is not None and isinstance(game.board_state, dict)) else await board_state(db, game_id)
        normalized_rack = player.rack if (player.rack is not None and isinstance(player.rack, list)) else await player_rack(db, player.id)
        normalized_cards = player.cards if (player.cards is not None and isinstance(player.cards, list)) else await player_cards(db, player.id)
        player.cards = list(normalized_cards)

        # Check tile ownership. Bots are held to this too: they used to have their rack rewritten to
        # fit whatever they wanted to play, which let them conjure letters they never drew.
        owns_tiles, err_ownership = cls._verify_tile_ownership(normalized_rack, placed_tiles)
        if not owns_tiles:
            raise HTTPException(status_code=400, detail=err_ownership)
        cls._apply_rack_values(normalized_rack, placed_tiles)
        if game.banned_letter and game.banned_until_turn and game.turn_number <= game.banned_until_turn:
            if any(tile.letter.upper() == game.banned_letter and player.id != game.banned_by_player_id for tile in placed_tiles):
                raise HTTPException(status_code=400, detail=f"Letter '{game.banned_letter}' is banned this turn")

        placed_dicts = [pt.model_dump() for pt in placed_tiles]
        is_first = len(normalized_board) == 0

        valid, err, words, score, breakdown = RuleEngine.validate_move(
            board_cells=normalized_board,
            placed_tiles=placed_dicts,
            is_first_move=is_first
        )

        if not valid:
            raise HTTPException(status_code=400, detail=f"Invalid move: {err}")

        if game.frozen_tile:
            frozen_cells = []
            if isinstance(game.frozen_tile, list):
                frozen_cells = [
                    (ft["row"], ft["col"]) for ft in game.frozen_tile
                    if game.turn_number <= ft.get("expires_turn", 0) and player.id != ft.get("set_by")
                ]
            elif isinstance(game.frozen_tile, dict) and game.turn_number <= game.frozen_tile.get("expires_turn", 0) and player.id != game.frozen_tile.get("set_by"):
                frozen_cells = [(game.frozen_tile["row"], game.frozen_tile["col"])]

            if any(fc in w.cells for fc in frozen_cells for w in words):
                raise HTTPException(status_code=400, detail="That letter is frozen this turn")

        # FREEZE_TILE played on up to 3 cells total, freely mixing tiles from this move itself
        # (freeze_tile_ids) and already-committed board tiles from a prior turn (freeze_board_cells):
        # all take effect once the move commits, below, in this same turn - staging it client-side
        # and only sending it here is what lets recalling a this-move tile act as cancelling its freeze.
        freeze_targets: list[tuple[int, int]] = []
        if freeze_tile_ids or freeze_board_cells:
            if "FREEZE_TILE" not in (player.cards or []):
                raise HTTPException(status_code=400, detail="You don't have a Freeze card")

            tile_cells: list[tuple[int, int]] = []
            if freeze_tile_ids:
                if len(freeze_tile_ids) != len(set(freeze_tile_ids)):
                    raise HTTPException(status_code=400, detail="Choose unique tiles to freeze")
                by_tile_id = {pt.tile_id: pt for pt in placed_tiles}
                matched = [by_tile_id[tid] for tid in freeze_tile_ids if tid in by_tile_id]
                if len(matched) != len(freeze_tile_ids):
                    raise HTTPException(status_code=400, detail="Freeze target is not part of this move")
                tile_cells = [(pt.row, pt.col) for pt in matched]

            board_cells: list[tuple[int, int]] = []
            if freeze_board_cells:
                for cell in freeze_board_cells:
                    if f"{cell.row}_{cell.col}" not in normalized_board:
                        raise HTTPException(status_code=400, detail=f"Board tile at ({cell.row}, {cell.col}) not found")
                board_cells = [(cell.row, cell.col) for cell in freeze_board_cells]

            freeze_targets = tile_cells + board_cells
            if not (1 <= len(freeze_targets) <= 3) or len(freeze_targets) != len(set(freeze_targets)):
                raise HTTPException(status_code=400, detail="Choose 1 to 3 unique tiles to freeze")

        # Commit tiles to board
        updated_board = dict(game.board_state)
        for pt in placed_tiles:
            key = f"{pt.row}_{pt.col}"
            updated_board[key] = {
                "row": pt.row,
                "col": pt.col,
                "letter": pt.letter.upper(),
                "value": pt.value,
                "player_id": player.id,
                "turn_number": game.turn_number
            }
        game.board_state = updated_board

        # Remove placed tiles from player rack
        remaining_rack = list(normalized_rack)
        for pt in placed_tiles:
            removed = False
            if pt.tile_id:
                for i, r_tile in enumerate(remaining_rack):
                    r_id = r_tile.get("id") or r_tile.get("tile_id")
                    if r_id == pt.tile_id:
                        remaining_rack.pop(i)
                        removed = True
                        break
            if not removed:
                for i, r_tile in enumerate(remaining_rack):
                    if r_tile.get("letter", "").upper() == pt.letter.upper():
                        remaining_rack.pop(i)
                        removed = True
                        break
            if not removed:
                for i, r_tile in enumerate(remaining_rack):
                    if r_tile.get("letter", "").upper() == "BLANK":
                        remaining_rack.pop(i)
                        removed = True
                        break

        # Draw replacement tiles from tile bag (auto-replenishes if bag runs out)
        tiles_needed = len(placed_tiles)
        bag = list(game.tile_bag) if (game.tile_bag is not None and isinstance(game.tile_bag, list)) else await bag_tiles(db, game.id)
        drawn_tiles, remaining_bag = TileService.draw_tiles(bag, tiles_needed, refill_if_empty=True)
        remaining_rack.extend(drawn_tiles)
        player.rack = remaining_rack
        game.tile_bag = remaining_bag
        flag_modified(player, "rack")
        flag_modified(game, "board_state")
        flag_modified(game, "tile_bag")

        # Award score
        player.score += score

        # Handle Heal armed for this move: 100% of the score it earns, resolved the same way
        # DOUBLE_DAMAGE is - the card is armed first, the effect lands once this move's score is known.
        healed_amount = 0
        is_heal_active = bool(use_heal or (game.pending_heal_player_id == player.id))
        held_cards = list(player.cards or [])
        if is_heal_active and "HEAL" in held_cards:
            held_cards.remove("HEAL")
            player.cards = held_cards
            await replace_player_cards(db, player.id, held_cards)
            game.pending_heal_player_id = None
            if score > 0:
                healed_amount = score
                max_cap = getattr(player, "max_hp", 100) or 100
                player.hp = min(max_cap, player.hp + healed_amount)
                flag_modified(player, "hp")
        elif is_heal_active:
            game.pending_heal_player_id = None

        cards_awarded: list[str] = []
        pool = cls.card_pool(game)
        # Fancy awards cards via the automatic per-turn draw (see GameService.grant_fancy_card)
        # instead of board tiles, so only HP mode's SECRET_POWER squares award cards here.
        power_cells_hit = [pt for pt in placed_tiles if pool and game.game_mode == "HP" and Board.is_power_cell(pt.row, pt.col)]
        if power_cells_hit:
            cards = list(player.cards or [])
            for _ in power_cells_hit:
                if len(cards) < 3:
                    new_card = random.choice(pool)
                    cards.append(new_card)
                    cards_awarded.append(new_card)
            player.cards = cards
            flag_modified(player, "cards")

        words_formed = cls._words_formed(words, breakdown)

        # Record Move
        rack_snapshot = [{"letter": t.get("letter", ""), "value": t.get("value", 0)} for t in normalized_rack]
        move_id = str(uuid.uuid4())
        cards_used: list[dict[str, Any]] = list(game.pending_card_events or [])
        if freeze_targets:
            cards_used.append({
                "card": "FREEZE_TILE",
                "cells": [{"row": r, "col": c} for r, c in freeze_targets],
                "description": f"Froze {len(freeze_targets)} tile{'s' if len(freeze_targets) > 1 else ''}",
            })
        if healed_amount > 0:
            cards_used.append({
                "card": "HEAL",
                "player_id": player.id,
                "player_name": player.display_name,
                "amount": healed_amount,
                "hp_after": player.hp,
                "turn_number": game.turn_number,
                "description": f"Healed self for +{healed_amount} HP (100% of {score} pts, Current HP: {player.hp})",
            })
        # cards_used also carries any SHIELD-use events queued earlier (see app/api/cards.py) -
        # that's how "who used Shield" only becomes visible once a turn actually ends, instead of
        # the instant it's pressed. revealed_card_events below broadcasts this same list live.
        revealed_card_events = list(cards_used)
        game.pending_card_events = []
        flag_modified(game, "pending_card_events")

        move = Move(
            id=move_id,
            game_id=game.id,
            player_id=player.id,
            turn_number=game.turn_number,
            move_type="PLACE",
            placed_tiles=[pt.model_dump() for pt in placed_tiles],
            words_formed=[wf.model_dump() for wf in words_formed],
            score_earned=score,
            rack_before=rack_snapshot,
            card_details=cards_used if cards_used else None,
        )
        db.add(move)

        # Advance turn
        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        all_players = (await db.execute(stmt_players)).scalars().all()

        if freeze_targets:
            held_cards = list(player.cards or [])
            if "FREEZE_TILE" in held_cards:
                held_cards.remove("FREEZE_TILE")
                player.cards = held_cards
                await replace_player_cards(db, player.id, held_cards)
            turns_to_block = max(1, len(GameService.eligible_players(all_players)) - 1)
            game.frozen_tile = [
                {
                    "row": r, "col": c,
                    "set_by": player.id, "expires_turn": game.turn_number + turns_to_block,
                }
                for r, c in freeze_targets
            ]
            flag_modified(game, "frozen_tile")

        # Score is authoritative damage to every other living player, doubled for a
        # DOUBLE_DAMAGE target. Applied after a short SHIELD window if any opponent has shield,
        # or applied immediately if no opponent can shield.
        double_damage_target_id = game.pending_double_target_id
        damage_dealt: dict[str, int] = {}
        if score > 0 and game.game_mode in ("HP", "FANCY"):
            has_shield_holder = any(
                getattr(p, "has_shield", False) or "SHIELD" in (p.cards or [])
                for p in all_players if p.id != player.id and p.hp > 0
            )
            amounts = {
                opponent.id: score * (2 if opponent.id == double_damage_target_id else 1)
                for opponent in all_players if opponent.id != player.id and opponent.hp > 0
            }
            damage_dealt = amounts
            game.pending_double_target_id = None
            if has_shield_holder:
                await GameService.queue_pending_effect(
                    db, game, type="DAMAGE", source_player_id=player.id, damage=amounts
                )
            else:
                # Nobody here can shield, so there is nothing to wait on: a held Shield fully
                # blocks this hit (one-time, not points-sized) and gets consumed immediately.
                for opponent in all_players:
                    if opponent.id in amounts:
                        amount = amounts[opponent.id]
                        if getattr(opponent, "has_shield", False):
                            opponent.has_shield = False
                            opponent.shield_amount = 0
                        else:
                            opponent.hp = max(0, opponent.hp - amount)
                        flag_modified(opponent, "shield_amount")
                        flag_modified(opponent, "has_shield")
                        flag_modified(opponent, "hp")

        completed_turn = game.turn_number
        reached_max_turns = bool(game.max_turns and completed_turn >= game.max_turns)
        game.consecutive_passes = 0
        if game.max_turns is not None:
            is_over, reason, winner = False, None, None
        else:
            is_over, reason, winner = GameEndService.check_game_over(
                game.tile_bag, GameService.players_summary(all_players), game.consecutive_passes,
                game_mode=game.game_mode,
            )
        game_over = is_over or reached_max_turns or GameService.too_few_players(all_players)
        if game_over:
            winner = await GameService.finish_game(db, game, all_players, winner)
            next_player_id = None
        else:
            next_player = GameService.next_player_after(all_players, player_id)
            if next_player is None or next_player.hp <= 0:
                winner = await GameService.finish_game(db, game, all_players, winner)
                game_over = True
                next_player_id = None
            else:
                next_player_id = next_player.id
                game.current_player_id = next_player_id
                game.turn_number += 1
                game.turn_started_at = get_utc_now()
                GameService.grant_fancy_card(game, next_player)

        await db.flush()

        res = CommitMoveResponse(
            success=True,
            move_id=move_id,
            turn_number=completed_turn,
            words_formed=words_formed,
            score_earned=score,
            bingo_bonus=50 if len(placed_tiles) >= 7 else 0,
            next_player_id=next_player_id,
            game_over=game_over,
            winner_id=winner,
            card_awarded=cards_awarded[0] if cards_awarded else None,
            cards_awarded=cards_awarded,
            damage_dealt=damage_dealt if damage_dealt else None,
            double_damage_target_id=double_damage_target_id,
            healed_amount=healed_amount if healed_amount > 0 else None,
            revealed_card_events=revealed_card_events,
        )

        return res, game, player
