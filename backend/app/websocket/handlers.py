import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.config import settings
from app.database.models import Game
from app.database.session import AsyncSessionLocal
from app.services.game_service import GameService
from app.websocket.connection_manager import SPECTATOR_PREFIX, manager
from app.schemas.events import WebSocketEvent, EventType

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/games/{game_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    game_id: str,
    token: Optional[str] = Query(None),
    spectate: bool = Query(False),
):
    if spectate and not token:
        await spectate_game(websocket, game_id)
        return

    # Verify token
    async with AsyncSessionLocal() as db:
        player = await GameService.get_player_by_token(db, token) if token else None
        if not player or player.game_id != game_id:
            await websocket.close(code=4003, reason="Unauthorized or invalid game session")
            return

        player_id = player.id
        player_name = player.display_name
        player.connection_status = "ONLINE"
        await db.commit()

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
                if not isinstance(msg, dict):
                    continue
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
        await handle_disconnect(websocket, game_id, player_id, player_name)


async def spectate_game(websocket: WebSocket, game_id: str) -> None:
    """Watch a game: receive every event (placement previews without letters) but never act or hold a seat."""
    async with AsyncSessionLocal() as db:
        game = await db.get(Game, game_id)
    if not game:
        await websocket.close(code=4004, reason="Game not found")
        return

    connection_id = f"{SPECTATOR_PREFIX}{uuid.uuid4()}"
    await manager.connect(websocket, game_id, connection_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue
            # Spectators only keep the connection alive; anything else they send is ignored.
            if isinstance(msg, dict) and msg.get("type") == "PING":
                await websocket.send_text(json.dumps({"type": "PONG"}))
    except WebSocketDisconnect:
        manager.disconnect(game_id, connection_id, websocket)


async def handle_disconnect(
    websocket: WebSocket,
    game_id: str,
    player_id: str,
    player_name: str,
    grace_seconds: float | None = None,
) -> None:
    """
    A dropped socket is often just a page refresh. Give the player time to reconnect before
    marking them DISCONNECTED and passing their turn. Unlike leaving (OFFLINE), they stay in the
    game: a locked phone must not hand the other players a win. Reconnecting marks them ONLINE again.
    """
    manager.disconnect(game_id, player_id, websocket)
    await asyncio.sleep(settings.DISCONNECT_GRACE_SECONDS if grace_seconds is None else grace_seconds)
    if manager.is_connected(game_id, player_id):
        return

    async with AsyncSessionLocal() as db:
        try:
            game, game_over, reason, winner_id = await GameService.leave_game(
                db, game_id, player_id, status="DISCONNECTED"
            )
            await db.commit()
        except Exception:
            game = None
            game_over = False
            reason = None
            winner_id = None
    await manager.broadcast(game_id, WebSocketEvent(
        type=EventType.PLAYER_DISCONNECTED,
        payload={
            "playerId": player_id,
            "displayName": player_name
        }
    ).model_dump())
    if game and game_over:
        await manager.broadcast(game_id, WebSocketEvent(
            type=EventType.GAME_ENDED,
            payload={"reason": reason or "PLAYER_DISCONNECTED", "winnerId": winner_id},
        ).model_dump())
