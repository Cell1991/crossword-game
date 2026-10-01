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
            max_suggestions=50,
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

        # If current rack could not form any valid move, generate a guaranteed valid move!
        # The bot NEVER passes: it always finds and places a valid word matching its difficulty.
        return await cls._generate_guaranteed_bot_move(db, game, current_player, board, rack, difficulty)

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

    @classmethod
    async def _ensure_bot_rack_has_tiles(
        cls,
        db: AsyncSession,
        current_player: GamePlayer,
        tiles_needed: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        import uuid
        from app.game.tiles import DEFAULT_LETTER_VALUES

        rack = list(current_player.rack or [])
        matched_result = []
        available = list(rack)

        # 1. Match tiles already in rack
        unmatched_needed = []
        for t in tiles_needed:
            letter = str(t["letter"]).upper()
            found_idx = None
            for idx, r in enumerate(available):
                if str(r.get("letter", "")).upper() == letter:
                    found_idx = idx
                    break
            if found_idx is not None:
                matched_tile = available.pop(found_idx)
                matched_result.append({
                    "row": int(t["row"]),
                    "col": int(t["col"]),
                    "letter": letter,
                    "value": int(matched_tile.get("value", DEFAULT_LETTER_VALUES.get(letter, 1))),
                    "tile_id": str(matched_tile.get("id") or matched_tile.get("tile_id") or ""),
                })
            else:
                unmatched_needed.append(t)

        # 2. For remaining needed letters, adjust unused tiles in available
        if unmatched_needed:
            for t in unmatched_needed:
                letter = str(t["letter"]).upper()
                val = DEFAULT_LETTER_VALUES.get(letter, 1)
                if available:
                    borrowed = available.pop(0)
                    borrowed_id = str(borrowed.get("id") or borrowed.get("tile_id"))
                    for r in rack:
                        if str(r.get("id") or r.get("tile_id")) == borrowed_id:
                            r["letter"] = letter
                            r["value"] = val
                            matched_result.append({
                                "row": int(t["row"]),
                                "col": int(t["col"]),
                                "letter": letter,
                                "value": val,
                                "tile_id": borrowed_id,
                            })
                            break
                else:
                    new_id = str(uuid.uuid4())[:8]
                    new_tile = {"id": new_id, "letter": letter, "value": val}
                    rack.append(new_tile)
                    matched_result.append({
                        "row": int(t["row"]),
                        "col": int(t["col"]),
                        "letter": letter,
                        "value": val,
                        "tile_id": new_id,
                    })

            current_player.rack = rack
            await db.flush()

        return matched_result

    @classmethod
    async def _generate_guaranteed_bot_move(
        cls,
        db: AsyncSession,
        game: Game,
        current_player: GamePlayer,
        board: dict[str, dict[str, Any]],
        rack: list[dict[str, Any]],
        difficulty: str,
    ) -> dict[str, Any]:
        """
        Guaranteed bot move generator:
        Ensures the bot NEVER passes or exchanges without placing tiles.
        Searches all valid word attachments on the board, selects a move appropriate
        for the difficulty setting, updates the bot's rack with the required tiles,
        and returns action: MOVE.
        """
        from app.game.rules import RuleEngine
        from app.game.dictionary import dictionary_service
        from app.game.board import Board
        from app.game.tiles import DEFAULT_LETTER_VALUES

        valid_moves: list[dict[str, Any]] = []
        is_first = len(board) == 0

        if is_first:
            # Case 1: First Move on Empty Board (must cover center (9, 13))
            center_r, center_c = Board.CENTER[0], Board.CENTER[1]
            if difficulty == "easy":
                target_words = ["CAT", "DOG", "SUN", "RED", "TEA", "BOX", "RUN", "BAT", "CUP", "MAP"]
            elif difficulty == "medium":
                target_words = ["PLAY", "GAME", "WORD", "STAR", "GOLD", "BLUE", "FIRE", "TIME", "WIND"]
            else:
                target_words = ["PLANET", "MASTER", "SILVER", "KNIGHT", "GALAXY", "STREAM", "ROCKET"]

            for w in target_words:
                w_len = len(w)
                start_c = center_c - (w_len // 2)
                placed = [
                    {"row": center_r, "col": start_c + i, "letter": w[i], "value": DEFAULT_LETTER_VALUES.get(w[i], 1)}
                    for i in range(w_len)
                ]
                valid, _, _, score, _ = RuleEngine.validate_move({}, placed, is_first_move=True)
                if valid:
                    valid_moves.append({"word": w, "score": score, "direction": "across", "tiles": placed})
                    break
        else:
            # Case 2: Active Board (connect to existing committed tiles)
            occupied = {(c["row"], c["col"]): c["letter"].upper() for c in board.values()}

            lengths_to_try = (2, 3) if difficulty == "easy" else (2, 3, 4) if difficulty == "medium" else (3, 4, 5, 2)
            for w_len in lengths_to_try:
                dict_words = dictionary_service.get_words_of_length(w_len)
                for (r, c), char in occupied.items():
                    # 1. Horizontal placements
                    for offset in range(w_len):
                        start_c = c - offset
                        end_c = start_c + w_len
                        if not (0 <= start_c and end_c <= Board.COLS):
                            continue
                        if (r, start_c - 1) in occupied or (r, end_c) in occupied:
                            continue
                        for w in dict_words:
                            if w[offset] != char:
                                continue
                            matches = True
                            placed = []
                            for i in range(w_len):
                                pos = (r, start_c + i)
                                if pos in occupied:
                                    if occupied[pos] != w[i]:
                                        matches = False
                                        break
                                else:
                                    placed.append({"row": r, "col": start_c + i, "letter": w[i], "value": DEFAULT_LETTER_VALUES.get(w[i], 1)})
                            if not matches or not placed:
                                continue
                            valid, _, _, score, _ = RuleEngine.validate_move(board, placed, is_first_move=False)
                            if valid:
                                valid_moves.append({"word": w, "score": score, "direction": "across", "tiles": placed})
                                if len(valid_moves) >= 40:
                                    break
                        if len(valid_moves) >= 40:
                            break
                    if len(valid_moves) >= 40:
                        break

                    # 2. Vertical placements
                    for offset in range(w_len):
                        start_r = r - offset
                        end_r = start_r + w_len
                        if not (0 <= start_r and end_r <= Board.ROWS):
                            continue
                        if (start_r - 1, c) in occupied or (end_r, c) in occupied:
                            continue
                        for w in dict_words:
                            if w[offset] != char:
                                continue
                            matches = True
                            placed = []
                            for i in range(w_len):
                                pos = (start_r + i, c)
                                if pos in occupied:
                                    if occupied[pos] != w[i]:
                                        matches = False
                                        break
                                else:
                                    placed.append({"row": start_r + i, "col": c, "letter": w[i], "value": DEFAULT_LETTER_VALUES.get(w[i], 1)})
                            if not matches or not placed:
                                continue
                            valid, _, _, score, _ = RuleEngine.validate_move(board, placed, is_first_move=False)
                            if valid:
                                valid_moves.append({"word": w, "score": score, "direction": "down", "tiles": placed})
                                if len(valid_moves) >= 50:
                                    break
                        if len(valid_moves) >= 50:
                            break
                    if len(valid_moves) >= 50:
                        break
                if len(valid_moves) >= 50:
                    break

        if not valid_moves:
            # Absolute fallback if no valid words could be formed
            return {
                "action": "PASS",
                "bot_player_id": current_player.id,
                "bot_name": current_player.display_name,
                "difficulty": difficulty,
            }

        # Sort valid moves by score
        valid_moves.sort(key=lambda m: m["score"], reverse=True)

        if difficulty == "easy":
            # Pick lowest scoring / simple move
            chosen = sorted(valid_moves, key=lambda m: (m["score"], len(m["tiles"])))[0]
        elif difficulty == "medium":
            # Pick balanced move from middle
            mid_idx = len(valid_moves) // 2
            chosen = valid_moves[mid_idx]
        else:
            # Hard: top scoring move
            chosen = valid_moves[0]

        # Ensure bot's rack contains the tiles needed for this move
        matched_tiles = await cls._ensure_bot_rack_has_tiles(db, current_player, chosen["tiles"])

        return {
            "action": "MOVE",
            "bot_player_id": current_player.id,
            "bot_name": current_player.display_name,
            "difficulty": difficulty,
            "word": chosen["word"],
            "score": chosen["score"],
            "direction": chosen["direction"],
            "tiles": matched_tiles,
        }
