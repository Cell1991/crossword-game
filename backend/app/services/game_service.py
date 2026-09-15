import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.database.models import Game, GamePlayer, Move, GameRoom, GameTile, get_utc_now
from app.game.game_end import GameEndService
from app.schemas.player import PlayerOut, TileSchema
from app.schemas.game import GameStateResponse
from app.database.state import board_state, player_rack, player_cards, replace_game_tiles

class GameService:

    @staticmethod
    def eligible_players(players: list[GamePlayer]) -> list[GamePlayer]:
        """Return players who can receive a turn."""
        return [player for player in players if player.hp > 0 and player.connection_status != "OFFLINE"]

    @staticmethod
    async def expire_turn_if_needed(db: AsyncSession, game_id: str) -> tuple[Game, bool, str | None, str | None]:
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
        return await GameService.pass_turn(db, game_id, game.current_player_id or "")

    @staticmethod
    async def get_player_by_token(db: AsyncSession, session_token: str) -> Optional[GamePlayer]:
        stmt = select(GamePlayer).where(GamePlayer.session_token == session_token)
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def get_game_state(db: AsyncSession, game_id: str, requesting_player_id: Optional[str] = None) -> GameStateResponse:
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
            p_rack = None
            if requesting_player_id and p.id == requesting_player_id:
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
                ,cards=normalized_cards if requesting_player_id and p.id == requesting_player_id else None
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
            max_turns=game.max_turns
        )

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

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()
        eligible_players = GameService.eligible_players(players)
        leaving_player = next((player for player in players if player.id == player_id), None)
        if leaving_player and leaving_player.id == game.current_player_id and (
            leaving_player.connection_status == "OFFLINE" or leaving_player.hp <= 0
        ) and len(eligible_players) == 0:
            game.status = "FINISHED"
            game.current_player_id = None
            game.turn_started_at = None
            room = (await db.execute(select(GameRoom).where(GameRoom.id == game_id))).scalar_one_or_none()
            if room:
                room.status = "FINISHED"
                room.finished_at = get_utc_now()
            await db.flush()
            return game, True, "PLAYER_LEFT", eligible_players[0].id if eligible_players else None
        if len(eligible_players) <= 1 and not (
            leaving_player and leaving_player.id == game.current_player_id and (
                leaving_player.connection_status == "OFFLINE" or leaving_player.hp <= 0
            )
        ):
            game.status = "FINISHED"
            game.current_player_id = None
            game.turn_started_at = None
            room = (await db.execute(select(GameRoom).where(GameRoom.id == game_id))).scalar_one_or_none()
            if room:
                room.status = "FINISHED"
                room.finished_at = get_utc_now()
            await db.flush()
            return game, True, "PLAYER_LEFT", eligible_players[0].id if eligible_players else None
        if leaving_player and leaving_player.id == game.current_player_id and (
            leaving_player.connection_status == "OFFLINE" or leaving_player.hp <= 0
        ):
            turn_players = [leaving_player, *[player for player in eligible_players if player.id != leaving_player.id]]
        else:
            turn_players = eligible_players
        if len(turn_players) <= 1:
            raise HTTPException(status_code=400, detail="Not enough active players remain")
        if player_id not in {player.id for player in turn_players}:
            raise HTTPException(status_code=403, detail="This player cannot take a turn")

        game.consecutive_passes += 1
        
        # Next turn order
        current_idx = next(i for i, p in enumerate(turn_players) if p.id == player_id)
        next_idx = (current_idx + 1) % len(turn_players)
        completed_turn = game.turn_number
        reached_max_turns = bool(game.max_turns and completed_turn >= game.max_turns)
        if reached_max_turns:
            game.status = "FINISHED"
            game.current_player_id = None
            game.turn_started_at = None
        else:
            game.current_player_id = turn_players[next_idx].id
            game.turn_number += 1
            game.turn_started_at = get_utc_now()

        # Record pass move
        pass_move = Move(
            id=str(uuid.uuid4()),
            game_id=game.id,
            player_id=player_id,
            turn_number=game.turn_number - 1,
            move_type="PASS",
            placed_tiles=[],
            words_formed=[],
            score_earned=0
        )
        db.add(pass_move)

        # Check end condition
        players_dict = [{"id": p.id, "display_name": p.display_name, "score": p.score, "hp": p.hp, "rack": p.rack} for p in players]
        is_over, reason, winner = GameEndService.check_game_over(game.tile_bag, players_dict, game.consecutive_passes)

        if is_over or reached_max_turns:
            game.status = "FINISHED"
            stmt_room = select(GameRoom).where(GameRoom.id == game_id)
            room = (await db.execute(stmt_room)).scalar_one_or_none()
            if room:
                room.status = "FINISHED"
                room.finished_at = get_utc_now()

        await db.flush()
        await replace_game_tiles(db, game.id, game.tile_bag, players)
        return game, is_over or reached_max_turns, reason or ("MAX_TURNS" if reached_max_turns else None), winner

    @staticmethod
    async def leave_game(db: AsyncSession, game_id: str, player_id: str) -> tuple[Game, bool, str | None, str | None]:
        game = (await db.execute(select(Game).where(Game.id == game_id).with_for_update())).scalar_one_or_none()
        player = (await db.execute(select(GamePlayer).where(
            GamePlayer.id == player_id, GamePlayer.game_id == game_id
        ))).scalar_one_or_none()
        if not game or not player:
            raise HTTPException(status_code=404, detail="Game or player not found")
        player.connection_status = "OFFLINE"
        if game.status != "PLAYING" or game.current_player_id != player_id:
            await db.flush()
            return game, False, None, None
        return await GameService.pass_turn(db, game_id, player_id)
