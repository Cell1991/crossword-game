import os
from pydantic import BaseModel

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "crossword.db").replace("\\", "/")

class Settings(BaseModel):
    PROJECT_NAME: str = "Crossword Multiplayer Game API"
    API_V1_STR: str = "/api"
    
    # Database
    # Supports SQLite for local dev/testing fallback, PostgreSQL in docker/production
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite+aiosqlite:///{DEFAULT_DB_PATH}"
    )
    # Synchronous DB URL for Alembic or sync inspection if needed
    SYNC_DATABASE_URL: str = os.getenv(
        "SYNC_DATABASE_URL", 
        f"sqlite:///{DEFAULT_DB_PATH}"
    )

    # CORS - allow all origins so frontend on any port works
    CORS_ORIGINS: list[str] = ["*"]
    
    # Configurable Game Engine Settings
    BOARD_SIZE: int = 15
    CENTER_ROW: int = 7
    CENTER_COL: int = 7
    RACK_SIZE: int = 7
    MIN_PLAYERS: int = 1  # Allow solo play / testing
    MAX_PLAYERS: int = 6
    FIRST_MOVE_MUST_COVER_CENTER: bool = True
    MAX_CONSECUTIVE_PASSES: int = 4  # 2 passes per player in 2-player game
    TURN_TIMER_SECONDS: int = 0      # 0 means timer disabled by default

settings = Settings()
