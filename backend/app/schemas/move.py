from pydantic import BaseModel, Field
from typing import Optional

from app.core.config import settings

class PlacedTileInput(BaseModel):
    row: int
    col: int
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
    bingo_bonus: int = 0

class CommitMoveRequest(BaseModel):
    placed_tiles: list[PlacedTileInput]
    # A FREEZE_TILE card played on one of these placed tiles: freezes it once the move commits,
    # in the same turn (rather than needing an already-committed tile from a prior turn).
    freeze_tile_id: Optional[str] = None
    use_heal: Optional[bool] = False
    use_shield: Optional[bool] = False

class CommitMoveResponse(BaseModel):
    success: bool
    move_id: str
    turn_number: int
    words_formed: list[WordFormed]
    score_earned: int
    bingo_bonus: int = 0
    next_player_id: Optional[str]
    game_over: bool = False
    winner_id: Optional[str] = None
    card_awarded: Optional[str] = None
    cards_awarded: list[str] = []
    damage_dealt: Optional[dict[str, int]] = None
    double_damage_target_id: Optional[str] = None
    healed_amount: Optional[int] = None
    shield_awarded: Optional[int] = None

class ExchangeTilesRequest(BaseModel):
    # No upper bound: cards such as DRAW_TILE can push a rack past RACK_SIZE.
    tile_ids: list[str] = Field(..., min_length=1)
