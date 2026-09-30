from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import inspect, text, select, func, insert
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.database.models import (
    Base, Game, GamePlayer, BoardCell, GameTile, PlayerCard, DictionaryWord, WordDefinition
)
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
        await _seed_word_definitions(session)
        await session.commit()


async def _backfill_normalized_state(session: AsyncSession):
    """Backfill normalized tables once, preserving databases created by older builds."""
    # Fast check: only query games if any unmigrated game exists
    unmigrated_games = (await session.execute(
        select(Game).where(Game.board_state != None) # noqa
    )).scalars().all()
    if not unmigrated_games:
        return

    for game in unmigrated_games:
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


async def _seed_dictionary(session: AsyncSession):
    """Copy the configured dictionary into PostgreSQL/SQLite once if table is empty."""
    word_count = await session.scalar(select(func.count()).select_from(DictionaryWord))
    if word_count:
        return

    rows = [
        {"word": word, "word_length": len(word)}
        for word in sorted(dictionary_service._words)
        if 2 <= len(word) <= 32 and word.isalpha()
    ]
    batch_size = 5_000
    for start in range(0, len(rows), batch_size):
        await session.execute(insert(DictionaryWord), rows[start:start + batch_size])


async def _seed_word_definitions(session: AsyncSession):
    """Seed offline definitions into PostgreSQL/SQLite if table is empty."""
    from app.game.offline_definitions import OFFLINE_DEFINITIONS

    def_count = await session.scalar(select(func.count()).select_from(WordDefinition))
    if def_count:
        return

    new_rows = []
    for word, data in OFFLINE_DEFINITIONS.items():
        new_rows.append({
            "word": word,
            "phonetic": data.get("phonetic"),
            "meanings": data.get("meanings", []),
            "source": "OFFLINE",
        })
    if new_rows:
        await session.execute(insert(WordDefinition), new_rows)



def _upgrade_existing_schema(connection):
    """Apply small additive upgrades without destroying an existing game database."""
    inspector = inspect(connection)
    upgrades = {
        "games": {
            "banned_letter": "VARCHAR(10)",
            "banned_until_turn": "INTEGER",
            "banned_by_player_id": "VARCHAR(36)",
            "turn_started_at": "TIMESTAMP",
            "max_turns": "INTEGER",
            "starting_hp": "INTEGER",
            "frozen_tile": "JSON",
            "pending_effect": "JSON",
            "pending_double_target_id": "VARCHAR(36)",
            "winner_id": "VARCHAR(36)",
        },
        "game_rooms": {
            "turn_time_limit": "INTEGER",
            "is_debug": "BOOLEAN DEFAULT FALSE NOT NULL",
            "game_mode": "VARCHAR(16) DEFAULT 'HP' NOT NULL",
            "max_turns": "INTEGER",
            "starting_hp": "INTEGER",
            "rematch_pin": "VARCHAR(6)",
        },
        "game_players": {
            "hp": "INTEGER DEFAULT 100 NOT NULL",
            "max_hp": "INTEGER DEFAULT 100 NOT NULL",
            "has_shield": "BOOLEAN DEFAULT FALSE NOT NULL",
            "cards": "JSON",
            "banned_letter": "VARCHAR(10)",
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

    # Expand letter column widths to support BLANK / multi-character values
    for stmt in [
        "ALTER TABLE game_tiles ALTER COLUMN letter TYPE VARCHAR(10)",
        "ALTER TABLE board_cells ALTER COLUMN letter TYPE VARCHAR(10)",
        "ALTER TABLE games ALTER COLUMN banned_letter TYPE VARCHAR(10)",
        "ALTER TABLE game_players ALTER COLUMN banned_letter TYPE VARCHAR(10)",
    ]:
        try:
            connection.execute(text(stmt))
        except Exception:
            pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
