from pydantic import BaseModel
from typing import Optional, Any
from app.schemas.player import PlayerOut

class BoardCellOut(BaseModel):
    row: int
    col: int
    letter: str
    value: int
    player_id: str
    turn_number: int

class GameStateResponse(BaseModel):
    game_id: str
    status: str
    current_player_id: Optional[str]
    turn_number: int
    consecutive_passes: int
    board_state: dict[str, Any]  # Sparse {"r_c": {...}}
    players: list[PlayerOut]
    tile_bag_count: int
