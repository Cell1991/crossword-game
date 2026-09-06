from pydantic import BaseModel, Field
from typing import Optional

class PlacedTileInput(BaseModel):
    row: int = Field(..., ge=0, le=62)
    col: int = Field(..., ge=0, le=62)
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
