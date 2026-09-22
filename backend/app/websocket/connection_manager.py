from typing import Callable, Dict, Set, Any
from fastapi import WebSocket
import json

SPECTATOR_PREFIX = "spectator:"


class ConnectionManager:
    """Manages active WebSockets and room broadcasts. Spectators are keyed by `SPECTATOR_PREFIX` + a random id."""

    def __init__(self):
        # game_id -> dict of player_id -> WebSocket
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, game_id: str, player_id: str):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = {}
        self.active_connections[game_id][player_id] = websocket

    def disconnect(self, game_id: str, player_id: str, websocket: WebSocket | None = None):
        """Forget a player's socket. With `websocket`, only remove it if it is still the player's
        current socket, so an old socket closing after a reconnect does not drop the new one."""
        connections = self.active_connections.get(game_id)
        if connections is None:
            return
        if websocket is None or connections.get(player_id) is websocket:
            connections.pop(player_id, None)
        if not connections:
            self.active_connections.pop(game_id, None)

    def is_connected(self, game_id: str, player_id: str) -> bool:
        return player_id in self.active_connections.get(game_id, {})

    def spectator_count(self, game_id: str) -> int:
        return sum(1 for key in self.active_connections.get(game_id, {}) if key.startswith(SPECTATOR_PREFIX))

    async def send_personal(self, websocket: WebSocket, message: dict[str, Any]):
        await websocket.send_text(json.dumps(message))

    async def broadcast(self, game_id: str, message: dict[str, Any]):
        await self._send_to_all(game_id, lambda _player_id: message)

    async def broadcast_preview(self, game_id: str, owner_id: str, message: dict[str, Any]):
        """Send a placement preview while hiding letters from every other player."""
        tiles = message["payload"].get("tiles")
        hidden = {
            **message,
            "payload": {
                "playerId": owner_id,
                # Clients send these, so skip anything that is not a board position.
                "tiles": [
                    {"row": tile["row"], "col": tile["col"]}
                    for tile in (tiles if isinstance(tiles, list) else [])
                    if isinstance(tile, dict) and isinstance(tile.get("row"), int) and isinstance(tile.get("col"), int)
                ],
                "valid": None,
            },
        }
        await self._send_to_all(game_id, lambda player_id: message if player_id == owner_id else hidden)

    async def _send_to_all(self, game_id: str, message_for: Callable[[str], dict[str, Any]]):
        # Iterate over a snapshot: sockets connect and disconnect while we await each send.
        dead: list[tuple[str, WebSocket]] = []
        for player_id, connection in list(self.active_connections.get(game_id, {}).items()):
            try:
                await connection.send_text(json.dumps(message_for(player_id)))
            except Exception:
                dead.append((player_id, connection))
        for player_id, connection in dead:
            self.disconnect(game_id, player_id, connection)

manager = ConnectionManager()
