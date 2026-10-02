import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.core.config import settings
from app.database.models import Game, GamePlayer, Move, GameRoom, GameTile, get_utc_now
from app.game.game_end import GameEndService
from app.game.tiles import TileService, NotEnoughTilesInBag
from app.schemas.player import PlayerOut, TileSchema
from app.schemas.game import GameStateResponse, MoveHistoryItem
from app.database.state import bag_tiles, board_state, player_rack, player_cards, replace_game_tiles
from app.services.room_service import RoomService


async def _auto_resolve_effect_task(game_id: str, delay: float = 1.2) -> None:
    """Backend safety timer: automatically finalize pending DAMAGE/SWAP effects if no client calls resolve."""
    try:
        await asyncio.sleep(delay)
        from app.database.session import AsyncSessionLocal
        from app.websocket.connection_manager import manager
        from app.schemas.events import WebSocketEvent, EventType
        from app.services.bot_service import BotService
        async with AsyncSessionLocal() as db:
            game, resolved, payload = await GameService.finalize_pending_effect_if_needed(db, game_id)
            if not resolved or not payload:
                return
            await db.commit()
            await manager.broadcast(game_id, WebSocketEvent(
                type=EventType.EFFECT_RESOLVED,
                payload={**payload, "blocked": False},
            ).model_dump())
            if payload.get("game_over"):
                await manager.broadcast(game_id, WebSocketEvent(
                    type=EventType.GAME_ENDED,
                    payload={"reason": payload.get("reason") or "Game completed", "winnerId": payload.get("winner_id")},
                ).model_dump())
            elif payload.get("turn_advanced"):
                await manager.broadcast(game_id, WebSocketEvent(
                    type=EventType.TURN_PASSED,
                    payload={
                        "passedPlayerId": payload.get("passed_player_id"),
                        "nextPlayerId": game.current_player_id,
                        "turnNumber": game.turn_number,
                        "consecutivePasses": game.consecutive_passes,
                        "reason": "ELIMINATED",
                    }
                ).model_dump())
                stmt_next = select(GamePlayer).where(GamePlayer.id == game.current_player_id)
                next_p = (await db.execute(stmt_next)).scalar_one_or_none()
                if BotService.is_bot_player(next_p):
                    asyncio.create_task(
                        BotService.schedule_auto_bot_turn(game_id, next_p.id, game.turn_number, delay_seconds=2.8)
                    )
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logging.getLogger(__name__).debug(f"_auto_resolve_effect_task error: {e}")


