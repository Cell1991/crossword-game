import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.database.models import Game, GamePlayer, Move, GameRoom, get_utc_now
from app.game.rules import RuleEngine
from app.game.game_end import GameEndService
from app.game.tiles import TileService
from app.schemas.move import PlacedTileInput, ValidateMoveResponse, CommitMoveResponse, WordFormed
from app.game.board import Board
from app.database.state import bag_tiles, board_state, player_rack, replace_board_state, replace_game_tiles
import random

class MoveService:

    CARD_TYPES = ("DRAW_TILE", "HEAL", "STEAL_TILE", "SPY_SWAP", "DESTROY_TILE", "BAN_LETTER")

    @classmethod
    def _verify_tile_ownership(cls, player_rack: list[dict[str, Any]], placed_tiles: list[PlacedTileInput]) -> tuple[bool, str | None]:
        rack_counts: dict[str, int] = {}
        for t in player_rack:
            l = t["letter"].upper()
            rack_counts[l] = rack_counts.get(l, 0) + 1

        for pt in placed_tiles:
            l = pt.letter.upper()
            if rack_counts.get(l, 0) <= 0:
                return False, f"Tile '{l}' is not in your rack or has already been placed"
            rack_counts[l] -= 1

        return True, None

    @classmethod
    async def validate_move(
        cls,
        db: AsyncSession,
        game_id: str,
        player_id: str,
        placed_tiles: list[PlacedTileInput]
    ) -> ValidateMoveResponse:
        stmt_game = select(Game).where(Game.id == game_id)
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        if game.status != "PLAYING":
            return ValidateMoveResponse(valid=False, reason="Game is not currently active")

        if game.current_player_id != player_id:
            return ValidateMoveResponse(valid=False, reason="It is not your turn")

        stmt_player = select(GamePlayer).where(GamePlayer.id == player_id)
        player = (await db.execute(stmt_player)).scalar_one_or_none()
        if not player:
            return ValidateMoveResponse(valid=False, reason="Player not found in game")

        normalized_board = await board_state(db, game_id)
        normalized_rack = await player_rack(db, player.id)
        # Verify tile ownership in rack
        owns_tiles, err_ownership = cls._verify_tile_ownership(normalized_rack, placed_tiles)
        if not owns_tiles:
            return ValidateMoveResponse(valid=False, reason=err_ownership)
        if game.banned_letter and game.banned_until_turn and game.turn_number <= game.banned_until_turn:
            if any(tile.letter.upper() == game.banned_letter and player.id != game.banned_by_player_id for tile in placed_tiles):
                return ValidateMoveResponse(valid=False, reason=f"Letter '{game.banned_letter}' is banned this turn")

        # Run authoritative rule engine
        placed_dicts = [pt.model_dump() for pt in placed_tiles]
        is_first = len(normalized_board) == 0

        valid, err, words, score, _ = RuleEngine.validate_move(
            board_cells=normalized_board,
            placed_tiles=placed_dicts,
            is_first_move=is_first
        )

        words_formed = [
            WordFormed(word=w.word, score=sum(v for _, v, _ in w.letters_with_vals), cells=w.cells)
            for w in words
        ]

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
        stmt_game = select(Game).where(Game.id == game_id)
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

        normalized_board = await board_state(db, game_id)
        normalized_rack = await player_rack(db, player.id)
        # Check tile ownership
        owns_tiles, err_ownership = cls._verify_tile_ownership(normalized_rack, placed_tiles)
        if not owns_tiles:
            raise HTTPException(status_code=400, detail=err_ownership)
        if game.banned_letter and game.banned_until_turn and game.turn_number <= game.banned_until_turn:
            if any(tile.letter.upper() == game.banned_letter and player.id != game.banned_by_player_id for tile in placed_tiles):
                raise HTTPException(status_code=400, detail=f"Letter '{game.banned_letter}' is banned this turn")

        placed_dicts = [pt.model_dump() for pt in placed_tiles]
        is_first = len(normalized_board) == 0

        valid, err, words, score, _ = RuleEngine.validate_move(
            board_cells=normalized_board,
            placed_tiles=placed_dicts,
            is_first_move=is_first
        )

        if not valid:
            raise HTTPException(status_code=400, detail=f"Invalid move: {err}")

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
            for i, r_tile in enumerate(remaining_rack):
                if r_tile["letter"].upper() == pt.letter.upper():
                    remaining_rack.pop(i)
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

        if any((pt.row, pt.col) in Board.SECRET_POWER for pt in placed_tiles):
            cards = list(player.cards or [])
            if len(cards) < 3:
                cards.append(random.choice(cls.CARD_TYPES))
                player.cards = cards
                from app.database.state import replace_player_cards
                await replace_player_cards(db, player.id, cards)

        words_formed = [
            WordFormed(word=w.word, score=sum(v for _, v, _ in w.letters_with_vals), cells=w.cells)
            for w in words
        ]

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

        # Score is authoritative damage to every other living player.
        for opponent in all_players:
            if opponent.id != player.id:
                opponent.hp = max(0, opponent.hp - score)

        current_idx = next(i for i, p in enumerate(all_players) if p.id == player_id)
        next_idx = (current_idx + 1) % len(all_players)
        next_player_id = all_players[next_idx].id

        completed_turn = game.turn_number
        reached_max_turns = bool(game.max_turns and completed_turn >= game.max_turns)
        game.consecutive_passes = 0
        if reached_max_turns:
            game.status = "FINISHED"
            game.current_player_id = None
            game.turn_started_at = None
        else:
            game.current_player_id = next_player_id
            game.turn_number += 1
            game.turn_started_at = get_utc_now()

        # Check game end
        players_dict = [{"id": p.id, "display_name": p.display_name, "score": p.score, "hp": p.hp, "rack": p.rack} for p in all_players]
        is_over, reason, winner = GameEndService.check_game_over(game.tile_bag, players_dict, game.consecutive_passes)

        if is_over or reached_max_turns:
            game.status = "FINISHED"
            stmt_room = select(GameRoom).where(GameRoom.id == game_id)
            room = (await db.execute(stmt_room)).scalar_one_or_none()
            if room:
                room.status = "FINISHED"
                room.finished_at = get_utc_now()

        await db.flush()
        await replace_game_tiles(db, game.id, game.tile_bag, all_players)

        res = CommitMoveResponse(
            success=True,
            move_id=move_id,
            turn_number=completed_turn,
            words_formed=words_formed,
            score_earned=score,
            next_player_id=next_player_id,
            game_over=is_over or reached_max_turns,
            winner_id=winner
        )

        return res, game, player
