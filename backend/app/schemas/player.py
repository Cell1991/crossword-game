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
    max_hp: int = 100
    has_shield: bool = False
    shield_amount: int = 0
    turn_order: int
    connection_status: str
    rack_count: int = 0
    rack: Optional[list[TileSchema]] = None  # Populated only for the requesting player
    cards: Optional[list[str]] = None
    is_bot: bool = False
    bot_difficulty: Optional[str] = None
