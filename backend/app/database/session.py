from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import inspect, text, select, func, insert
from sqlalchemy.pool import NullPool
from app.core.config import settings
from app.database.models import (
    Base, Game, GamePlayer, BoardCell, PlayerCard, DictionaryWord, WordDefinition
)
from app.game.dictionary import dictionary_service

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

if "sslmode=require" in db_url:
    db_url = db_url.replace("sslmode=require", "ssl=require")
if "&channel_binding=require" in db_url:
    db_url = db_url.replace("&channel_binding=require", "")

engine_kwargs = {}
if "sqlite" in db_url:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = NullPool
else:
    # Optimized for Neon cloud PgBouncer pooler: zero statement cache prevents roundtrip desync & boosts query speed
    engine_kwargs["connect_args"] = {"statement_cache_size": 0}
    engine_kwargs["pool_size"] = 15
    engine_kwargs["max_overflow"] = 25
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_pre_ping"] = False

# Async engine
engine = create_async_engine(
    db_url,
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
        await _seed_word_definitions(session)
        await _load_cached_word_definitions(session)
        await session.commit()


async def _backfill_normalized_state(session: AsyncSession):
    """Backfill board cells and cards for databases created by older builds.

    Bags and racks are already stored in the authoritative JSON columns. The
    game_tiles table is only a fallback for older rows without those columns;
    copying every historical bag into it on startup can collide because legacy
    tile IDs were shortened to eight characters and are not unique across games.
    """
    board_game_ids = set((await session.execute(select(BoardCell.game_id).distinct())).scalars())
    card_player_ids = set((await session.execute(select(PlayerCard.player_id).distinct())).scalars())

    games = (await session.execute(select(Game))).scalars().all()
    for game in games:
        if game.id not in board_game_ids and game.board_state:
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

    players = (await session.execute(select(GamePlayer))).scalars().all()
    for player in players:
        if player.id not in card_player_ids and player.cards:
            session.add_all([PlayerCard(player_id=player.id, card_type=card) for card in player.cards])


async def _seed_dictionary(session: AsyncSession):
    """Copy the configured dictionary into PostgreSQL/SQLite once."""
    word_count = await session.scalar(select(func.count()).select_from(DictionaryWord))
    if word_count:
        return

    # A word list can contain hundreds of thousands of entries.  Creating one
    # ORM object per word keeps all of them in the session until flush, which
    # can exhaust the container and prevents the API from starting.  Send
    # compact batches straight to the database instead.
    rows = [
        {"word": word, "word_length": len(word)}
        for word in sorted(dictionary_service._words)
        if 2 <= len(word) <= 32 and word.isalpha()
    ]
    batch_size = 5_000
    for start in range(0, len(rows), batch_size):
        await session.execute(insert(DictionaryWord), rows[start:start + batch_size])


async def _load_dictionary_from_database(session: AsyncSession):
    """Use the normalized dictionary table as the runtime source of truth."""
    await session.flush()
    words = await session.stream_scalars(select(DictionaryWord.word))
    loaded = {word async for word in words}
    if loaded:
        dictionary_service._words = loaded
        dictionary_service._rebuild_indices()


async def _seed_word_definitions(session: AsyncSession):
    """Seed offline definitions into PostgreSQL/SQLite if not already present."""
    from app.game.offline_definitions import OFFLINE_DEFINITIONS

    existing_words = set((await session.execute(select(WordDefinition.word))).scalars().all())
    new_rows = []
    for word, data in OFFLINE_DEFINITIONS.items():
        if word not in existing_words:
            new_rows.append({
                "word": word,
                "phonetic": data.get("phonetic"),
                "meanings": data.get("meanings", []),
                "source": "OFFLINE",
            })
    if new_rows:
        await session.execute(insert(WordDefinition), new_rows)


async def _load_cached_word_definitions(session: AsyncSession):
    """Pre-load recent persisted definitions from database directly into the L1 RAM cache."""
    from app.services.dictionary_lookup import dictionary_lookup_service

    await session.flush()
    # Limit initial cache warm-up to 1,000 records; remaining 300,000+ words are fetched on-demand from L2 DB
    records = (await session.execute(select(WordDefinition).limit(1000))).scalars().all()
    for rec in records:
        dictionary_lookup_service._cache[rec.word] = {
            "word": rec.word,
            "found": True,
            "phonetic": rec.phonetic,
            "meanings": rec.meanings,
        }



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
            "enable_grimoire": "BOOLEAN DEFAULT FALSE NOT NULL",
            "frozen_tile": "JSON",
            "pending_effect": "JSON",
            "pending_double_target_id": "VARCHAR(36)",
            "pending_card_events": "JSON",
            "winner_id": "VARCHAR(36)",
        },
        "game_rooms": {
            "turn_time_limit": "INTEGER",
            "is_debug": "BOOLEAN DEFAULT FALSE NOT NULL",
            "enable_grimoire": "BOOLEAN DEFAULT FALSE NOT NULL",
            "game_mode": "VARCHAR(16) DEFAULT 'HP' NOT NULL",
            "max_turns": "INTEGER",
            "starting_hp": "INTEGER",
            "rematch_pin": "VARCHAR(6)",
            "max_players": "INTEGER DEFAULT 4 NOT NULL",
        },
        "game_players": {
            "hp": "INTEGER DEFAULT 100 NOT NULL",
            "max_hp": "INTEGER DEFAULT 100 NOT NULL",
            "has_shield": "BOOLEAN DEFAULT FALSE NOT NULL",
            "shield_amount": "INTEGER DEFAULT 0 NOT NULL",
            "cards": "JSON",
            "banned_letter": "VARCHAR(10)",
            "banned_until_turn": "INTEGER",
            "is_bot": "BOOLEAN DEFAULT FALSE NOT NULL",
            "bot_difficulty": "VARCHAR(16)",
        },
        "moves": {
            "rack_before": "JSON",
            "card_details": "JSON",
        },
    }

    for table_name, columns in upgrades.items():
        existing = {column["name"] for column in inspector.get_columns(table_name)}
        for column_name, column_definition in columns.items():
            if column_name not in existing:
                connection.execute(text(
                    f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
                ))

    # Expand letter column widths to support BLANK / multi-character values, and add the
    # created_at index backing the match-history listing's ORDER BY (metadata.create_all only
    # creates indexes for brand-new tables, not columns added to a table that already exists).
    for stmt in [
        "ALTER TABLE game_tiles ALTER COLUMN letter TYPE VARCHAR(10)",
        "ALTER TABLE board_cells ALTER COLUMN letter TYPE VARCHAR(10)",
        "ALTER TABLE games ALTER COLUMN banned_letter TYPE VARCHAR(10)",
        "ALTER TABLE game_players ALTER COLUMN banned_letter TYPE VARCHAR(10)",
        "CREATE INDEX IF NOT EXISTS ix_games_created_at ON games (created_at)",
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
