import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.database.models import Game, GamePlayer, Move, get_utc_now
from app.game.rules import RuleEngine
from app.game.game_end import GameEndService
from app.game.tiles import TileService
from app.services.game_service import GameService
from app.schemas.move import PlacedTileInput, ValidateMoveResponse, CommitMoveResponse, WordFormed
from app.game.board import Board
from app.database.state import bag_tiles, board_state, player_rack, replace_board_state, replace_game_tiles
from app.services.game_service import GameService
import random

class MoveService:

    CARD_TYPES = (
        "HINT", "SPY_SWAP", "DESTROY_TILE", "HEAL", "DOUBLE_DAMAGE", "SHIELD", "FREEZE_TILE",
    )

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
        stmt_game = select(Game).where(Game.id == game_id).with_for_update()
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

        normalized_board = await board_state(db, game_id)
        normalized_rack = await player_rack(db, player.id)
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

        if valid and game.frozen_tile and game.turn_number <= game.frozen_tile["expires_turn"] and player.id != game.frozen_tile["set_by"]:
            frozen_cell = (game.frozen_tile["row"], game.frozen_tile["col"])
            if any(frozen_cell in w.cells for w in words):
                valid, err, score = False, "That letter is frozen this turn", 0

        words_formed = cls._words_formed(words, breakdown)

        return ValidateMoveResponse(
            valid=valid,
            reason=err,
            words_formed=words_formed,
            estimated_score=score if valid else 0
        )

    @classmethod
    async def commit_move(
        cls,
        db: AsyncSession,
        game_id: str,
        player_id: str,
        placed_tiles: list[PlacedTileInput]
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

        normalized_board = await board_state(db, game_id)
        normalized_rack = await player_rack(db, player.id)
        # Check tile ownership
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

        if game.frozen_tile and game.turn_number <= game.frozen_tile["expires_turn"] and player.id != game.frozen_tile["set_by"]:
            frozen_cell = (game.frozen_tile["row"], game.frozen_tile["col"])
            if any(frozen_cell in w.cells for w in words):
                raise HTTPException(status_code=400, detail="That letter is frozen this turn")

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
        await replace_board_state(db, game.id, updated_board)

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

        # Draw replacement tiles from tile bag
        tiles_needed = len(placed_tiles)
        bag = await bag_tiles(db, game.id)
        drawn_tiles, remaining_bag = TileService.draw_tiles(bag, tiles_needed)
        remaining_rack.extend(drawn_tiles)
        player.rack = remaining_rack
        game.tile_bag = remaining_bag

        # Award score
        player.score += score

        card_awarded = None
        if any((pt.row, pt.col) in Board.SECRET_POWER for pt in placed_tiles):
            cards = list(player.cards or [])
            if len(cards) < 3:
                card_awarded = random.choice(cls.CARD_TYPES)
                cards.append(card_awarded)
                player.cards = cards
                from app.database.state import replace_player_cards
                await replace_player_cards(db, player.id, cards)

        words_formed = cls._words_formed(words, breakdown)

        # Record Move
        move_id = str(uuid.uuid4())
        move = Move(
            id=move_id,
            game_id=game.id,
            player_id=player.id,
            turn_number=game.turn_number,
            move_type="PLACE",
            placed_tiles=[pt.model_dump() for pt in placed_tiles],
            words_formed=[wf.model_dump() for wf in words_formed],
            score_earned=score
        )
        db.add(move)

        # Advance turn
        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        all_players = (await db.execute(stmt_players)).scalars().all()

        # Score is authoritative damage to every other living player, doubled for a
        # DOUBLE_DAMAGE target. Applied after a short SHIELD window, not immediately.
        if score > 0:
            amounts = {
                opponent.id: score * (2 if opponent.id == game.pending_double_target_id else 1)
                for opponent in all_players if opponent.id != player.id
            }
            game.pending_double_target_id = None
            await GameService.queue_pending_effect(
                db, game, type="DAMAGE", source_player_id=player.id, damage=amounts
            )

        completed_turn = game.turn_number
        reached_max_turns = bool(game.max_turns and completed_turn >= game.max_turns)
        game.consecutive_passes = 0
        is_over, reason, winner = GameEndService.check_game_over(
            game.tile_bag, GameService.players_summary(all_players), game.consecutive_passes
        )
        game_over = is_over or reached_max_turns or GameService.too_few_players(all_players)
        if game_over:
            winner = await GameService.finish_game(db, game, all_players, winner)
            next_player_id = None
        else:
            next_player_id = GameService.next_player_after(all_players, player_id).id
            game.current_player_id = next_player_id
            game.turn_number += 1
            game.turn_started_at = get_utc_now()

        await db.flush()
        await replace_game_tiles(db, game.id, game.tile_bag, all_players)

        res = CommitMoveResponse(
            success=True,
            move_id=move_id,
            turn_number=completed_turn,
            words_formed=words_formed,
            score_earned=score,
            next_player_id=next_player_id,
            game_over=game_over,
            winner_id=winner,
            card_awarded=card_awarded,
        )

        return res, game, player
