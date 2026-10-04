from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.database.models import Game, GameRoom, GamePlayer, Move, BoardCell, GameTile, PlayerCard

router = APIRouter(prefix="/history", tags=["history"])


@router.get("")
async def get_match_history(
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns the last `limit` (default 50) completed or played games with full player summaries.
    Excludes debug mode games and solo practice games (1 human player without bot opponents).
    """
    # Fetch recent games (query more than limit so we have enough after filtering out solo/debug games)
    stmt = (
        select(Game)
        .outerjoin(GameRoom, Game.id == GameRoom.id)
        .options(
            selectinload(Game.room),
            selectinload(Game.players),
            selectinload(Game.moves),
        )
        .where(or_(GameRoom.is_debug.is_(False), GameRoom.is_debug.is_(None)))
        .order_by(desc(Game.created_at))
        .limit(max(limit * 5, 250))
    )
    result = await db.execute(stmt)
    games = result.scalars().all()

    history_items: list[dict[str, Any]] = []

    for game in games:
        room = game.room
        players = list(game.players)
        moves = list(game.moves)

        # Skip debug mode rooms
        if room and room.is_debug:
            continue

        # Skip solo matches where only 1 human player played without bot opponents
        has_bot = any(p.is_bot for p in players)
        if len(players) <= 1 and not has_bot:
            continue

        sorted_players = sorted(players, key=lambda p: p.score, reverse=True)
        winner_id = game.winner_id or (sorted_players[0].id if sorted_players else None)

        winner_info = None
        player_list = []
        for p in players:
            is_win = (p.id == winner_id)
            p_data = {
                "id": p.id,
                "display_name": p.display_name,
                "score": p.score,
                "hp": p.hp,
                "max_hp": p.max_hp,
                "is_bot": p.is_bot,
                "bot_difficulty": p.bot_difficulty,
                "is_winner": is_win,
                "turn_order": p.turn_order,
            }
            player_list.append(p_data)
            if is_win:
                winner_info = p_data

        history_items.append({
            "game_id": game.id,
            "game_pin": room.game_pin if room else None,
            "game_mode": room.game_mode if room else ("TURNS" if game.max_turns else "HP"),
            "status": game.status,
            "created_at": game.created_at.isoformat() if game.created_at else None,
            "started_at": room.started_at.isoformat() if room and room.started_at else (game.created_at.isoformat() if game.created_at else None),
            "finished_at": room.finished_at.isoformat() if room and room.finished_at else (game.updated_at.isoformat() if game.updated_at else None),
            "total_turns": game.turn_number,
            "total_moves": len(moves),
            "winner": winner_info,
            "players": player_list,
        })

        if len(history_items) >= limit:
            break

    return {
        "success": True,
        "count": len(history_items),
        "history": history_items,
    }


@router.get("/{game_id}")
async def get_match_replay(
    game_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns full turn-by-turn replay data for match analysis.
    """
    stmt = (
        select(Game)
        .options(
            selectinload(Game.room),
            selectinload(Game.players),
            selectinload(Game.moves),
        )
        .where(Game.id == game_id)
    )
    result = await db.execute(stmt)
    game = result.scalar_one_or_none()

    if not game or (game.room and game.room.is_debug):
        raise HTTPException(status_code=404, detail="Match not found in history")

    room = game.room
    players = list(game.players)
    player_map = {p.id: p for p in players}

    moves_stmt = (
        select(Move)
        .where(Move.game_id == game_id)
        .order_by(Move.turn_number.asc(), Move.created_at.asc())
    )
    moves_res = await db.execute(moves_stmt)
    raw_moves = moves_res.scalars().all()

    replay_moves: list[dict[str, Any]] = []
    running_scores: dict[str, int] = {p.id: 0 for p in players}

    for m in raw_moves:
        p_obj = player_map.get(m.player_id)
        p_name = p_obj.display_name if p_obj else "Unknown Player"
        running_scores[m.player_id] = running_scores.get(m.player_id, 0) + m.score_earned

        replay_moves.append({
            "move_id": m.id,
            "turn_number": m.turn_number,
            "player_id": m.player_id,
            "player_name": p_name,
            "is_bot": p_obj.is_bot if p_obj else False,
            "move_type": m.move_type,
            "placed_tiles": m.placed_tiles or [],
            "words_formed": m.words_formed or [],
            "score_earned": m.score_earned,
            "rack_before": m.rack_before or [],
            "running_scores": dict(running_scores),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {
        "success": True,
        "game_id": game.id,
        "game_pin": room.game_pin if room else None,
        "game_mode": room.game_mode if room else ("TURNS" if game.max_turns else "HP"),
        "starting_hp": game.starting_hp,
        "max_turns": game.max_turns,
        "winner_id": game.winner_id,
        "created_at": game.created_at.isoformat() if game.created_at else None,
        "started_at": room.started_at.isoformat() if room and room.started_at else (game.created_at.isoformat() if game.created_at else None),
        "finished_at": room.finished_at.isoformat() if room and room.finished_at else (game.updated_at.isoformat() if game.updated_at else None),
        "players": [
            {
                "id": p.id,
                "display_name": p.display_name,
                "score": p.score,
                "hp": p.hp,
                "max_hp": p.max_hp,
                "is_bot": p.is_bot,
                "bot_difficulty": p.bot_difficulty,
                "turn_order": p.turn_order,
                "is_winner": (p.id == game.winner_id),
            }
            for p in players
        ],
        "moves": replay_moves,
        "total_moves": len(replay_moves),
        "final_board": game.board_state or {},
    }


@router.delete("/{game_id}")
async def delete_match_history(
    game_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Deletes a specific match from history.
    """
    stmt = select(Game).where(Game.id == game_id)
    game = (await db.execute(stmt)).scalar_one_or_none()

    if not game:
        raise HTTPException(status_code=404, detail="Match not found")

    # Delete moves, board_cells, game_tiles, player_cards, game_players, game, game_room
    player_ids_stmt = select(GamePlayer.id).where(GamePlayer.game_id == game_id)
    p_ids = (await db.execute(player_ids_stmt)).scalars().all()
    if p_ids:
        await db.execute(delete(PlayerCard).where(PlayerCard.player_id.in_(p_ids)))

    await db.execute(delete(Move).where(Move.game_id == game_id))
    await db.execute(delete(BoardCell).where(BoardCell.game_id == game_id))
    await db.execute(delete(GameTile).where(GameTile.game_id == game_id))
    await db.execute(delete(GamePlayer).where(GamePlayer.game_id == game_id))
    await db.execute(delete(Game).where(Game.id == game_id))
    await db.execute(delete(GameRoom).where(GameRoom.id == game_id))
    await db.commit()

    return {"success": True, "message": f"Match {game_id} deleted from history"}


@router.delete("")
async def clear_all_match_history(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Clears all match history from database.
    """
    await db.execute(delete(PlayerCard))
    await db.execute(delete(Move))
    await db.execute(delete(BoardCell))
    await db.execute(delete(GameTile))
    await db.execute(delete(GamePlayer))
    await db.execute(delete(Game))
    await db.execute(delete(GameRoom))
    await db.commit()

    return {"success": True, "message": "All match history cleared"}
