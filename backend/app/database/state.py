from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import BoardCell, GameTile, PlayerCard, Game, GamePlayer


async def board_state(db: AsyncSession, game_id: str) -> dict[str, dict[str, Any]]:
    b_state = await db.scalar(select(Game.board_state).where(Game.id == game_id))
    if b_state is not None and isinstance(b_state, dict):
        return b_state
    cells = (await db.execute(
        select(BoardCell).where(BoardCell.game_id == game_id).order_by(BoardCell.row, BoardCell.col)
    )).scalars().all()
    return {
        f"{cell.row}_{cell.col}": {
            "row": cell.row,
            "col": cell.col,
            "letter": cell.letter,
            "value": cell.value,
            "player_id": cell.player_id,
            "turn_number": cell.turn_number,
        }
        for cell in cells
    }


async def replace_board_state(db: AsyncSession, game_id: str, state: dict[str, dict[str, Any]]) -> None:
    # Update JSON column directly on Game (instant in-memory row update)
    game = await db.scalar(select(Game).where(Game.id == game_id))
    if game:
        game.board_state = state


async def replace_game_tiles(
    db: AsyncSession,
    game_id: str,
    bag: list[dict[str, Any]],
    players: list[Any],
) -> None:
    # Tiles are already persisted in game.tile_bag and player.rack JSON columns!
    pass


async def player_rack(db: AsyncSession, player_id: str) -> list[dict[str, Any]]:
    p_rack = await db.scalar(select(GamePlayer.rack).where(GamePlayer.id == player_id))
    if p_rack is not None and isinstance(p_rack, list):
        return p_rack
    tiles = (await db.execute(
        select(GameTile).where(GameTile.player_id == player_id, GameTile.location == "RACK").order_by(GameTile.position)
    )).scalars().all()
    return [{"id": tile.id, "letter": tile.letter, "value": tile.value} for tile in tiles]


async def bag_tiles(db: AsyncSession, game_id: str) -> list[dict[str, Any]]:
    b_tiles = await db.scalar(select(Game.tile_bag).where(Game.id == game_id))
    if b_tiles is not None and isinstance(b_tiles, list):
        return b_tiles
    tiles = (await db.execute(
        select(GameTile).where(GameTile.game_id == game_id, GameTile.location == "BAG").order_by(GameTile.position)
    )).scalars().all()
    return [{"id": tile.id, "letter": tile.letter, "value": tile.value} for tile in tiles]


async def player_cards(db: AsyncSession, player_id: str) -> list[str]:
    p_cards = await db.scalar(select(GamePlayer.cards).where(GamePlayer.id == player_id))
    if p_cards is not None and isinstance(p_cards, list):
        return p_cards
    cards = (await db.execute(
        select(PlayerCard).where(PlayerCard.player_id == player_id).order_by(PlayerCard.created_at)
    )).scalars().all()
    return [card.card_type for card in cards]


async def replace_player_cards(db: AsyncSession, player_id: str, cards: list[str]) -> None:
    player = await db.scalar(select(GamePlayer).where(GamePlayer.id == player_id))
    if player:
        player.cards = cards