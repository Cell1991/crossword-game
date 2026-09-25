import {
  CreateRoomResponse,
  JoinRoomResponse,
  RoomDetailResponse,
  GameState,
  PlacedTile,
  ValidateMoveResponse,
  CommitMoveResponse,
  ExchangeTilesResponse,
  TurnTimeLimit,
} from './types';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error;
  if (Array.isArray(error)) {
    return error.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'msg' in item) return String(item.msg);
      return JSON.stringify(item);
    }).join('; ');
  }
  if (error && typeof error === 'object' && 'detail' in error) {
    return getErrorMessage(error.detail, fallback);
  }
  return fallback;
}

export const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    // Use the frontend origin so public tunnels do not expose a private backend port.
    return '/api';
  }
  return 'http://127.0.0.1:8000/api';
};

export const getWsBase = () => {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${window.location.host}`;
  }
  return 'ws://127.0.0.1:8000';
};

export interface StoredSession {
  gameId: string;
  playerId: string;
  token: string;
  displayName: string;
  isHost: boolean;
  gamePin?: string;
  /** Watching only: no seat, no token, no rack. */
  isSpectator?: boolean;
}

export const sessionStore = {
  save(session: StoredSession) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(`crossword_session_${session.gameId}`, JSON.stringify(session));
    sessionStorage.setItem('crossword_last_game_id', session.gameId);
  },
  get(gameId: string): StoredSession | null {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(`crossword_session_${gameId}`);
    return raw ? JSON.parse(raw) : null;
  },
  getLast(): StoredSession | null {
    if (typeof window === 'undefined') return null;
    const lastId = sessionStorage.getItem('crossword_last_game_id');
    return lastId ? this.get(lastId) : null;
  }
};

/** Debug mode controls several clone players from one browser tab, so it keeps the whole
 * roster (not just one active session) around for the player switcher in DebugPanel. */
export const debugSessionStore = {
  save(gameId: string, sessions: StoredSession[]) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(`crossword_debug_${gameId}`, JSON.stringify(sessions));
  },
  get(gameId: string): StoredSession[] {
    if (typeof window === 'undefined') return [];
    const raw = sessionStorage.getItem(`crossword_debug_${gameId}`);
    return raw ? JSON.parse(raw) : [];
  },
};

export async function createRoom(hostName: string, turnTimeLimit: TurnTimeLimit = null): Promise<CreateRoomResponse> {
  const res = await fetch(`${getApiBase()}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host_name: hostName, turn_time_limit: turnTimeLimit }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create room');
  }
  return res.json();
}

export async function expireTurn(gameId: string): Promise<{ expired: boolean }> {
  const res = await fetch(`${getApiBase()}/games/${gameId}/timeout`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to check turn timeout');
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

/** Gives up a seat in a room that has not started yet. A leaving host hands the room to the next player. */
export async function leaveRoom(gamePin: string, playerId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/rooms/${gamePin}/leave`, {
    method: 'POST',
    headers: { 'X-Player-ID': playerId },
    keepalive: true,
  });
  if (!res.ok) throw new Error('Failed to leave room');
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

export async function getGameState(gameId: string, token: string, debug = false): Promise<GameState> {
  const debugParam = debug ? '&debug=true' : '';
  const res = await fetch(`${getApiBase()}/games/${gameId}?token=${encodeURIComponent(token)}${debugParam}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch game state');
  }
  return res.json();
}

/** Debug-only: freely set a player's HP (clamped to >= 0 server-side) to test HP-driven bugs. */
export async function debugSetHp(gameId: string, playerId: string, hp: number): Promise<GameState> {
  const res = await fetch(`${getApiBase()}/debug/games/${gameId}/players/${playerId}/hp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hp }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to set HP');
  }
  return res.json();
}

/** Debug-only: overwrite the letter of one rack slot, keeping the tile's id and re-deriving its value. */
export async function debugSetRackTile(gameId: string, playerId: string, slot: number, letter: string): Promise<GameState> {
  const res = await fetch(`${getApiBase()}/debug/games/${gameId}/players/${playerId}/rack-tile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot, letter }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to set rack tile');
  }
  return res.json();
}

/** Debug-only: grant a specific power card into a player's hand, bypassing the normal random SECRET_POWER drop. */
export async function debugGrantCard(gameId: string, playerId: string, card: string): Promise<GameState> {
  const res = await fetch(`${getApiBase()}/debug/games/${gameId}/players/${playerId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to grant card');
  }
  return res.json();
}

export async function validateMove(
  gameId: string,
  playerId: string,
  placedTiles: PlacedTile[]
): Promise<ValidateMoveResponse> {
  try {
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
        reason: getErrorMessage(err, 'Move validation failed'),
        words_formed: [],
        estimated_score: 0,
      };
    }
    return res.json();
  } catch {
    return {
      valid: false,
      reason: 'Move validation unavailable',
      words_formed: [],
      estimated_score: 0,
    };
  }
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
    throw new Error(getErrorMessage(err, 'Failed to commit move'));
  }
  return res.json();
}

export async function passTurn(gameId: string, playerId: string): Promise<unknown> {
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

/** Swaps the given rack tiles for fresh ones from the bag. This uses up the player's turn. */
export async function exchangeTiles(
  gameId: string,
  playerId: string,
  tileIds: string[]
): Promise<ExchangeTilesResponse> {
  const res = await fetch(`${getApiBase()}/games/${gameId}/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Player-ID': playerId,
    },
    body: JSON.stringify({ tile_ids: tileIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(err, 'Failed to exchange tiles'));
  }
  return res.json();
}

export interface UseCardPayload {
  card: string;
  target_player_id?: string;
  letter?: string;
  row?: number;
  col?: number;
  own_tile_id?: string;
  target_tile_id?: string;
  placed_tiles?: PlacedTile[];
}

export async function playCard(gameId: string, playerId: string, payload: UseCardPayload): Promise<Record<string, unknown>> {
  const res = await fetch(`${getApiBase()}/games/${gameId}/cards/use`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Player-ID': playerId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(err, 'Failed to use card'));
  }
  return res.json();
}

/** Applies a pending DAMAGE/SWAP effect once its SHIELD window has passed; a no-op if it's still open. */
export async function resolvePendingEffect(gameId: string): Promise<{ status: string }> {
  const res = await fetch(`${getApiBase()}/games/${gameId}/effects/resolve`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to resolve pending effect');
  return res.json();
}

export async function leaveGame(gameId: string, playerId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/games/${gameId}/leave`, {
    method: 'POST',
    headers: { 'X-Player-ID': playerId },
    keepalive: true,
  });
  if (!res.ok) throw new Error('Failed to leave game');
}
