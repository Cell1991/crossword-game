from pydantic import BaseModel, Field
from typing import Optional

class TileSchema(BaseModel):
    id: str
    letter: str
    value: int

class PlayerOut(BaseModel):
    id: str
    display_name: str
    is_host: bool
    score: int
    hp: int = 100
    turn_order: int
    connection_status: str
    rack_count: int = 0
    rack: Optional[list[TileSchema]] = None  # Populated only for the requesting player
    cards: Optional[list[str]] = None
