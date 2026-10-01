import random
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.database.models import Game, GamePlayer
from app.database.state import player_rack, board_state
from app.game.hint import find_hint_suggestions
from app.schemas.move import PlacedTileInput
from app.services.move_service import MoveService
from app.services.game_service import GameService


class BotService:

    @staticmethod
    def is_bot_player(player: GamePlayer | None) -> bool:
        if not player or not player.display_name:
            return False
        name_lower = player.display_name.lower()
        return "[bot]" in name_lower or "[ai]" in name_lower or "bot" in name_lower

    @staticmethod
    def get_difficulty_from_name(display_name: str) -> str:
        name_lower = display_name.lower()
        if "spark" in name_lower or "easy" in name_lower or "novice" in name_lower:
            return "easy"
        if "titan" in name_lower or "hard" in name_lower or "master" in name_lower:
            return "hard"
        return "medium"

    @classmethod
    async def plan_bot_move(
        cls, db: AsyncSession, game_id: str, requested_difficulty: str | None = None
    ) -> dict[str, Any]:
        stmt_game = select(Game).where(Game.id == game_id)
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        if game.status != "PLAYING":
            raise HTTPException(status_code=400, detail="Game is not currently active")

        if not game.current_player_id:
            raise HTTPException(status_code=400, detail="No current turn player")

        stmt_player = select(GamePlayer).where(GamePlayer.id == game.current_player_id)
        current_player = (await db.execute(stmt_player)).scalar_one_or_none()
        if not current_player:
            raise HTTPException(status_code=404, detail="Current player not found")

        if not cls.is_bot_player(current_player):
            raise HTTPException(status_code=400, detail="Current turn is not assigned to a Bot")

        difficulty = requested_difficulty or cls.get_difficulty_from_name(current_player.display_name)
        difficulty = difficulty.lower()
        if difficulty not in ("easy", "medium", "hard"):
            difficulty = "medium"

        # Load rack and board state
        rack = await player_rack(db, current_player.id)
        board = await board_state(db, game_id)
        is_first = len(board) == 0

        rack_letters = [str(t.get("letter", "")).upper() for t in rack if t.get("letter")]
        if not rack_letters:
            return {
                "action": "PASS",
                "bot_player_id": current_player.id,
                "bot_name": current_player.display_name,
                "difficulty": difficulty,
            }

        # Find all valid placement candidates (fast target)
        candidates = find_hint_suggestions(
            board_cells=board,
            rack_tiles=rack,
            is_first_move=is_first,
            max_suggestions=25,
        )

        if candidates:
            # Order candidates based on bot difficulty
            prioritized = cls._order_candidates_by_difficulty(candidates, difficulty)
            for cand in prioritized:
                # Match candidate letters to real tile IDs in the bot's rack
                matched_tiles = cls._match_tiles_to_rack(rack, cand.get("tiles", []))
                if matched_tiles:
                    return {
                        "action": "MOVE",
                        "bot_player_id": current_player.id,
                        "bot_name": current_player.display_name,
                        "difficulty": difficulty,
                        "word": cand.get("word", ""),
                        "score": cand.get("score", 0),
                        "direction": cand.get("direction", "across"),
                        "tiles": matched_tiles,
                    }

        # If no valid move is possible, check if bot can exchange or pass
        bag_len = len(game.tile_bag) if isinstance(game.tile_bag, list) else 0
        if bag_len >= 7 and len(rack) >= 2:
            num_swap = min(len(rack), random.randint(2, min(4, len(rack))))
            tile_ids_to_swap = [
                str(t.get("id") or t.get("tile_id"))
                for t in rack[:num_swap]
                if (t.get("id") or t.get("tile_id"))
            ]
            if tile_ids_to_swap:
                return {
                    "action": "EXCHANGE",
                    "bot_player_id": current_player.id,
                    "bot_name": current_player.display_name,
                    "difficulty": difficulty,
                    "tile_ids": tile_ids_to_swap,
                }

        return {
            "action": "PASS",
            "bot_player_id": current_player.id,
            "bot_name": current_player.display_name,
            "difficulty": difficulty,
        }

    @classmethod
    def _order_candidates_by_difficulty(
        cls, candidates: list[dict[str, Any]], difficulty: str
    ) -> list[dict[str, Any]]:
        """
        Orders candidate moves based on bot difficulty:
        - Easy (SparkBot): Simple, shorter words (2-4 letters, modest score 4-20 pts).
        - Medium (Nexus AI): Tactical words (3-5 letters, 10-35 pts, solid placement).
        - Hard (Titan AI): Top scoring moves (hits multipliers, max score, bingos).
        """
        if not candidates:
            return []

        # candidates from find_hint_suggestions are sorted descending by score
        sorted_by_score = list(candidates)

        if difficulty == "hard":
            # Top scoring moves first, slight randomness among top 3
            top = sorted_by_score[:3]
            random.shuffle(top)
            return top + sorted_by_score[3:]

        if difficulty == "easy":
            # Prefer shorter words with lower scores
            easy_pool = [c for c in sorted_by_score if len(c.get("tiles", [])) <= 4 and c.get("score", 0) <= 22]
            random.shuffle(easy_pool)
            remainder = [c for c in sorted_by_score[::-1] if c not in easy_pool]
            return easy_pool + remainder

        # Medium:
        # Prefer balanced moves between 10 and 35 points with length 2 to 5
        medium_pool = [
            c for c in sorted_by_score
            if 10 <= c.get("score", 0) <= 35 and 2 <= len(c.get("tiles", [])) <= 5
        ]
        random.shuffle(medium_pool)
        remainder = [c for c in sorted_by_score if c not in medium_pool]
        return medium_pool + remainder

    @staticmethod
    def _match_tiles_to_rack(rack: list[dict[str, Any]], tiles_to_place: list[dict[str, Any]]) -> list[dict[str, Any]]:
        available = [dict(t) for t in rack]
        result = []

        for pt in tiles_to_place:
            letter = str(pt.get("letter", "")).upper()
            matched_idx = None

            # 1. Match exact letter
            for idx, r in enumerate(available):
                if str(r.get("letter", "")).upper() == letter:
                    matched_idx = idx
                    break

            # 2. Match BLANK
            if matched_idx is None:
                for idx, r in enumerate(available):
                    if str(r.get("letter", "")).upper() in ("BLANK", "?", "*"):
                        matched_idx = idx
                        break

            if matched_idx is not None:
                matched_tile = available.pop(matched_idx)
                tile_id = str(matched_tile.get("id") or matched_tile.get("tile_id") or "")
                result.append({
                    "row": int(pt["row"]),
                    "col": int(pt["col"]),
                    "letter": letter,
                    "value": int(matched_tile.get("value", pt.get("value", 1))),
                    "tile_id": tile_id,
                })
            else:
                # Could not match all tiles
                return []

        return result
