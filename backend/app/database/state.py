from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import BoardCell, GameTile, PlayerCard


async def board_state(db: AsyncSession, game_id: str) -> dict[str, dict[str, Any]]:
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
    await db.execute(delete(BoardCell).where(BoardCell.game_id == game_id))
    db.add_all([
        BoardCell(
            game_id=game_id,
            row=cell["row"], col=cell["col"], letter=cell["letter"].upper(),
            value=cell["value"], player_id=cell["player_id"], turn_number=cell["turn_number"],
        )
        for cell in state.values()
    ])


async def replace_game_tiles(
    db: AsyncSession,
    game_id: str,
    bag: list[dict[str, Any]],
    players: list[Any],
) -> None:
    await db.execute(delete(GameTile).where(GameTile.game_id == game_id))
    rows = [
        GameTile(id=tile["id"], game_id=game_id, location="BAG", position=index,
                 letter=tile["letter"].upper(), value=tile["value"])
        for index, tile in enumerate(bag)
    ]
    for player in players:
        rows.extend(
            GameTile(id=tile["id"], game_id=game_id, player_id=player.id, location="RACK", position=index,
                     letter=tile["letter"].upper(), value=tile["value"])
            for index, tile in enumerate(player.rack)
        )
    db.add_all(rows)


async def player_rack(db: AsyncSession, player_id: str) -> list[dict[str, Any]]:
    tiles = (await db.execute(
        select(GameTile).where(GameTile.player_id == player_id, GameTile.location == "RACK").order_by(GameTile.position)
    )).scalars().all()
    return [{"id": tile.id, "letter": tile.letter, "value": tile.value} for tile in tiles]


async def bag_tiles(db: AsyncSession, game_id: str) -> list[dict[str, Any]]:
    tiles = (await db.execute(
        select(GameTile).where(GameTile.game_id == game_id, GameTile.location == "BAG").order_by(GameTile.position)
    )).scalars().all()
    return [{"id": tile.id, "letter": tile.letter, "value": tile.value} for tile in tiles]


async def player_cards(db: AsyncSession, player_id: str) -> list[str]:
    cards = (await db.execute(
        select(PlayerCard).where(PlayerCard.player_id == player_id).order_by(PlayerCard.created_at)
    )).scalars().all()
    return [card.card_type for card in cards]


async def replace_player_cards(db: AsyncSession, player_id: str, cards: list[str]) -> None:
    await db.execute(delete(PlayerCard).where(PlayerCard.player_id == player_id))
    db.add_all([PlayerCard(player_id=player_id, card_type=card) for card in cards])