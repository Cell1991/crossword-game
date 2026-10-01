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
    marking them DISCONNECTED and passing their turn. Unlike leaving (OFFLINE), they stay in the
    game: a locked phone must not hand the other players a win. Reconnecting marks them ONLINE again.

    A debug-game socket (`?debug=1`) closes every time the tester's single tab switches "Acting
    as" to another clone seat — that is not a real disconnect, so it must never start the grace
    timer: otherwise the seat not currently being acted as gets marked DISCONNECTED after
    DISCONNECT_GRACE_SECONDS and next_player_after() skips it forever, stalling Pass on the other
    clone's turn.
    """
    manager.disconnect(game_id, player_id, websocket)
    if is_debug_socket:
        return
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
        return

    # If any player remains disconnected for over 3 minutes (180s), dissolve the room immediately!
    used_grace = settings.DISCONNECT_GRACE_SECONDS if grace_seconds is None else grace_seconds
    remaining_wait = max(0, 180 - used_grace)
    await asyncio.sleep(remaining_wait)
    if manager.is_connected(game_id, player_id):
        return

    async with AsyncSessionLocal() as db:
        room = await db.get(GameRoom, game_id)
        active_game = await db.get(Game, game_id)
        if room and room.status in ("WAITING", "PLAYING"):
            room.status = "ABANDONED"
            if active_game:
                active_game.status = "FINISHED"
            await db.commit()
            await manager.broadcast(game_id, WebSocketEvent(
                type=EventType.ROOM_EXPIRED,
                payload={
                    "roomId": game_id,
                    "gamePin": room.game_pin,
                    "reason": f"Room dissolved: player {player_name} was disconnected for more than 3 minutes.",
                }
            ).model_dump())
