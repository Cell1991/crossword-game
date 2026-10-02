import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.config import settings
from app.database.models import Game, GameRoom
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
    debug: bool = Query(False),
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
        if player.hp > 0 and player.connection_status != "OFFLINE":
            player.connection_status = "ONLINE"
        # The room, not the caller's own `debug` query param, decides whether this socket may skip
        # disconnect-grace handling — otherwise any player in a real game could tack `&debug=1` onto
        # their own connection to make themselves immune to ever being marked disconnected.
        room = await db.get(GameRoom, game_id)
        is_debug_room = bool(room and room.is_debug)
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
                            "botTiles": msg.get("botTiles"),
                        },
                    ).model_dump())
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await handle_disconnect(
            websocket, game_id, player_id, player_name,
            is_debug_socket=debug and settings.DEBUG_MODE and is_debug_room,
        )


async def spectate_game(websocket: WebSocket, game_id: str) -> None:
    """Watch a game: receive every event (placement previews without letters) but never act or hold a seat."""
    async with AsyncSessionLocal() as db:
        game = await db.get(Game, game_id)
    if not game:
        await websocket.close(code=4004, reason="Game not found")
        return

    if manager.spectator_count(game_id) >= settings.MAX_SPECTATORS:
        await websocket.close(
            code=4005,
            reason="Spectator gallery is full for this room."
        )
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
    is_debug_socket: bool = False,
) -> None:
    """
    A dropped socket is often just a page refresh. Give the player time to reconnect before
    marking them DISCONNECTED and passing their turn.

    If a player remains disconnected or backgrounds their app for more than 2 minutes (120s),
    they are counted as dead (hp = 0, OFFLINE/eliminated).
    """
    manager.disconnect(game_id, player_id, websocket)
    if is_debug_socket:
        return

    # Schedule the 2-minute elimination timer upon disconnect
    if grace_seconds is None:
        asyncio.create_task(
            _schedule_player_disconnect_elimination(
                game_id, player_id, player_name, delay=settings.DISCONNECT_ELIMINATE_SECONDS
            )
        )

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


async def _schedule_player_disconnect_elimination(
    game_id: str,
    player_id: str,
    player_name: str,
    delay: float = 120.0,
) -> None:
    """If a player remains disconnected for 2 minutes (120s), eliminate them (HP = 0, OFFLINE)."""
    try:
        await asyncio.sleep(delay)
        if manager.is_connected(game_id, player_id):
            return

        async with AsyncSessionLocal() as db:
            game, game_over, reason, winner_id = await GameService.eliminate_disconnected_player(
                db, game_id, player_id
            )
            await db.commit()

        if game:
            await manager.broadcast(game_id, WebSocketEvent(
                type=EventType.GAME_STATE_SYNC,
                payload={
                    "playerId": player_id,
                    "displayName": player_name,
                    "eliminated": True,
                    "reason": f"Player {player_name} was eliminated after 2 minutes of disconnection.",
                    "nextPlayerId": game.current_player_id,
                    "turnNumber": game.turn_number,
                }
            ).model_dump())
            if game_over:
                await manager.broadcast(game_id, WebSocketEvent(
                    type=EventType.GAME_ENDED,
                    payload={"reason": reason or "PLAYER_ELIMINATED", "winnerId": winner_id},
                ).model_dump())
    except asyncio.CancelledError:
        pass
    except Exception:
        pass