class GameService:

    @staticmethod
    def eligible_players(players: list[GamePlayer]) -> list[GamePlayer]:
        """Return players who can receive a turn: still in the game and connected."""
        return [
            player for player in players
            if player.hp > 0 and player.connection_status not in ("OFFLINE", "DISCONNECTED")
        ]

    @staticmethod
    def players_in_game(players: list[GamePlayer]) -> list[GamePlayer]:
        """Players not knocked out and not gone. A dropped connection (DISCONNECTED) is not leaving:
        their turns are skipped until they reconnect, but the game does not end without them."""
        return [player for player in players if player.hp > 0 and player.connection_status != "OFFLINE"]

    @staticmethod
    def too_few_players(players: list[GamePlayer]) -> bool:
        """A multiplayer game ends once at most one player is still in it; a solo game once its player is out."""
        in_game = GameService.players_in_game(players)
        return not in_game if len(players) == 1 else len(in_game) <= 1

    @staticmethod
    def scoreless_turn_limit(players: list[GamePlayer]) -> int:
        """Rules §6: the game ends after every player still in it has had two scoreless turns in a row."""
        return max(settings.MAX_CONSECUTIVE_PASSES, 2 * len(GameService.players_in_game(players)))

    @staticmethod
    def next_player_after(players: list[GamePlayer], player_id: str) -> GamePlayer | None:
        """The first player after `player_id` in seat order who can take a turn, even if `player_id` just left.
        In a solo game, or while everyone else is disconnected, that is `player_id` again."""
        eligible = GameService.eligible_players(players)
        seat = next(index for index, player in enumerate(players) if player.id == player_id)
        for step in range(1, len(players) + 1):
            candidate = players[(seat + step) % len(players)]
            if candidate in eligible:
                return candidate
        return None

    @staticmethod
    def players_summary(players: list[GamePlayer]) -> list[dict]:
        """The player fields GameEndService needs."""
        return [
            {"id": p.id, "display_name": p.display_name, "score": p.score, "hp": p.hp, "rack": p.rack,
             "connection_status": p.connection_status}
            for p in players
        ]

    @staticmethod
    async def finish_game(db: AsyncSession, game: Game, players: list[GamePlayer], winner_id: str | None = None) -> str | None:
        """End the game, record the winner and close the room. Returns the winner's id."""
        winner_id = winner_id or GameEndService.determine_winner(GameService.players_summary(players))
        game.status = "FINISHED"
        game.current_player_id = None
        game.turn_started_at = None
        game.winner_id = winner_id
        room = (await db.execute(select(GameRoom).where(GameRoom.id == game.id))).scalar_one_or_none()
        if room:
            room.status = "FINISHED"
            room.finished_at = get_utc_now()
        return winner_id

    @staticmethod
    async def ensure_turn_order_valid(
        db: AsyncSession, game: Game, players: list[GamePlayer]
    ) -> dict[str, Any]:
        """
        Validates the turn holder and game status after HP deductions or leaves.
        If a player's HP drops to <= 0:
        - If only 0 or 1 players with HP > 0 remain: mark game as FINISHED, declare winner.
        - If the dead player holds current_player_id: advance turn immediately to next living player!
        """
        result: dict[str, Any] = {
            "game_over": False,
            "reason": None,
            "winner_id": None,
            "turn_advanced": False,
            "passed_player_id": None,
            "next_player_id": game.current_player_id,
        }
        if game.status != "PLAYING":
            return result

        in_game = GameService.players_in_game(players)
        # Check game end condition: 1 or 0 living players
        if len(players) > 1 and len(in_game) <= 1:
            winner_id = in_game[0].id if in_game else GameEndService.determine_winner(GameService.players_summary(players))
            winner_id = await GameService.finish_game(db, game, players, winner_id)
            result["game_over"] = True
            result["reason"] = "Game ended: only one player has HP remaining"
            result["winner_id"] = winner_id
            result["next_player_id"] = None
            return result

        if len(players) == 1 and len(in_game) == 0:
            winner_id = await GameService.finish_game(db, game, players, None)
            result["game_over"] = True
            result["reason"] = "Game ended: Player knocked out"
            result["winner_id"] = winner_id
            result["next_player_id"] = None
            return result

        # Check if active turn holder is dead or departed
        curr_player = next((p for p in players if p.id == game.current_player_id), None)
        if curr_player and (curr_player.hp <= 0 or curr_player.connection_status == "OFFLINE"):
            next_player = GameService.next_player_after(players, curr_player.id)
            if next_player and next_player.id != curr_player.id:
                prev_id = curr_player.id
                game.current_player_id = next_player.id
                game.turn_number += 1
                game.turn_started_at = get_utc_now()
                result["turn_advanced"] = True
                result["passed_player_id"] = prev_id
                result["next_player_id"] = next_player.id
            elif next_player is None:
                winner_id = await GameService.finish_game(db, game, players, None)
                result["game_over"] = True
                result["reason"] = "Game ended: No eligible players remaining"
                result["winner_id"] = winner_id
                result["next_player_id"] = None

        return result

    @staticmethod
    async def expire_turn_if_needed(db: AsyncSession, game_id: str) -> tuple[Game, bool, str | None, str | None]:
        """Pass the current turn if its time limit has run out. Returns: (game, expired, reason, winner_id)."""
        stmt_game = select(Game).where(Game.id == game_id).with_for_update()
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        room = (await db.execute(select(GameRoom).where(GameRoom.id == game_id))).scalar_one_or_none()

        if not room or not room.turn_time_limit or not game.turn_started_at or game.status != "PLAYING":
            return game, False, None, None
        started_at = game.turn_started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        if (datetime.now(timezone.utc) - started_at).total_seconds() < room.turn_time_limit:
            return game, False, None, None
        # pass_turn's second value says whether the game ended; callers here need "the turn expired".
        game, _, reason, winner = await GameService.pass_turn(db, game_id, game.current_player_id or "")
        return game, True, reason, winner

    @staticmethod
    async def queue_pending_effect(db: AsyncSession, game: Game, **effect: Any) -> None:
        """
        Stage a DAMAGE/SWAP effect behind a short SHIELD window. Only one effect can be
        pending at a time; queuing a new one resolves any existing one first with no
        chance to shield it (collisions are rare given the short window).
        """
        if game.pending_effect:
            await GameService._apply_pending_effect(db, game, game.pending_effect)
        effect["expires_at"] = (datetime.now(timezone.utc) + timedelta(seconds=settings.SHIELD_WINDOW_SECONDS)).isoformat()
        game.pending_effect = effect
        asyncio.create_task(_auto_resolve_effect_task(game.id, delay=settings.SHIELD_WINDOW_SECONDS + 0.1))

    @staticmethod
    async def finalize_pending_effect_if_needed(db: AsyncSession, game_id: str) -> tuple[Game, bool, Optional[dict[str, Any]]]:
        """Apply a pending DAMAGE/SWAP effect once its SHIELD window has passed."""
        stmt_game = select(Game).where(Game.id == game_id).with_for_update()
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        if not game.pending_effect:
            return game, False, None
        expires_at = datetime.fromisoformat(game.pending_effect["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) < expires_at:
            return game, False, None
        payload = await GameService._apply_pending_effect(db, game, game.pending_effect)
        game.pending_effect = None
        await db.flush()
        return game, True, payload

    @staticmethod
    async def _apply_pending_effect(db: AsyncSession, game: Game, effect: dict[str, Any]) -> dict[str, Any]:
        if effect["type"] == "DAMAGE":
            stmt_players = select(GamePlayer).where(GamePlayer.game_id == game.id).order_by(GamePlayer.turn_order)
            players = (await db.execute(stmt_players)).scalars().all()
            applied: dict[str, int] = {}
            for player in players:
                amount = effect["damage"].get(player.id)
                if amount and amount > 0:
                    if getattr(player, "has_shield", False):
                        player.has_shield = False
                        applied[player.id] = 0
                    else:
                        player.hp = max(0, player.hp - amount)
                        applied[player.id] = amount
            validation = await GameService.ensure_turn_order_valid(db, game, players)
            return {
                "type": "DAMAGE",
                "applied": applied,
                "game_over": validation["game_over"],
                "reason": validation["reason"],
                "winner_id": validation["winner_id"],
                "turn_advanced": validation["turn_advanced"],
                "passed_player_id": validation["passed_player_id"],
                "next_player_id": validation["next_player_id"],
            }

        if effect["type"] == "SPY_SWAP":
            own_id = effect["source_player_id"]
            target_id = effect["target_player_id"]
            own_rack = await player_rack(db, own_id)
            target_rack = await player_rack(db, target_id)
            current_own = {tile["id"]: tile for tile in own_rack}
            current_target = {tile["id"]: tile for tile in target_rack}
            own_tile_ids = effect["own_tile_ids"]
            target_tile_ids = effect["target_tile_ids"]
            if all(tile_id in current_own for tile_id in own_tile_ids) and all(tile_id in current_target for tile_id in target_tile_ids):
                players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
                own_player = next(p for p in players if p.id == own_id)
                target_player = next(p for p in players if p.id == target_id)
                own_to_target = iter(current_target[tile_id] for tile_id in target_tile_ids)
                target_to_own = iter(current_own[tile_id] for tile_id in own_tile_ids)
                own_tile_id_set = set(own_tile_ids)
                target_tile_id_set = set(target_tile_ids)
                own_player.rack = [next(own_to_target) if tile["id"] in own_tile_id_set else tile for tile in own_rack]
                target_player.rack = [next(target_to_own) if tile["id"] in target_tile_id_set else tile for tile in target_rack]
                await replace_game_tiles(db, game.id, await bag_tiles(db, game.id), players)
                performed = True
            else:
                performed = False
            return {
                "type": "SPY_SWAP", "performed": performed,
                "source_player_id": own_id, "target_player_id": target_id,
                "count": len(own_tile_ids),
            }

        # SWAP
        own_id = effect["source_player_id"]
        target_id = effect["target_player_id"]
        own_rack = await player_rack(db, own_id)
        target_rack = await player_rack(db, target_id)
        own_tile = next((t for t in own_rack if t["id"] == effect["own_tile"]["id"]), None)
        target_tile = next((t for t in target_rack if t["id"] == effect["target_tile"]["id"]), None)
        performed = False
        if own_tile and target_tile:
            players = (await db.execute(select(GamePlayer).where(GamePlayer.game_id == game.id))).scalars().all()
            own_player = next(p for p in players if p.id == own_id)
            target_player = next(p for p in players if p.id == target_id)
            own_player.rack = [target_tile if t["id"] == own_tile["id"] else t for t in own_rack]
            target_player.rack = [own_tile if t["id"] == target_tile["id"] else t for t in target_rack]
            await replace_game_tiles(db, game.id, await bag_tiles(db, game.id), players)
            performed = True
        return {"type": "SWAP", "performed": performed, "source_player_id": own_id, "target_player_id": target_id}

    @staticmethod
    async def get_player_by_token(db: AsyncSession, session_token: str) -> Optional[GamePlayer]:
        stmt = select(GamePlayer).where(GamePlayer.session_token == session_token)
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def get_game_state(
        db: AsyncSession, game_id: str, requesting_player_id: Optional[str] = None, reveal_all: bool = False
    ) -> GameStateResponse:
        stmt_game = select(Game).where(Game.id == game_id)
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        room = (await db.execute(select(GameRoom).where(GameRoom.id == game_id))).scalar_one_or_none()
        # The room's own flag is authoritative: everyone in a debug room is a debug player, not just
        # whoever asks nicely. A caller-supplied reveal_all (the debug/ endpoints) still works too.
        room_is_debug = bool(room and room.is_debug) and settings.DEBUG_MODE
        reveal_all = reveal_all or room_is_debug

        turn_started_at = game.turn_started_at
        if turn_started_at and turn_started_at.tzinfo is None:
            turn_started_at = turn_started_at.replace(tzinfo=timezone.utc)

        normalized_board = await board_state(db, game_id)
        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        if game.status == "PLAYING" and game.current_player_id:
            curr_p = next((p for p in players if p.id == game.current_player_id), None)
            if curr_p and (curr_p.hp <= 0 or curr_p.connection_status == "OFFLINE"):
                validation = await GameService.ensure_turn_order_valid(db, game, players)
                await db.flush()
                from app.websocket.connection_manager import manager
                from app.schemas.events import WebSocketEvent, EventType
                if validation["turn_advanced"]:
                    await manager.broadcast(game_id, WebSocketEvent(
                        type=EventType.TURN_PASSED,
                        payload={
                            "passedPlayerId": validation["passed_player_id"],
                            "nextPlayerId": game.current_player_id,
                            "turnNumber": game.turn_number,
                            "consecutivePasses": game.consecutive_passes,
                            "reason": "ELIMINATED",
                        }
                    ).model_dump())
                    from app.services.bot_service import BotService
                    stmt_next = select(GamePlayer).where(GamePlayer.id == game.current_player_id)
                    next_p = (await db.execute(stmt_next)).scalar_one_or_none()
                    if BotService.is_bot_player(next_p):
                        asyncio.create_task(
                            BotService.schedule_auto_bot_turn(game_id, next_p.id, game.turn_number, delay_seconds=2.8)
                        )
                elif validation["game_over"]:
                    await manager.broadcast(game_id, WebSocketEvent(
                        type=EventType.GAME_ENDED,
                        payload={"reason": validation["reason"] or "Game completed", "winnerId": validation["winner_id"]},
                    ).model_dump())


        player_outs = []
        for p in players:
            normalized_rack = p.rack if (p.rack is not None and isinstance(p.rack, list)) else []
            normalized_cards = p.cards if (p.cards is not None and isinstance(p.cards, list)) else []
            is_mine = bool(requesting_player_id and p.id == requesting_player_id)
            p_rack = None
            if reveal_all or is_mine:
                p_rack = [TileSchema(**t) for t in normalized_rack]
            player_outs.append(PlayerOut(
                id=p.id,
                display_name=p.display_name,
                is_host=p.is_host,
                score=p.score,
                hp=p.hp,
                max_hp=getattr(p, 'max_hp', 100) or 100,
                has_shield=getattr(p, 'has_shield', False),
                turn_order=p.turn_order,
                connection_status=p.connection_status,
                rack_count=len(normalized_rack),
                rack=p_rack
                ,cards=normalized_cards if reveal_all or is_mine else None
            ))

        rematch_room = await RoomService.open_rematch_room(db, room) if room else None

        bag = await bag_tiles(db, game_id)
        tile_bag_counts: dict[str, int] = {}
        for tile in bag:
            letter = tile["letter"].upper()
            tile_bag_counts[letter] = tile_bag_counts.get(letter, 0) + 1

        stmt_moves = select(Move).where(Move.game_id == game_id).order_by(Move.created_at.asc(), Move.turn_number.asc())
        db_moves = (await db.execute(stmt_moves)).scalars().all()
        player_name_map = {p.id: p.display_name for p in players}

        move_history_outs = []
        for m in db_moves:
            p_name = player_name_map.get(m.player_id, "Player")
            words_list = []
            if m.words_formed and isinstance(m.words_formed, list):
                for w in m.words_formed:
                    if isinstance(w, dict) and "word" in w:
                        words_list.append(str(w["word"]).upper())
                    elif isinstance(w, str):
                        words_list.append(w.upper())

            m_type = "move"
            if m.move_type == "PASS":
                m_type = "pass"
                text = f"{p_name} passed turn"
            elif m.move_type == "EXCHANGE":
                m_type = "exchange"
                text = f"{p_name} swapped tiles"
            else:
                m_type = "move"
                words_str = ", ".join(words_list)
                text = f"{p_name}: {words_str}" if words_str else f"{p_name} placed tiles"

            move_history_outs.append(MoveHistoryItem(
                id=m.id,
                player_id=m.player_id,
                display_name=p_name,
                turn_number=m.turn_number,
                move_type=m.move_type,
                text=text,
                score=m.score_earned or 0,
                words=words_list,
                type=m_type,
                created_at=m.created_at,
            ))

        return GameStateResponse(
            game_id=game.id,
            status=game.status,
            current_player_id=game.current_player_id,
            turn_number=game.turn_number,
            consecutive_passes=game.consecutive_passes,
            board_state=normalized_board,
            players=player_outs,
            tile_bag_count=len(bag),
            tile_bag_counts=tile_bag_counts,
            turn_time_limit=room.turn_time_limit if room else None,
            turn_started_at=turn_started_at,
            max_turns=game.max_turns,
            starting_hp=game.starting_hp,
            pending_effect=GameService._visible_pending_effect(game.pending_effect, requesting_player_id),
            pending_double_target_id=game.pending_double_target_id,
            frozen_tile=GameService._visible_frozen_tile(game.frozen_tile, game.turn_number),
            is_debug=bool(room and room.is_debug),
            winner_id=game.winner_id,
            server_time=datetime.now(timezone.utc),
            game_pin=room.game_pin if room else None,
            rematch_pin=rematch_room.game_pin if rematch_room else None,
            move_history=move_history_outs,
        )

    @staticmethod
    def _visible_pending_effect(effect: Optional[dict[str, Any]], requesting_player_id: Optional[str]) -> Optional[dict[str, Any]]:
        """SWAP tile letters are private to the two players involved; everyone else
        (and DAMAGE effects, which only carry public score-derived amounts) sees the rest."""
        if not effect:
            return None
        if effect["type"] == "SPY_SWAP":
            return {
                "type": "SPY_SWAP",
                "source_player_id": effect["source_player_id"],
                "target_player_id": effect["target_player_id"],
                "count": len(effect["own_tile_ids"]),
                "expires_at": effect["expires_at"],
            }
        if effect["type"] == "SWAP" and requesting_player_id not in (effect.get("source_player_id"), effect.get("target_player_id")):
            return {"type": "SWAP", "expires_at": effect["expires_at"]}
        return effect

    @staticmethod
    def _visible_frozen_tile(frozen_tile: Optional[dict[str, Any]], turn_number: int) -> Optional[dict[str, Any]]:
        """Stop showing a FREEZE_TILE marker once its blocking window (checked the same way in
        MoveService) has passed — the stored value on Game is never cleared on its own."""
        if not frozen_tile or turn_number > frozen_tile["expires_turn"]:
            return None
        return frozen_tile

    @staticmethod
    async def pass_turn(db: AsyncSession, game_id: str, player_id: str) -> tuple[Game, bool, str | None, str | None]:
        stmt_game = select(Game).where(Game.id == game_id).with_for_update()
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        if game.status != "PLAYING":
            raise HTTPException(status_code=400, detail="Game is not currently active")

        game.pending_double_target_id = None

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        if game.current_player_id != player_id:
            curr_p = next((p for p in players if p.id == game.current_player_id), None)
            if not curr_p or curr_p.hp <= 0 or curr_p.connection_status == "OFFLINE":
                player_id = game.current_player_id or player_id
            else:
                raise HTTPException(status_code=403, detail="It is not your turn to pass")

        passing_player = next((player for player in players if player.id == player_id), None)
        if not passing_player:
            raise HTTPException(status_code=403, detail="This player cannot take a turn")
        # The current player may be passing because they just left, lost their connection or were knocked out.
        # Their turn still goes to the next player rather than ending the game on the spot.
        is_leaving = passing_player not in GameService.eligible_players(players)
        next_player = GameService.next_player_after(players, player_id)
        if next_player is None or (not is_leaving and GameService.too_few_players(players)):
            in_game = GameService.players_in_game(players)
            winner = await GameService.finish_game(db, game, players, in_game[0].id if len(in_game) == 1 else None)
            await db.flush()
            return game, True, "PLAYER_LEFT", winner

        game.consecutive_passes += 1

        completed_turn = game.turn_number
        reached_max_turns = bool(game.max_turns and completed_turn >= game.max_turns)
        if not reached_max_turns:
            game.current_player_id = next_player.id
            game.turn_number += 1
            game.turn_started_at = get_utc_now()

        # Record pass move
        pass_move = Move(
            id=str(uuid.uuid4()),
            game_id=game.id,
            player_id=player_id,
            turn_number=completed_turn,
            move_type="PASS",
            placed_tiles=[],
            words_formed=[],
            score_earned=0
        )
        db.add(pass_move)

        # Check end condition
        if game.max_turns is not None:
            is_over, reason, winner = False, None, None
        else:
            is_over, reason, winner = GameEndService.check_game_over(
                game.tile_bag, GameService.players_summary(players), game.consecutive_passes,
                GameService.scoreless_turn_limit(players),
            )
        if is_over or reached_max_turns:
            winner = await GameService.finish_game(db, game, players, winner)

        await db.flush()
        await replace_game_tiles(db, game.id, game.tile_bag, players)
        return game, is_over or reached_max_turns, reason or ("MAX_TURNS" if reached_max_turns else None), winner

    @staticmethod
    async def leave_game(
        db: AsyncSession, game_id: str, player_id: str, status: str = "OFFLINE"
    ) -> tuple[Game, bool, str | None, str | None]:
        """
        Take a player out of the turn order and pass their turn if it is theirs. `OFFLINE` means they left
        for good; `DISCONNECTED` means their connection dropped, so they rejoin the turn order on reconnecting.
        """
        game = (await db.execute(select(Game).where(Game.id == game_id).with_for_update())).scalar_one_or_none()
        player = (await db.execute(select(GamePlayer).where(
            GamePlayer.id == player_id, GamePlayer.game_id == game_id
        ))).scalar_one_or_none()
        if not game or not player:
            raise HTTPException(status_code=404, detail="Game or player not found")
        if player.connection_status != "OFFLINE":
            player.connection_status = status
            if status == "OFFLINE":
                player.hp = 0

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        from app.services.bot_service import BotService

        # Check if any human players are still in the game
        human_players_in_game = [
            p for p in players
            if p.connection_status != "OFFLINE" and not BotService.is_bot_player(p) and p.hp > 0
        ]

        if not human_players_in_game:
            # All human players left the game (only bots or offline players remain)
            winner = await GameService.finish_game(db, game, players, None)
            room = (await db.execute(select(GameRoom).where(GameRoom.id == game.id))).scalar_one_or_none()
            if room:
                room.status = "ABANDONED"
                room.finished_at = get_utc_now()
            await db.flush()
            return game, True, "ALL_PLAYERS_LEFT", winner

        # Check if only 1 living player remains after an OFFLINE leave
        in_game = GameService.players_in_game(players)
        if len(players) > 1 and len(in_game) <= 1:
            winner_id = in_game[0].id if in_game else GameEndService.determine_winner(GameService.players_summary(players))
            winner_id = await GameService.finish_game(db, game, players, winner_id)
            await db.flush()
            return game, True, "PLAYER_LEFT", winner_id

        if game.status != "PLAYING" or game.current_player_id != player_id:
            await db.flush()
            return game, False, None, None

        if status == "DISCONNECTED":
            if GameService.next_player_after(players, player_id) is None:
                # Nobody else is connected to take the turn (a solo game, say): keep it for when they
                # are back instead of ending the game over a dropped connection.
                await db.flush()
                return game, False, None, None

        return await GameService.pass_turn(db, game_id, player_id)

    @staticmethod
    async def eliminate_disconnected_player(
        db: AsyncSession, game_id: str, player_id: str
    ) -> tuple[Optional[Game], bool, Optional[str], Optional[str]]:
        """
        Eliminates a player who has disconnected for >= 2 minutes (120s):
        Sets HP to 0 and connection_status to OFFLINE (knocked out).
        Advances turn if it is currently their turn, and checks for game over.
        """
        stmt_game = select(Game).where(Game.id == game_id).with_for_update()
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        stmt_player = select(GamePlayer).where(
            GamePlayer.id == player_id, GamePlayer.game_id == game_id
        ).with_for_update()
        player = (await db.execute(stmt_player)).scalar_one_or_none()

        if not game or not player:
            return None, False, None, None

        if game.status != "PLAYING":
            player.connection_status = "OFFLINE"
            player.hp = 0
            await db.flush()
            return game, False, None, None

        # Mark player as dead / offline
        player.hp = 0
        player.connection_status = "OFFLINE"

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        from app.services.bot_service import BotService

        # Check if all human players left
        human_players_in_game = [
            p for p in players
            if p.connection_status != "OFFLINE" and not BotService.is_bot_player(p) and p.hp > 0
        ]
        if not human_players_in_game:
            winner = await GameService.finish_game(db, game, players, None)
            room = (await db.execute(select(GameRoom).where(GameRoom.id == game.id))).scalar_one_or_none()
            if room:
                room.status = "ABANDONED"
                room.finished_at = get_utc_now()
            await db.flush()
            return game, True, "ALL_PLAYERS_LEFT", winner

        # Validate turn order and check for game over (e.g. only 1 surviving player)
        validation = await GameService.ensure_turn_order_valid(db, game, players)
        await db.flush()

        return game, validation["game_over"], validation["reason"], validation["winner_id"]

    @staticmethod
    async def exchange_tiles(
        db: AsyncSession, game_id: str, player_id: str, tile_ids: list[str]
    ) -> tuple[Game, bool, bool, str | None, str | None]:
        """
        Send rack tiles back to the bag for fresh ones (rules §5). An exchange uses up the turn,
        scores nothing and counts as a scoreless turn (rules §6).
        Returns: (game, exchanged, game_over, reason, winner_id). `exchanged` is False when more tiles
        were requested than the bag holds, which the rules treat as a pass.
        """
        game = (await db.execute(select(Game).where(Game.id == game_id).with_for_update())).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")
        if game.status != "PLAYING":
            raise HTTPException(status_code=400, detail="Game is not currently active")
        if game.current_player_id != player_id:
            raise HTTPException(status_code=403, detail="It is not your turn to exchange tiles")

        game.pending_double_target_id = None

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()
        player = next((p for p in players if p.id == player_id), None)
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        if player.hp <= 0 or player.connection_status == "OFFLINE":
            raise HTTPException(status_code=403, detail="This player cannot play")

        bag = await bag_tiles(db, game_id)
        if len(bag) < settings.MIN_BAG_TILES_TO_EXCHANGE:
            raise HTTPException(
                status_code=400,
                detail=f"Exchanging needs at least {settings.MIN_BAG_TILES_TO_EXCHANGE} tiles in the bag (only {len(bag)} left)"
            )
        try:
            new_rack, new_bag = TileService.exchange_tiles(await player_rack(db, player.id), bag, tile_ids)
        except NotEnoughTilesInBag:
            # Rules §5: asking for more tiles than the bag holds forfeits the turn as a pass.
            game, is_over, reason, winner = await GameService.pass_turn(db, game_id, player_id)
            return game, False, is_over, reason, winner
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error))
        player.rack = new_rack
        game.tile_bag = new_bag

        db.add(Move(
            id=str(uuid.uuid4()),
            game_id=game.id,
            player_id=player.id,
            turn_number=game.turn_number,
            move_type="EXCHANGE",
            placed_tiles=[],
            words_formed=[],
            score_earned=0
        ))

        # Rules §6: an exchange scores nothing, so it counts towards the scoreless turns that end the game.
        game.consecutive_passes += 1
        if game.max_turns is not None:
            scoreless_over, reason, winner = False, None, None
        else:
            scoreless_over, reason, winner = GameEndService.check_game_over(
                game.tile_bag, GameService.players_summary(players), game.consecutive_passes,
                GameService.scoreless_turn_limit(players),
            )
        reached_max_turns = bool(game.max_turns and game.turn_number >= game.max_turns)
        game_over = scoreless_over or reached_max_turns or GameService.too_few_players(players)
        if game_over:
            winner = await GameService.finish_game(db, game, players, winner)
            reason = reason or ("MAX_TURNS" if reached_max_turns else "PLAYER_LEFT")
        else:
            game.current_player_id = GameService.next_player_after(players, player_id).id
            game.turn_number += 1
            game.turn_started_at = get_utc_now()

        await db.flush()
        await replace_game_tiles(db, game.id, game.tile_bag, players)
        return game, True, game_over, reason, winner
