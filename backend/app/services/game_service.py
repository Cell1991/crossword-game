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
from app.schemas.game import GameStateResponse
from app.database.state import bag_tiles, board_state, player_rack, player_cards, replace_game_tiles

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
                if amount:
                    player.hp = max(0, player.hp - amount)
                    applied[player.id] = amount
            players_dict = [{"id": p.id, "display_name": p.display_name, "score": p.score, "hp": p.hp, "rack": p.rack} for p in players]
            is_over, reason, winner = GameEndService.check_game_over(game.tile_bag, players_dict, game.consecutive_passes)
            # A DISCONNECTED player is recoverable (they rejoin on reconnect) and must not end the
            # game on their own — only players truly OFFLINE (left for good) count here, same as
            # too_few_players. Debug mode's "Acting as" switch drops and reopens the socket, which
            # briefly marks the other debug player DISCONNECTED; that must not end the game either.
            in_game_players = GameService.players_in_game(players)
            game_over = is_over or (len(players) > 1 and len(in_game_players) <= 1)
            if game_over:
                game.status = "FINISHED"
                game.current_player_id = None
                game.turn_started_at = None
                room = (await db.execute(select(GameRoom).where(GameRoom.id == game.id))).scalar_one_or_none()
                if room:
                    room.status = "FINISHED"
                    room.finished_at = get_utc_now()
            return {"type": "DAMAGE", "applied": applied, "game_over": game_over, "reason": reason, "winner_id": winner}

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

        turn_started_at = game.turn_started_at
        if turn_started_at and turn_started_at.tzinfo is None:
            turn_started_at = turn_started_at.replace(tzinfo=timezone.utc)

        normalized_board = await board_state(db, game_id)
        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        player_outs = []
        for p in players:
            normalized_rack = await player_rack(db, p.id)
            normalized_cards = await player_cards(db, p.id)
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
                turn_order=p.turn_order,
                connection_status=p.connection_status,
                rack_count=len(normalized_rack),
                rack=p_rack
                ,cards=normalized_cards if reveal_all or is_mine else None
            ))

        return GameStateResponse(
            game_id=game.id,
            status=game.status,
            current_player_id=game.current_player_id,
            turn_number=game.turn_number,
            consecutive_passes=game.consecutive_passes,
            board_state=normalized_board,
            players=player_outs,
            tile_bag_count=await db.scalar(select(func.count()).select_from(GameTile).where(GameTile.game_id == game_id, GameTile.location == "BAG")) or 0,
            turn_time_limit=room.turn_time_limit if room else None,
            turn_started_at=turn_started_at,
            max_turns=game.max_turns,
            pending_effect=GameService._visible_pending_effect(game.pending_effect, requesting_player_id),
            frozen_tile=game.frozen_tile,
            winner_id=game.winner_id,
            server_time=datetime.now(timezone.utc),
            game_pin=room.game_pin if room else None,
        )

    @staticmethod
    def _visible_pending_effect(effect: Optional[dict[str, Any]], requesting_player_id: Optional[str]) -> Optional[dict[str, Any]]:
        """SWAP tile letters are private to the two players involved; everyone else
        (and DAMAGE effects, which only carry public score-derived amounts) sees the rest."""
        if not effect:
            return None
        if effect["type"] == "SWAP" and requesting_player_id not in (effect.get("source_player_id"), effect.get("target_player_id")):
            return {"type": "SWAP", "expires_at": effect["expires_at"]}
        return effect

    @staticmethod
    async def pass_turn(db: AsyncSession, game_id: str, player_id: str) -> tuple[Game, bool, str | None, str | None]:
        stmt_game = select(Game).where(Game.id == game_id).with_for_update()
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        if game.status != "PLAYING":
            raise HTTPException(status_code=400, detail="Game is not currently active")

        if game.current_player_id != player_id:
            raise HTTPException(status_code=403, detail="It is not your turn to pass")

        game.pending_double_target_id = None

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()
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
        if game.status != "PLAYING" or game.current_player_id != player_id:
            await db.flush()
            return game, False, None, None
        if status == "DISCONNECTED":
            players = (await db.execute(
                select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
            )).scalars().all()
            if GameService.next_player_after(players, player_id) is None:
                # Nobody else is connected to take the turn (a solo game, say): keep it for when they
                # are back instead of ending the game over a dropped connection.
                await db.flush()
                return game, False, None, None
        return await GameService.pass_turn(db, game_id, player_id)

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
