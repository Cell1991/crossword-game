from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
from datetime import datetime
from app.schemas.player import PlayerOut

class CreateRoomRequest(BaseModel):
    host_name: str = Field(..., min_length=1, max_length=32, description="Display name of the room host")
    turn_time_limit: Literal[None, 30, 60, 90, 120] = None
    game_mode: Literal["HP", "TURNS"] = "HP"
    max_turns: Optional[int] = Field(None, ge=1, le=500)

    @model_validator(mode="after")
    def validate_game_mode_settings(self):
        if self.game_mode == "TURNS" and self.max_turns is None:
            raise ValueError("max_turns is required for turn-count mode")
        if self.game_mode == "HP" and self.max_turns is not None:
            raise ValueError("max_turns is only available in turn-count mode")
        return self

class CreateRoomResponse(BaseModel):
    room_id: str
    game_id: str
    game_pin: str
    host_player_id: str
    session_token: str
    display_name: str
    turn_time_limit: Optional[int] = None
    game_mode: Literal["HP", "TURNS"]
    max_turns: Optional[int] = None

class JoinRoomRequest(BaseModel):
    game_pin: str = Field(..., min_length=6, max_length=6, description="6-digit numeric game PIN")
    player_name: str = Field(..., min_length=1, max_length=32, description="Display name of the player")

class JoinRoomResponse(BaseModel):
    game_id: str
    player_id: str
    session_token: str
    display_name: str
    is_host: bool

class RoomDetailResponse(BaseModel):
    id: str
    game_pin: str
    status: str
    host_player_id: str
    players: list[PlayerOut]
    spectator_count: int = 0
    created_at: datetime
    turn_time_limit: Optional[int] = None
    game_mode: Literal["HP", "TURNS"]
    max_turns: Optional[int] = None
