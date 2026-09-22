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
  turn_time_limit: TurnTimeLimit;
  turn_started_at: string | null;
  max_turns: number | null;
  winner_id: string | null;
  /** The server's clock when this snapshot was taken; the turn timer runs on it. */
  server_time: string;
}

export type TurnTimeLimit = null | 30 | 60 | 90 | 120;

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
}

export interface CommitMoveResponse {
  success: boolean;
  move_id: string;
  turn_number: number;
  words_formed: WordFormed[];
  score_earned: number;
  next_player_id?: string | null;
  game_over: boolean;
  winner_id?: string | null;
}

export interface CreateRoomResponse {
  room_id: string;
  game_id: string;
  game_pin: string;
  host_player_id: string;
  session_token: string;
  display_name: string;
  turn_time_limit: TurnTimeLimit;
}

export interface JoinRoomResponse {
  game_id: string;
  player_id: string;
  session_token: string;
  display_name: string;
  is_host: boolean;
}

export interface RoomDetailResponse {
  id: string;
  game_pin: string;
  status: string;
  host_player_id: string;
  players: Player[];
  created_at: string;
  turn_time_limit: TurnTimeLimit;
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
  | 'PLACEMENT_PREVIEW';

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
  };
  timestamp: string;
}
