from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime, timezone

def get_iso_now():
    return datetime.now(timezone.utc).isoformat()

class WebSocketEvent(BaseModel):
    type: str
    payload: dict[str, Any]
    timestamp: str = get_iso_now()

# Event types constants
class EventType:
    PLAYER_JOINED = "PLAYER_JOINED"
    PLAYER_LEFT = "PLAYER_LEFT"
    PLAYER_RECONNECTED = "PLAYER_RECONNECTED"
    PLAYER_DISCONNECTED = "PLAYER_DISCONNECTED"
    GAME_STARTED = "GAME_STARTED"
    TURN_STARTED = "TURN_STARTED"
    MOVE_COMMITTED = "MOVE_COMMITTED"
    TURN_PASSED = "TURN_PASSED"
    GAME_STATE_SYNC = "GAME_STATE_SYNC"
    GAME_ENDED = "GAME_ENDED"
    ERROR = "ERROR"
    PLACEMENT_PREVIEW = "PLACEMENT_PREVIEW"
