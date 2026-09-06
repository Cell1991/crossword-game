import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def get_utc_now():
    return datetime.now(timezone.utc)

class GameRoom(Base):
    __tablename__ = "game_rooms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_pin = Column(String(6), unique=True, index=True, nullable=False)
    host_player_id = Column(String(36), nullable=False)
    status = Column(String(32), default="WAITING", nullable=False)  # WAITING, PLAYING, FINISHED, ABANDONED
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    game = relationship("Game", back_populates="room", uselist=False, cascade="all, delete-orphan")

class Game(Base):
    __tablename__ = "games"

    id = Column(String(36), ForeignKey("game_rooms.id"), primary_key=True)
    status = Column(String(32), default="WAITING", nullable=False)  # WAITING, PLAYING, FINISHED
    current_player_id = Column(String(36), nullable=True)
    turn_number = Column(Integer, default=1, nullable=False)
    consecutive_passes = Column(Integer, default=0, nullable=False)
    # Sparse board state: {"r_c": {"row": r, "col": c, "letter": "A", "value": 1, "player_id": "...", "turn": 1}}
    board_state = Column(JSON, default=dict, nullable=False)
    tile_bag = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    room = relationship("GameRoom", back_populates="game")
    players = relationship("GamePlayer", back_populates="game", order_by="GamePlayer.turn_order", cascade="all, delete-orphan")
    moves = relationship("Move", back_populates="game", order_by="Move.turn_number", cascade="all, delete-orphan")

class GamePlayer(Base):
    __tablename__ = "game_players"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id = Column(String(36), ForeignKey("games.id"), nullable=False, index=True)
    display_name = Column(String(64), nullable=False)
    is_host = Column(Boolean, default=False, nullable=False)
    score = Column(Integer, default=0, nullable=False)
    rack = Column(JSON, default=list, nullable=False)  # [{"id": "...", "letter": "A", "value": 1}]
    turn_order = Column(Integer, default=0, nullable=False)
    connection_status = Column(String(32), default="ONLINE", nullable=False)  # ONLINE, DISCONNECTED, OFFLINE
    session_token = Column(String(128), index=True, nullable=False)
    joined_at = Column(DateTime(timezone=True), default=get_utc_now)

    game = relationship("Game", back_populates="players")
    moves = relationship("Move", back_populates="player")

class Move(Base):
    __tablename__ = "moves"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id = Column(String(36), ForeignKey("games.id"), nullable=False, index=True)
    player_id = Column(String(36), ForeignKey("game_players.id"), nullable=False, index=True)
    turn_number = Column(Integer, nullable=False)
    move_type = Column(String(32), nullable=False)  # PLACE, PASS, EXCHANGE
    placed_tiles = Column(JSON, default=list, nullable=False)  # [{"row": 31, "col": 31, "letter": "C", "value": 3}]
    words_formed = Column(JSON, default=list, nullable=False)  # [{"word": "CAT", "score": 5}]
    score_earned = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)

    game = relationship("Game", back_populates="moves")
    player = relationship("GamePlayer", back_populates="moves")
