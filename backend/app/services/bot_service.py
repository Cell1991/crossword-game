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

        # Find all valid placement candidates
        candidates = find_hint_suggestions(
            board_cells=board,
            rack_tiles=rack,
            is_first_move=is_first,
            max_suggestions=80,
        )

        if candidates:
            chosen = cls._select_candidate_by_difficulty(candidates, difficulty)
            if chosen:
                # Match candidate letters to real tile IDs in the bot's rack
                matched_tiles = cls._match_tiles_to_rack(rack, chosen["tiles"])
                if matched_tiles:
                    return {
                        "action": "MOVE",
                        "bot_player_id": current_player.id,
                        "bot_name": current_player.display_name,
                        "difficulty": difficulty,
                        "word": chosen.get("word", ""),
                        "score": chosen.get("score", 0),
                        "direction": chosen.get("direction", "across"),
                        "tiles": matched_tiles,
                    }

        # If no valid move is possible, check if bot can exchange or pass
        bag_len = len(game.tile_bag) if isinstance(game.tile_bag, list) else 0
        if bag_len >= 7 and len(rack) >= 2:
            num_swap = min(len(rack), random.randint(2, min(4, len(rack))))
            tile_ids_to_swap = [str(t["id"]) for t in rack[:num_swap] if "id" in t]
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

    @staticmethod
    def _select_candidate_by_difficulty(candidates: list[dict[str, Any]], difficulty: str) -> dict[str, Any]:
        """
        Calculates move selection based on difficulty:
        - Easy (SparkBot): Simple, shorter words (2-4 letters, modest score 4-18 pts).
        - Medium (Nexus AI): Tactical words (3-5 letters, 12-35 pts, solid placement).
        - Hard (Titan AI): Top scoring moves (hits multipliers, max score, bingos).
        """
        if not candidates:
            return {}

        # Candidates are already sorted descending by score from find_hint_suggestions
        if difficulty == "hard":
            # Pick from the top 2 highest scoring moves
            top_slice = candidates[: min(2, len(candidates))]
            return random.choice(top_slice)

        if difficulty == "easy":
            # Prefer shorter words with lower scores
            easy_pool = [c for c in candidates if len(c.get("tiles", [])) <= 4 and c.get("score", 0) <= 20]
            if easy_pool:
                # Pick randomly from the modest pool
                return random.choice(easy_pool)
            # Fallback: pick the lowest scoring valid candidate
            return candidates[-1]

        # Medium:
        # Prefer balanced moves between 12 and 35 points with length 3 to 5
        medium_pool = [c for c in candidates if 12 <= c.get("score", 0) <= 35 and 2 <= len(c.get("tiles", [])) <= 5]
        if medium_pool:
            return random.choice(medium_pool)

        # Fallback to middle tier of candidates
        mid_idx = len(candidates) // 2
        return candidates[mid_idx]

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
                result.append({
                    "row": int(pt["row"]),
                    "col": int(pt["col"]),
                    "letter": letter,
                    "value": int(matched_tile.get("value", pt.get("value", 1))),
                    "tile_id": str(matched_tile.get("id", "")),
                })
            else:
                # Could not match all tiles
                return []

        return result
