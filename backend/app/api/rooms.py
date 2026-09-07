from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.schemas.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    JoinRoomRequest,
    JoinRoomResponse,
    RoomDetailResponse
)
from app.schemas.player import PlayerOut
from app.schemas.events import WebSocketEvent, EventType
from app.services.room_service import RoomService
from app.websocket.connection_manager import manager
from app.database.state import player_rack

router = APIRouter(prefix="/rooms", tags=["Rooms"])

@router.post("", response_model=CreateRoomResponse)
async def create_room(req: CreateRoomRequest, db: AsyncSession = Depends(get_db)):
    room, game, host = await RoomService.create_room(db, req.host_name, req.turn_time_limit)
    return CreateRoomResponse(
        room_id=room.id,
        game_id=game.id,
        game_pin=room.game_pin,
        host_player_id=host.id,
        session_token=host.session_token,
        display_name=host.display_name,
        turn_time_limit=room.turn_time_limit
    )

@router.post("/{game_pin}/join", response_model=JoinRoomResponse)
async def join_room(game_pin: str, req: JoinRoomRequest, db: AsyncSession = Depends(get_db)):
    room, game, player = await RoomService.join_room(db, game_pin, req.player_name)
    
    # Broadcast PLAYER_JOINED to WebSocket subscribers
    await manager.broadcast(room.id, WebSocketEvent(
        type=EventType.PLAYER_JOINED,
        payload={
            "playerId": player.id,
            "displayName": player.display_name,
            "isHost": player.is_host,
            "turnOrder": player.turn_order
        }
    ).model_dump())

    return JoinRoomResponse(
        game_id=game.id,
        player_id=player.id,
        session_token=player.session_token,
        display_name=player.display_name,
        is_host=player.is_host
    )

@router.get("/{game_pin}", response_model=RoomDetailResponse)
async def get_room(game_pin: str, db: AsyncSession = Depends(get_db)):
    room, players = await RoomService.get_room_details(db, game_pin)
    player_outs = [
        PlayerOut(
            id=p.id,
            display_name=p.display_name,
            is_host=p.is_host,
            score=p.score,
            turn_order=p.turn_order,
            connection_status=p.connection_status,
            rack_count=len(await player_rack(db, p.id))
        )
        for p in players
    ]
    return RoomDetailResponse(
        id=room.id,
        game_pin=room.game_pin,
        status=room.status,
        host_player_id=room.host_player_id,
        players=player_outs,
        created_at=room.created_at,
        turn_time_limit=room.turn_time_limit
    )

@router.post("/{game_pin}/start")
async def start_game(
    game_pin: str,
    x_player_id: str = Header(..., alias="X-Player-ID"),
    db: AsyncSession = Depends(get_db)
):
    room, _ = await RoomService.get_room_details(db, game_pin)
    game = await RoomService.start_game(db, room.id, x_player_id)

    # Broadcast GAME_STARTED event
    await manager.broadcast(room.id, WebSocketEvent(
        type=EventType.GAME_STARTED,
        payload={
            "gameId": game.id,
            "currentPlayerId": game.current_player_id,
            "turnNumber": game.turn_number
        }
    ).model_dump())

    return {"status": "started", "game_id": game.id}
