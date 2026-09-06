from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import inspect, text
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.database.models import Base

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
