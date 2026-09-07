from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import inspect, text, select, func
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.database.models import Base, Game, GamePlayer, BoardCell, GameTile, PlayerCard, DictionaryWord
from app.game.dictionary import dictionary_service

engine_kwargs = {}
if "sqlite" in settings.DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = NullPool

# Async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def init_db():
    """Create tables and add columns introduced after the initial schema."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_upgrade_existing_schema)
    async with AsyncSessionLocal() as session:
        await _backfill_normalized_state(session)
        await _seed_dictionary(session)
        await _load_dictionary_from_database(session)
        await session.commit()


async def _backfill_normalized_state(session: AsyncSession):
    """Backfill normalized tables once, preserving databases created by older builds."""
    games = (await session.execute(select(Game))).scalars().all()
    for game in games:
        cell_count = await session.scalar(select(func.count()).select_from(BoardCell).where(BoardCell.game_id == game.id))
        if not cell_count and game.board_state:
            session.add_all([
                BoardCell(
                    game_id=game.id,
                    row=cell["row"],
                    col=cell["col"],
                    letter=cell["letter"].upper(),
                    value=cell["value"],
                    player_id=cell.get("player_id") or game.current_player_id,
                    turn_number=cell.get("turn_number", 0),
                )
                for cell in game.board_state.values()
                if cell.get("player_id") or game.current_player_id
            ])

        tile_count = await session.scalar(select(func.count()).select_from(GameTile).where(GameTile.game_id == game.id))
        if not tile_count and game.tile_bag:
            session.add_all([
                GameTile(
                    id=tile["id"], game_id=game.id, location="BAG", position=index,
                    letter=tile["letter"].upper(), value=tile["value"]
                )
                for index, tile in enumerate(game.tile_bag)
            ])

    players = (await session.execute(select(GamePlayer))).scalars().all()
    for player in players:
        tile_count = await session.scalar(select(func.count()).select_from(GameTile).where(GameTile.player_id == player.id))
        if not tile_count and player.rack:
            session.add_all([
                GameTile(
                    id=tile["id"], game_id=player.game_id, player_id=player.id,
                    location="RACK", position=index, letter=tile["letter"].upper(), value=tile["value"]
                )
                for index, tile in enumerate(player.rack)
            ])
        card_count = await session.scalar(select(func.count()).select_from(PlayerCard).where(PlayerCard.player_id == player.id))
        if not card_count and player.cards:
            session.add_all([PlayerCard(player_id=player.id, card_type=card) for card in player.cards])


async def _seed_dictionary(session: AsyncSession):
    """Copy the configured dictionary into PostgreSQL/SQLite once."""
    word_count = await session.scalar(select(func.count()).select_from(DictionaryWord))
    if word_count:
        return
    words = sorted(dictionary_service._words)
    session.add_all([
        DictionaryWord(word=word, word_length=len(word))
        for word in words if 2 <= len(word) <= 32 and word.isalpha()
    ])


async def _load_dictionary_from_database(session: AsyncSession):
    """Use the normalized dictionary table as the runtime source of truth."""
    await session.flush()
    words = (await session.execute(select(DictionaryWord.word))).scalars().all()
    if words:
        dictionary_service._words = set(words)


def _upgrade_existing_schema(connection):
    """Apply small additive upgrades without destroying an existing game database."""
    inspector = inspect(connection)
    upgrades = {
        "games": {
            "banned_letter": "VARCHAR(1)",
            "banned_until_turn": "INTEGER",
            "banned_by_player_id": "VARCHAR(36)",
            "turn_started_at": "TIMESTAMP",
            "max_turns": "INTEGER",
        },
        "game_rooms": {
            "turn_time_limit": "INTEGER",
        },
        "game_players": {
            "hp": "INTEGER DEFAULT 100 NOT NULL",
            "cards": "JSON",
            "banned_letter": "VARCHAR(1)",
            "banned_until_turn": "INTEGER",
        },
    }

    for table_name, columns in upgrades.items():
        existing = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name, column_definition in columns.items():
            if column_name not in existing:
                connection.execute(text(
                    f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
                ))

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
