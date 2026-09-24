from pydantic import BaseModel, Field
from typing import Optional

from app.core.config import settings

class PlacedTileInput(BaseModel):
    row: int = Field(..., ge=0, le=settings.BOARD_ROWS - 1)
    col: int = Field(..., ge=0, le=settings.BOARD_COLS - 1)
    tile_id: str
    letter: str = Field(..., min_length=1, max_length=1)
    value: int = Field(..., ge=0)

class WordFormed(BaseModel):
    word: str
    score: int
    cells: list[tuple[int, int]]

class ValidateMoveRequest(BaseModel):
    placed_tiles: list[PlacedTileInput]

class ValidateMoveResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None
    words_formed: list[WordFormed] = []
    estimated_score: int = 0

class CommitMoveRequest(BaseModel):
    placed_tiles: list[PlacedTileInput]

class CommitMoveResponse(BaseModel):
    success: bool
    move_id: str
    turn_number: int
    words_formed: list[WordFormed]
    score_earned: int
    next_player_id: Optional[str]
    game_over: bool = False
    winner_id: Optional[str] = None
    card_awarded: Optional[str] = None

class ExchangeTilesRequest(BaseModel):
    # No upper bound: cards such as DRAW_TILE can push a rack past RACK_SIZE.
    tile_ids: list[str] = Field(..., min_length=1)
