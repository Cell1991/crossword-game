from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.schemas.player import PlayerOut

class CreateRoomRequest(BaseModel):
    host_name: str = Field(..., min_length=1, max_length=32, description="Display name of the room host")

class CreateRoomResponse(BaseModel):
    room_id: str
    game_id: str
    game_pin: str
    host_player_id: str
    session_token: str
    display_name: str

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
    created_at: datetime
