import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.database.models import Game, GamePlayer, Move, GameRoom, get_utc_now
from app.game.game_end import GameEndService
from app.schemas.player import PlayerOut, TileSchema
from app.schemas.game import GameStateResponse

class GameService:

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

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        player_outs = []
        for p in players:
            p_rack = None
            if requesting_player_id and p.id == requesting_player_id:
                p_rack = [TileSchema(**t) for t in p.rack]
            player_outs.append(PlayerOut(
                id=p.id,
                display_name=p.display_name,
                is_host=p.is_host,
                score=p.score,
                turn_order=p.turn_order,
                connection_status=p.connection_status,
                rack_count=len(p.rack),
                rack=p_rack
            ))

        return GameStateResponse(
            game_id=game.id,
            status=game.status,
            current_player_id=game.current_player_id,
            turn_number=game.turn_number,
            consecutive_passes=game.consecutive_passes,
            board_state=game.board_state,
            players=player_outs,
            tile_bag_count=len(game.tile_bag)
        )

    @staticmethod
    async def pass_turn(db: AsyncSession, game_id: str, player_id: str) -> tuple[Game, bool, str | None, str | None]:
        stmt_game = select(Game).where(Game.id == game_id)
        game = (await db.execute(stmt_game)).scalar_one_or_none()
        if not game:
            raise HTTPException(status_code=404, detail="Game not found")

        if game.status != "PLAYING":
            raise HTTPException(status_code=400, detail="Game is not currently active")

        if game.current_player_id != player_id:
            raise HTTPException(status_code=403, detail="It is not your turn to pass")

        stmt_players = select(GamePlayer).where(GamePlayer.game_id == game_id).order_by(GamePlayer.turn_order)
        players = (await db.execute(stmt_players)).scalars().all()

        game.consecutive_passes += 1
        
        # Next turn order
        current_idx = next(i for i, p in enumerate(players) if p.id == player_id)
        next_idx = (current_idx + 1) % len(players)
        game.current_player_id = players[next_idx].id
        game.turn_number += 1

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
        players_dict = [{"id": p.id, "display_name": p.display_name, "score": p.score, "rack": p.rack} for p in players]
        is_over, reason, winner = GameEndService.check_game_over(game.tile_bag, players_dict, game.consecutive_passes)

        if is_over:
            game.status = "FINISHED"
            stmt_room = select(GameRoom).where(GameRoom.id == game_id)
            room = (await db.execute(stmt_room)).scalar_one_or_none()
            if room:
                room.status = "FINISHED"
                room.finished_at = get_utc_now()

        await db.flush()
        return game, is_over, reason, winner
