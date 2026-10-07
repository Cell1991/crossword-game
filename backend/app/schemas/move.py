from pydantic import BaseModel, Field
from typing import Any, Optional

from app.core.config import settings
from app.schemas.player import TileSchema

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

class CellPosition(BaseModel):
    row: int
    col: int

class CommitMoveRequest(BaseModel):
    placed_tiles: list[PlacedTileInput]
    # A single FREEZE_TILE use can target up to 3 cells total, split across these two - tiles from
    # this move itself (by tile_id) and already-committed board tiles from a prior turn (by row/col)
    # - combined freely. Both take effect atomically once the move commits.
    freeze_tile_ids: Optional[list[str]] = Field(None, max_length=3)
    freeze_board_cells: Optional[list[CellPosition]] = Field(None, max_length=3)
    use_heal: Optional[bool] = False

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
    # Card events (e.g. a reactive SHIELD block) that were held back until this move committed -
    # that is how "who used Shield" only becomes visible after the turn ends.
    revealed_card_events: list[dict[str, Any]] = []
    rack: Optional[list[TileSchema]] = None

class ExchangeTilesRequest(BaseModel):
    # No upper bound: cards such as DRAW_TILE can push a rack past RACK_SIZE.
    tile_ids: list[str] = Field(..., min_length=1)
