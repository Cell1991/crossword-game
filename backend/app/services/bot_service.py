import asyncio
import logging
import random
import uuid
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select
from fastapi import HTTPException

from app.core.config import settings
from app.database.models import Game, GamePlayer
from app.database.state import bag_tiles, player_rack, board_state
from app.game.hint import find_hint_suggestions
from app.schemas.move import PlacedTileInput
from app.services.move_service import MoveService
from app.services.game_service import GameService


class BotService:

    DIFFICULTIES = ("easy", "medium", "hard")

    # The browser drives the bot turn: it fetches a plan, animates the tiles one by one, then
    # commits. This fallback only exists for when no browser is driving, so it has to outlast the
    # slowest animation (~5.5s) plus a throttled mobile tab - firing earlier made the server commit
    # its own move mid-animation, which is what made tiles lift off and reappear somewhere else.
    FALLBACK_DELAY_SECONDS = 12.0

    # One plan per turn, keyed by game. Whoever commits - the browser or the fallback - plays the
    # exact word the preview animated; replanning picked a different word from the same rack.
    _PLAN_CACHE: dict[str, tuple[tuple[str, int, str], dict[str, Any]]] = {}
    # Games whose bot turn is being committed right now. Two racing callers (the 5s resync in every
    # open tab, plus the scheduled task) used to commit two moves for one turn.
    _TURNS_IN_FLIGHT: set[str] = set()

    @classmethod
    def forget_plan(cls, game_id: str) -> None:
        cls._PLAN_CACHE.pop(game_id, None)

    @classmethod
    def _remember_plan(cls, key: tuple[str, int, str], plan: dict[str, Any]) -> dict[str, Any]:
        cls._PLAN_CACHE[key[0]] = (key, plan)
        return plan

    @staticmethod
    def is_bot_player(player: GamePlayer | None) -> bool:
        """
        Whether this seat is played by the AI, from the stored flag. Seats created before that flag
        existed fall back to the old display-name tag so games already in flight keep running - a
        substring match on "bot" is deliberately not used, since it also catches human names.
        """
        if not player:
            return False
        stored = getattr(player, "is_bot", None)
        if stored is not None:
            return bool(stored)
        name_lower = (player.display_name or "").lower()
        return "[bot]" in name_lower or "[ai]" in name_lower

    @classmethod
    def difficulty_of(cls, player: GamePlayer | None) -> str:
        """The level this bot plays at, falling back to medium for anything unrecognised."""
        stored = (getattr(player, "bot_difficulty", None) or "").lower()
        if stored in cls.DIFFICULTIES:
            return stored
        name_lower = (getattr(player, "display_name", "") or "").lower()
        if "spark" in name_lower or "easy" in name_lower or "novice" in name_lower:
            return "easy"
        if "titan" in name_lower or "hard" in name_lower or "master" in name_lower:
            return "hard"
        return "medium"
    _WORDS_BY_CHAR: dict[str, list[str]] = {}

    @classmethod
    def _get_words_for_char(cls, char: str) -> list[str]:
        if not cls._WORDS_BY_CHAR:
            from app.game.dictionary import dictionary_service
            from collections import defaultdict
            index = defaultdict(list)
            for length in (2, 3, 4, 5, 6):
                for w in dictionary_service.get_words_of_length(length):
                    for ch in set(w):
                        index[ch].append(w)
            cls._WORDS_BY_CHAR = dict(index)
        return cls._WORDS_BY_CHAR.get(char, [])

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

        difficulty = (requested_difficulty or "").lower()
        if difficulty not in cls.DIFFICULTIES:
            difficulty = cls.difficulty_of(current_player)

        cache_key = (game_id, game.turn_number, current_player.id)
        cached = cls._PLAN_CACHE.get(game_id)
        if cached and cached[0] == cache_key:
            return cached[1]

        # Load rack and board state
        rack = await player_rack(db, current_player.id)
        board = await board_state(db, game_id)
        is_first = len(board) == 0

        rack_letters = [str(t.get("letter", "")).upper() for t in rack if t.get("letter")]
        if not rack_letters:
            return cls._remember_plan(cache_key, {
                "action": "PASS",
                "bot_player_id": current_player.id,
                "bot_name": current_player.display_name,
                "difficulty": difficulty,
            })

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
                    return cls._remember_plan(cache_key, {
                        "action": "MOVE",
                        "bot_player_id": current_player.id,
                        "bot_name": current_player.display_name,
                        "difficulty": difficulty,
                        "word": cand.get("word", ""),
                        "score": cand.get("score", 0),
                        "direction": cand.get("direction", "across"),
                        "tiles": matched_tiles,
                    })

        # Nothing playable from this rack. A bot plays by the same rules as everyone else, so it
        # takes the same way out a human would: swap tiles if the bag allows, otherwise pass.
        bag = await bag_tiles(db, game_id)
        if len(bag) >= settings.MIN_BAG_TILES_TO_EXCHANGE:
            return cls._remember_plan(cache_key, {
                "action": "EXCHANGE",
                "bot_player_id": current_player.id,
                "bot_name": current_player.display_name,
                "difficulty": difficulty,
                "tile_ids": [str(t.get("id") or t.get("tile_id")) for t in rack],
            })
        return cls._remember_plan(cache_key, {
            "action": "PASS",
            "bot_player_id": current_player.id,
            "bot_name": current_player.display_name,
            "difficulty": difficulty,
        })

    @classmethod
    def _order_candidates_by_difficulty(
        cls, candidates: list[dict[str, Any]], difficulty: str
    ) -> list[dict[str, Any]]:
        """
        Order candidate moves most-preferred first for `difficulty`. Every candidate is kept so the
        caller can fall through the list when a preferred one will not match the rack.

        Each level picks by *rank* among what this rack can actually reach, not by an absolute point
        band. Bands do not survive contact with a real board: capping medium at "2-15 points" meant
        that whenever the board offered nothing above 15, medium took the single best move while hard
        randomised among its top two - so medium outscored hard.
        - Easy (SparkBot): plays from the weak end, varied so it is not always the same word.
        - Medium (Nexus AI): strong, but gives up the very best move available.
        - Hard (Titan AI): always the highest-scoring move it can find.
        """
        if not candidates:
            return []

        ranked = sorted(candidates, key=lambda c: c.get("score", 0), reverse=True)

        if difficulty == "hard":
            return ranked

        if difficulty == "medium":
            # Hold back the top slice so Titan stays ahead, then play the best of what is left.
            held_back = max(1, len(ranked) // 4)
            return ranked[held_back:] + ranked[:held_back]

        # Easy: weakest first, shuffling the bottom few for variety between turns.
        weakest_first = ranked[::-1]
        head = weakest_first[:3]
        random.shuffle(head)
        return head + weakest_first[3:]

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
                tile_id = str(matched_tile.get("id") or matched_tile.get("tile_id") or uuid.uuid4().hex[:8])
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
    async def _take_scoreless_turn(
        cls, db: AsyncSession, game_id: str, bot_id: str, plan: dict[str, Any]
    ) -> dict[str, Any]:
        """Spend the bot's turn on an exchange (or a pass) and broadcast it like a human's."""
        from app.websocket.connection_manager import manager
        from app.schemas.events import WebSocketEvent, EventType

        tile_ids = plan.get("tile_ids") or []
        if plan.get("action") == "EXCHANGE" and tile_ids:
            game, exchanged, is_over, reason, winner_id = await GameService.exchange_tiles(
                db, game_id, bot_id, tile_ids
            )
            if exchanged:
                await manager.broadcast(game_id, WebSocketEvent(
                    type=EventType.TILES_EXCHANGED,
                    payload={
                        "playerId": bot_id,
                        "count": len(tile_ids),
                        "nextPlayerId": game.current_player_id,
                        "turnNumber": game.turn_number,
                    },
                ).model_dump())
                action = "EXCHANGE"
            else:
                # Rules §5: asking for more tiles than the bag holds forfeits the turn as a pass.
                action = "PASS"
        else:
            game, is_over, reason, winner_id = await GameService.pass_turn(db, game_id, bot_id)
            action = "PASS"

        if action == "PASS":
            await manager.broadcast(game_id, WebSocketEvent(
                type=EventType.TURN_PASSED,
                payload={
                    "passedPlayerId": bot_id,
                    "nextPlayerId": game.current_player_id,
                    "turnNumber": game.turn_number,
                    "consecutivePasses": game.consecutive_passes,
                },
            ).model_dump())

        if is_over:
            await manager.broadcast(game_id, WebSocketEvent(
                type=EventType.GAME_ENDED,
                payload={"reason": reason or "Game completed", "winnerId": winner_id},
            ).model_dump())

        return {
            "status": "success",
            "action": action,
            "score_earned": 0,
            "next_player_id": None if is_over else game.current_player_id,
            "turn_number": game.turn_number,
            "word": None,
        }

    @classmethod
    async def execute_bot_move_now(
        cls,
        db: AsyncSession,
        game_id: str,
        bot_player_id: str | None = None,
        difficulty: str | None = None,
    ) -> dict[str, Any] | None:
        """Executes a move for the bot immediately on this session, commits, broadcasts MOVE_COMMITTED."""
        from app.websocket.connection_manager import manager
        from app.schemas.events import WebSocketEvent, EventType
        from app.schemas.move import PlacedTileInput

        if game_id in cls._TURNS_IN_FLIGHT:
            return None
        cls._TURNS_IN_FLIGHT.add(game_id)
        try:
            return await cls._execute_bot_move_locked(db, game_id, bot_player_id, difficulty)
        finally:
            cls._TURNS_IN_FLIGHT.discard(game_id)

    @classmethod
    async def _execute_bot_move_locked(
        cls,
        db: AsyncSession,
        game_id: str,
        bot_player_id: str | None,
        difficulty: str | None,
    ) -> dict[str, Any] | None:
        from app.websocket.connection_manager import manager
        from app.schemas.events import WebSocketEvent, EventType
        from app.schemas.move import PlacedTileInput

        plan = await cls.plan_bot_move(db, game_id, difficulty)
        bot_id = plan.get("bot_player_id") or bot_player_id
        if not bot_id:
            return None

        action = plan.get("action", "MOVE")
        tiles_data = plan.get("tiles", [])

        # No playable word: take the turn the way a human would rather than stalling it. Leaving
        # this unhandled is what used to hang a bot game on an awkward rack.
        if action != "MOVE" or not tiles_data:
            outcome = await cls._take_scoreless_turn(db, game_id, bot_id, plan)
            await db.commit()
            next_player_id = outcome["next_player_id"]
            if next_player_id:
                stmt_next = select(GamePlayer).where(GamePlayer.id == next_player_id)
                next_p = (await db.execute(stmt_next)).scalar_one_or_none()
                if cls.is_bot_player(next_p):
                    asyncio.create_task(
                        cls.schedule_auto_bot_turn(game_id, next_p.id, outcome["turn_number"], delay_seconds=cls.FALLBACK_DELAY_SECONDS)
                    )
            return outcome

        placed_tiles = [PlacedTileInput(**t) for t in tiles_data]
        try:
            res, game, player = await MoveService.commit_move(db, game_id, bot_id, placed_tiles)
        except Exception:
            # A cached plan the board will not accept would otherwise be replayed every retry.
            cls._PLAN_CACHE.pop(game_id, None)
            raise
        await db.commit()

        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.MOVE_COMMITTED,
            payload={
                "playerId": player.id,
                "turnNumber": game.turn_number,
                "placedTiles": [t.model_dump() for t in placed_tiles],
                "wordsFormed": [w.model_dump() for w in res.words_formed],
                "scoreEarned": res.score_earned,
                "playerTotalScore": player.score,
                "nextPlayerId": res.next_player_id,
                "boardState": game.board_state,
                "pendingEffect": game.pending_effect,
                "cardAwarded": res.card_awarded,
                "cardsAwarded": res.cards_awarded,
            }
        ).model_dump())

        if res.game_over:
            await manager.broadcast(game_id, WebSocketEvent(
                type=EventType.GAME_ENDED,
                payload={"reason": "Game completed", "winnerId": res.winner_id},
            ).model_dump())
        elif res.next_player_id:
            # If the next player is ALSO a bot, auto-advance next bot too
            stmt_next = select(GamePlayer).where(GamePlayer.id == res.next_player_id)
            next_p = (await db.execute(stmt_next)).scalar_one_or_none()
            if cls.is_bot_player(next_p):
                asyncio.create_task(
                    cls.schedule_auto_bot_turn(game_id, next_p.id, game.turn_number, delay_seconds=cls.FALLBACK_DELAY_SECONDS)
                )

        return {
            "status": "success",
            "action": "MOVE",
            "score_earned": res.score_earned,
            "next_player_id": res.next_player_id,
            "word": plan.get("word"),
        }

    @classmethod
    async def schedule_auto_bot_turn(
        cls,
        game_id: str,
        bot_player_id: str,
        expected_turn_number: int,
        delay_seconds: float | None = None,
    ) -> None:
        """Execute a bot turn if the browser has not committed it within the fallback window."""
        await asyncio.sleep(cls.FALLBACK_DELAY_SECONDS if delay_seconds is None else delay_seconds)
        from app.database.session import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            try:
                stmt_game = select(Game).where(Game.id == game_id)
                game = (await db.execute(stmt_game)).scalar_one_or_none()
                if not game or game.status != "PLAYING":
                    return
                if game.current_player_id != bot_player_id or game.turn_number != expected_turn_number:
                    return  # Turn already advanced by client!

                await cls.execute_bot_move_now(db, game_id, bot_player_id)
            except Exception as e:
                logging.getLogger(__name__).error(
                    f"Error in schedule_auto_bot_turn for game {game_id}: {e}", exc_info=True
                )

