export interface Tile {
  id: string;
  letter: string;
  value: number;
}

export interface PlacedTile {
  row: number;
  col: number;
  tile_id: string;
  letter: string;
  value: number;
}

export interface BoardCell {
  row: number;
  col: number;
  letter: string;
  value: number;
  player_id: string;
  turn_number: number;
}

export interface Player {
  id: string;
  display_name: string;
  is_host: boolean;
  score: number;
  hp: number;
  max_hp?: number;
  has_shield?: boolean;
  turn_order: number;
  connection_status: 'ONLINE' | 'DISCONNECTED' | 'OFFLINE';
  rack_count: number;
  rack?: Tile[];
  cards?: string[] | null;
}

export interface GameState {
  game_id: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  current_player_id: string | null;
  turn_number: number;
  consecutive_passes: number;
  board_state: Record<string, BoardCell>;
  players: Player[];
  tile_bag_count: number;
  tile_bag_counts: Record<string, number>;
  turn_time_limit: TurnTimeLimit;
  turn_started_at: string | null;
  max_turns: number | null;
  starting_hp?: number | null;
  pending_effect: PendingEffect | null;
  frozen_tile: { row: number; col: number; set_by: string; expires_turn: number } | null;
  /** True when this game's room was created with debug mode on: every player in it gets it. */
  is_debug: boolean;
  winner_id: string | null;
  /** The server's clock when this snapshot was taken; the turn timer runs on it. */
  server_time: string;
  game_pin: string | null;
  /** Once the game is over: the PIN of the lobby its players are gathering in for another round. */
  rematch_pin: string | null;
  spectator_count: number;
  move_history?: MoveHistoryEntry[];
}

/** A DAMAGE/SWAP effect waiting out its SHIELD window. SWAP tile letters are only
 * present for the two players involved (see GameService._visible_pending_effect). */
export interface PendingEffect {
  type: 'DAMAGE' | 'SWAP' | 'SPY_SWAP';
  expires_at: string;
  source_player_id?: string;
  target_player_id?: string;
  damage?: Record<string, number>;
  own_tile?: Tile;
  target_tile?: Tile;
}

export type TurnTimeLimit = null | 30 | 60 | 90 | 120;
export type GameMode = 'HP' | 'TURNS';

export interface WordDefinitionMeaning {
  partOfSpeech: string;
  definitions: string[];
  example?: string;
}

export interface WordDefinition {
  word: string;
  phonetic?: string | null;
  found: boolean;
  meanings: WordDefinitionMeaning[];
}

/** One line of the sidebar's move history, built on this device from socket events or fetched on reload. */
export interface MoveHistoryEntry {
  id: string;
  text: string;
  timestamp?: string;
  score?: number;
  type?: 'move' | 'exchange' | 'pass' | 'card';
  words?: string[];
  player_id?: string;
  display_name?: string;
  turn_number?: number;
}

export type BoardCard = 'FREEZE_TILE' | 'DESTROY_TILE';

/** The earned-card animation: a lightning flash, then the card face. */
export interface CardReveal {
  card: string;
  playerId: string;
  phase: 'lightning' | 'reveal';
}

export interface CellPosition {
  row: number;
  col: number;
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HintTile {
  row: number;
  col: number;
  letter: string;
  value: number;
}

export interface HintSuggestion {
  word: string;
  score: number;
  direction: 'across' | 'down';
  tiles: HintTile[];
  bingo_bonus?: number;
}

/** Mirrors backend MoveService.CARD_TYPES (backend/app/services/move_service.py). */
export const CARD_TYPES = [
  'HINT', 'SPY_SWAP', 'DESTROY_TILE', 'HEAL', 'DOUBLE_DAMAGE', 'SHIELD', 'FREEZE_TILE',
] as const;

export interface WordFormed {
  word: string;
  score: number;
  cells: [number, number][];
}

export interface ValidateMoveResponse {
  valid: boolean;
  reason?: string | null;
  words_formed: WordFormed[];
  estimated_score: number;
  bingo_bonus?: number;
}

export interface CommitMoveResponse {
  success: boolean;
  move_id: string;
  turn_number: number;
  words_formed: WordFormed[];
  score_earned: number;
  bingo_bonus?: number;
  next_player_id?: string | null;
  game_over?: boolean;
  winner_id?: string | null;
  card_awarded?: string | null;
}

export interface CreateRoomResponse {
  room_id: string;
  game_id: string;
  game_pin: string;
  host_player_id: string;
  session_token: string;
  display_name: string;
  turn_time_limit: TurnTimeLimit;
  game_mode: GameMode;
  max_turns: number | null;
  starting_hp?: number | null;
  max_players?: number;
  created_at?: string;
}

export interface JoinRoomResponse {
  game_id: string;
  player_id: string;
  session_token: string;
  display_name: string;
  is_host: boolean;
  game_pin?: string;
  host_player_id?: string;
  turn_time_limit?: TurnTimeLimit;
  game_mode?: GameMode;
  max_turns?: number | null;
  starting_hp?: number | null;
  max_players?: number;
  created_at?: string;
}

export interface RematchResponse extends JoinRoomResponse {
  game_pin: string;
  /** True for the player who opened the new lobby, false for players who joined it. */
  created: boolean;
}

export interface RoomDetailResponse {
  id: string;
  game_pin: string;
  status: string;
  host_player_id: string;
  players: Player[];
  spectator_count: number;
  created_at: string;
  turn_time_limit: TurnTimeLimit;
  game_mode: GameMode;
  max_turns: number | null;
  starting_hp?: number | null;
  max_players?: number;
  is_debug: boolean;
}

export interface RoomSummary {
  id: string;
  game_pin: string;
  status: string;
  host_name: string;
  player_count: number;
  max_players: number;
  turn_time_limit: TurnTimeLimit;
  game_mode: GameMode;
  max_turns: number | null;
  starting_hp?: number | null;
  is_debug: boolean;
  created_at: string;
}

export interface ExchangeTilesResponse {
  /** `passed` when more tiles were requested than the bag holds (rules §5). */
  status: 'exchanged' | 'passed';
  exchanged_count: number;
  next_player_id: string | null;
  turn_number: number;
  game_over: boolean;
  winner_id: string | null;
}

export type WebSocketEventType =
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PLAYER_RECONNECTED'
  | 'PLAYER_DISCONNECTED'
  | 'GAME_STARTED'
  | 'TURN_STARTED'
  | 'MOVE_COMMITTED'
  | 'TURN_PASSED'
  | 'TILES_EXCHANGED'
  | 'GAME_STATE_SYNC'
  | 'GAME_ENDED'
  | 'ERROR'
  | 'PLACEMENT_PREVIEW'
  | 'EFFECT_PENDING'
  | 'EFFECT_RESOLVED'
  | 'CARD_USED'
  | 'REMATCH_CREATED'
  | 'ROOM_EXPIRED';

export interface WebSocketEvent {
  type: WebSocketEventType;
  payload: {
    playerId?: string;
    tiles?: { row: number; col: number }[];
    /** MOVE_COMMITTED */
    wordsFormed?: WordFormed[];
    scoreEarned?: number;
    /** TILES_EXCHANGED: how many tiles went back to the bag. The letters themselves stay private. */
    count?: number;
    /** GAME_ENDED */
    winnerId?: string | null;
    /** CARD_USED */
    card?: string;
    /** MOVE_COMMITTED: the private-card reveal animation follows this event. */
    cardAwarded?: string | null;
    /** EFFECT_RESOLVED: HP damage applied per player */
    applied?: Record<string, number>;
    [key: string]: unknown;
  };
  timestamp: string;
}
