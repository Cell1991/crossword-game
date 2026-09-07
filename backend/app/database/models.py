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
    UniqueConstraint,
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
    turn_time_limit = Column(Integer, nullable=True)
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
    max_turns = Column(Integer, nullable=True)
    consecutive_passes = Column(Integer, default=0, nullable=False)
    # Sparse board state: {"r_c": {"row": r, "col": c, "letter": "A", "value": 1, "player_id": "...", "turn": 1}}
    board_state = Column(JSON, default=dict, nullable=False)
    tile_bag = Column(JSON, default=list, nullable=False)
    banned_letter = Column(String(1), nullable=True)
    banned_until_turn = Column(Integer, nullable=True)
    banned_by_player_id = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now)
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)
    turn_started_at = Column(DateTime(timezone=True), nullable=True)

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
    hp = Column(Integer, default=100, nullable=False)
    rack = Column(JSON, default=list, nullable=False)  # [{"id": "...", "letter": "A", "value": 1}]
    cards = Column(JSON, default=list, nullable=False)
    banned_letter = Column(String(1), nullable=True)
    banned_until_turn = Column(Integer, nullable=True)
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


class BoardCell(Base):
    """One committed tile on a game's board."""
    __tablename__ = "board_cells"
    __table_args__ = (UniqueConstraint("game_id", "row", "col", name="uq_board_cell_coordinate"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    game_id = Column(String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)
    row = Column(Integer, nullable=False)
    col = Column(Integer, nullable=False)
    letter = Column(String(1), nullable=False)
    value = Column(Integer, nullable=False)
    player_id = Column(String(36), ForeignKey("game_players.id"), nullable=False)
    turn_number = Column(Integer, nullable=False)


class GameTile(Base):
    """A tile currently in a bag or a player's rack."""
    __tablename__ = "game_tiles"

    id = Column(String(36), primary_key=True)
    game_id = Column(String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)
    player_id = Column(String(36), ForeignKey("game_players.id", ondelete="CASCADE"), nullable=True, index=True)
    location = Column(String(8), nullable=False)  # BAG or RACK
    position = Column(Integer, nullable=False)
    letter = Column(String(1), nullable=False)
    value = Column(Integer, nullable=False)


class PlayerCard(Base):
    """Cards held by a player; one row represents one card."""
    __tablename__ = "player_cards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    player_id = Column(String(36), ForeignKey("game_players.id", ondelete="CASCADE"), nullable=False, index=True)
    card_type = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)


class DictionaryWord(Base):
    """Normalized dictionary entry used by the game rules."""
    __tablename__ = "dictionary_words"

    word = Column(String(32), primary_key=True)
    word_length = Column(Integer, nullable=False, index=True)
