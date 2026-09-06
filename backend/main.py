from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database.session import init_db
from app.api import rooms, games, moves, cards
from app.websocket import handlers

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

# CORS configuration - allow any origin (dev mode)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API and WebSocket routers
app.include_router(rooms.router, prefix=settings.API_V1_STR)
app.include_router(games.router, prefix=settings.API_V1_STR)
app.include_router(moves.router, prefix=settings.API_V1_STR)
app.include_router(cards.router, prefix=settings.API_V1_STR)
app.include_router(handlers.router)

@app.get("/")
def root():
    return {"message": "Crossword Multiplayer Game API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}
