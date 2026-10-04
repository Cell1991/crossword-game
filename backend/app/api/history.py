from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete, desc, func, or_
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
    # Fetch recent games (query more than limit so we have enough after filtering out solo/debug games).
    # Moves are intentionally NOT eager-loaded here -- each Move row carries sizeable JSON payloads
    # (placed_tiles/words_formed/card_details) and this list only needs a per-game move *count*,
    # fetched separately below for just the games that make it into the final page.
    stmt = (
        select(Game)
        .outerjoin(GameRoom, Game.id == GameRoom.id)
        .options(
            selectinload(Game.room),
            selectinload(Game.players),
        )
        .where(or_(GameRoom.is_debug.is_(False), GameRoom.is_debug.is_(None)))
        .order_by(desc(Game.created_at))
        .limit(max(limit * 5, 250))
    )
    result = await db.execute(stmt)
    games = result.scalars().all()

    history_items: list[dict[str, Any]] = []
    kept_games: list[Game] = []

    for game in games:
        room = game.room
        players = list(game.players)

        # Skip debug mode rooms
        if room and room.is_debug:
            continue

        # Skip solo matches where only 1 human player played without bot opponents
        has_bot = any(p.is_bot for p in players)
        if len(players) <= 1 and not has_bot:
            continue

        # Skip matches where no points were scored (all players have 0 or <= 0 score)
        if not players or all((p.score or 0) <= 0 for p in players):
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

        kept_games.append(game)
        history_items.append({
            "game_id": game.id,
            "game_pin": room.game_pin if room else None,
            "game_mode": room.game_mode if room else ("TURNS" if game.max_turns else "HP"),
            "status": game.status,
            "created_at": game.created_at.isoformat() if game.created_at else None,
            "started_at": room.started_at.isoformat() if room and room.started_at else (game.created_at.isoformat() if game.created_at else None),
            "finished_at": room.finished_at.isoformat() if room and room.finished_at else (game.updated_at.isoformat() if game.updated_at else None),
            "total_turns": game.turn_number,
            "total_moves": 0,
            "winner": winner_info,
            "players": player_list,
        })

        if len(history_items) >= limit:
            break

    # Fill in move counts with one cheap aggregate query, scoped to just the games in this page.
    if kept_games:
        move_counts_stmt = (
            select(Move.game_id, func.count(Move.id))
            .where(Move.game_id.in_([g.id for g in kept_games]))
            .group_by(Move.game_id)
        )
        move_counts = dict((await db.execute(move_counts_stmt)).all())
        for item in history_items:
            item["total_moves"] = move_counts.get(item["game_id"], 0)

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

    # Pre-group any legacy CARD_USED events by turn_number so we can attach them to the turn's
    # actual move even when the card (e.g. a reactive SHIELD) was used by a different player than
    # whoever ended up completing that turn.
    legacy_turn_cards: dict[int, list[dict[str, Any]]] = {}
    turn_moves_present: set[int] = set()

    for m in raw_moves:
        if m.move_type != "CARD_USED":
            turn_moves_present.add(m.turn_number)
        else:
            cd = m.card_details
            c_list = [cd] if isinstance(cd, dict) else (cd if isinstance(cd, list) else [])
            if c_list:
                caster = player_map.get(m.player_id)
                caster_name = caster.display_name if caster else "Unknown Player"
                tagged = [
                    {**c, "player_id": c.get("player_id", m.player_id), "player_name": c.get("player_name", caster_name)}
                    if isinstance(c, dict) else c
                    for c in c_list
                ]
                legacy_turn_cards.setdefault(m.turn_number, []).extend(tagged)

    replay_moves: list[dict[str, Any]] = []
    running_scores: dict[str, int] = {p.id: 0 for p in players}

    for m in raw_moves:
        p_obj = player_map.get(m.player_id)
        p_name = p_obj.display_name if p_obj else "Unknown Player"
        running_scores[m.player_id] = running_scores.get(m.player_id, 0) + (m.score_earned or 0)

        c_details = m.card_details
        if c_details and isinstance(c_details, dict):
            c_details = [c_details]
        elif not isinstance(c_details, list):
            c_details = []

        if m.move_type == "CARD_USED":
            # If there was an actual turn move (PLACE/PASS/EXCHANGE) in this same turn,
            # this legacy CARD_USED move is already merged into that move's card_details!
            if m.turn_number in turn_moves_present:
                continue

            # Standalone card move in older game (no other move in that turn) -> keep it!
            replay_moves.append({
                "move_id": m.id,
                "turn_number": m.turn_number,
                "player_id": m.player_id,
                "player_name": p_name,
                "is_bot": p_obj.is_bot if p_obj else False,
                "move_type": m.move_type,
                "placed_tiles": m.placed_tiles or [],
                "words_formed": m.words_formed or [],
                "score_earned": m.score_earned or 0,
                "rack_before": m.rack_before or [],
                "card_details": c_details if c_details else None,
                "running_scores": dict(running_scores),
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })
            continue

        # For PLACE/PASS/EXCHANGE moves, include both its own card_details and any legacy CARD_USED moves for this turn
        extra_cards = legacy_turn_cards.get(m.turn_number, [])
        all_cards = list(c_details)
        for ec in extra_cards:
            if ec not in all_cards:
                all_cards.append(ec)

        replay_moves.append({
            "move_id": m.id,
            "turn_number": m.turn_number,
            "player_id": m.player_id,
            "player_name": p_name,
            "is_bot": p_obj.is_bot if p_obj else False,
            "move_type": m.move_type,
            "placed_tiles": m.placed_tiles or [],
            "words_formed": m.words_formed or [],
            "score_earned": m.score_earned or 0,
            "rack_before": m.rack_before or [],
            "card_details": all_cards if all_cards else None,
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
