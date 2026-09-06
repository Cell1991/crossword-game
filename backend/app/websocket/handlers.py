from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import json

from app.database.session import AsyncSessionLocal
from app.services.game_service import GameService
from app.websocket.connection_manager import manager
from app.schemas.events import WebSocketEvent, EventType

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/games/{game_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    game_id: str,
    token: str = Query(...)
):
    # Verify token
    async with AsyncSessionLocal() as db:
        player = await GameService.get_player_by_token(db, token)
        if not player or player.game_id != game_id:
            await websocket.close(code=4003, reason="Unauthorized or invalid game session")
            return

        player_id = player.id
        player_name = player.display_name

    await manager.connect(websocket, game_id, player_id)

    # Broadcast player reconnected
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.PLAYER_RECONNECTED,
        payload={
            "playerId": player_id,
            "displayName": player_name
        }
    ).model_dump())

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Handle client ping/pong heartbeat
                if msg.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
                elif msg.get("type") == EventType.PLACEMENT_PREVIEW:
                    await manager.broadcast_preview(game_id, player_id, WebSocketEvent(
                        type=EventType.PLACEMENT_PREVIEW,
                        payload={
                            "playerId": player_id,
                            "tiles": msg.get("tiles", []),
                            "valid": msg.get("valid"),
                        },
                    ).model_dump())
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(game_id, player_id)
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.PLAYER_DISCONNECTED,
            payload={
                "playerId": player_id,
                "displayName": player_name
            }
        ).model_dump())
