import {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomDetailResponse,
  GameState,
  PlacedTile,
  ValidateMoveResponse,
  CommitMoveResponse,
} from './types';

export const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  return 'http://127.0.0.1:8000/api';
};

export const getWsBase = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.hostname}:8000`;
  }
  return 'ws://127.0.0.1:8000';
};

export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000';

export interface StoredSession {
  gameId: string;
  playerId: string;
  token: string;
  displayName: string;
  isHost: boolean;
  gamePin?: string;
}

export const sessionStore = {
  save(session: StoredSession) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`crossword_session_${session.gameId}`, JSON.stringify(session));
    localStorage.setItem('crossword_last_game_id', session.gameId);
  },
  get(gameId: string): StoredSession | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(`crossword_session_${gameId}`);
    return raw ? JSON.parse(raw) : null;
  },
  getLast(): StoredSession | null {
    if (typeof window === 'undefined') return null;
    const lastId = localStorage.getItem('crossword_last_game_id');
    return lastId ? this.get(lastId) : null;
  }
};

export async function createRoom(hostName: string): Promise<CreateRoomResponse> {
  const res = await fetch(`${getApiBase()}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host_name: hostName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create room');
  }
  return res.json();
}

export async function joinRoom(gamePin: string, playerName: string): Promise<JoinRoomResponse> {
  const res = await fetch(`${getApiBase()}/rooms/${gamePin}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_pin: gamePin, player_name: playerName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to join room');
  }
  return res.json();
}

export async function getRoom(gamePin: string): Promise<RoomDetailResponse> {
  const res = await fetch(`${getApiBase()}/rooms/${gamePin}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch room');
  }
  return res.json();
}

export async function startGame(gamePin: string, hostPlayerId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/rooms/${gamePin}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Player-ID': hostPlayerId,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start game');
  }
}

export async function getGameState(gameId: string, token: string): Promise<GameState> {
  const res = await fetch(`${getApiBase()}/games/${gameId}?token=${encodeURIComponent(token)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch game state');
  }
  return res.json();
}

export async function validateMove(
  gameId: string,
  playerId: string,
  placedTiles: PlacedTile[]
): Promise<ValidateMoveResponse> {
  const res = await fetch(`${getApiBase()}/games/${gameId}/moves/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Player-ID': playerId,
    },
    body: JSON.stringify({ placed_tiles: placedTiles }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return {
      valid: false,
      reason: err.detail || 'Move validation failed',
      words_formed: [],
      estimated_score: 0,
    };
  }
  return res.json();
}

export async function commitMove(
  gameId: string,
  playerId: string,
  placedTiles: PlacedTile[]
): Promise<CommitMoveResponse> {
  const res = await fetch(`${getApiBase()}/games/${gameId}/moves`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Player-ID': playerId,
    },
    body: JSON.stringify({ placed_tiles: placedTiles }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to commit move');
  }
  return res.json();
}

export async function passTurn(gameId: string, playerId: string): Promise<any> {
  const res = await fetch(`${getApiBase()}/games/${gameId}/pass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Player-ID': playerId,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to pass turn');
  }
  return res.json();
}
