import asyncio
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database.session import init_db, AsyncSessionLocal
from app.services.room_service import RoomService
from app.api import rooms, games, moves, cards, debug, dictionary
from app.websocket import handlers

# Global tracker for 7-day inactivity sleep
last_user_activity = datetime.now()

async def cleanup_expired_rooms_loop():
    while True:
        try:
            await asyncio.sleep(20)
            async with AsyncSessionLocal() as db:
                expired = await RoomService.expire_inactive_rooms(db, timeout_minutes=settings.ROOM_EXPIRY_MINUTES)
                if expired:
                    await db.commit()
        except asyncio.CancelledError:
            break
        except Exception:
            pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    cleanup_task = asyncio.create_task(cleanup_expired_rooms_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

@app.middleware("http")
async def track_user_activity(request: Request, call_next):
    global last_user_activity
    path = request.url.path
    if not path.endswith("/api/ping") and not path.endswith("/health"):
        last_user_activity = datetime.now()
    response = await call_next(request)
    return response

# CORS configuration - allow any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API and WebSocket routers under both /api and /
app.include_router(rooms.router, prefix=settings.API_V1_STR)
app.include_router(rooms.router)
app.include_router(games.router, prefix=settings.API_V1_STR)
app.include_router(games.router)
app.include_router(moves.router, prefix=settings.API_V1_STR)
app.include_router(moves.router)
app.include_router(cards.router, prefix=settings.API_V1_STR)
app.include_router(cards.router)
app.include_router(dictionary.router, prefix=settings.API_V1_STR)
app.include_router(dictionary.router)
app.include_router(debug.router, prefix=settings.API_V1_STR)
app.include_router(debug.router)
app.include_router(handlers.router)

@app.get("/")
def root():
    return {"message": "Crossword Multiplayer Game API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/ping")
def ping_keep_alive():
    global last_user_activity
    # If no real user activity for 7 days, return 503 so Render auto-sleeps
    if datetime.now() - last_user_activity > timedelta(days=7):
        return Response(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content="Server sleeping due to 7 days of inactivity")
    return {"status": "ok", "last_user_activity": last_user_activity.isoformat()}
