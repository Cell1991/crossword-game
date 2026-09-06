from typing import Dict, Set, Any
from fastapi import WebSocket
import json

class ConnectionManager:
    """Manages active WebSockets and room broadcasts."""

    def __init__(self):
        # game_id -> dict of player_id -> WebSocket
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, game_id: str, player_id: str):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = {}
        self.active_connections[game_id][player_id] = websocket

    def disconnect(self, game_id: str, player_id: str):
        if game_id in self.active_connections:
            self.active_connections[game_id].pop(player_id, None)
            if not self.active_connections[game_id]:
                self.active_connections.pop(game_id, None)

    async def send_personal(self, websocket: WebSocket, message: dict[str, Any]):
        await websocket.send_text(json.dumps(message))

    async def broadcast(self, game_id: str, message: dict[str, Any]):
        if game_id in self.active_connections:
            dead_players = []
            for player_id, connection in self.active_connections[game_id].items():
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    dead_players.append(player_id)
            
            for p_id in dead_players:
                self.disconnect(game_id, p_id)

manager = ConnectionManager()
