'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getGameState, resolvePendingEffect, StoredSession } from '@/lib/api';
import { BoardCell, CardReveal, GameState, MoveHistoryEntry, PlacedTile, WebSocketEvent } from '@/lib/types';
import { useGameSocket } from './useGameSocket';
import { GameToasts } from './useGameToasts';

/** WebSocket events can be missed (reconnects, sockets blocked by a tunnel), so resync this often. */
const RESYNC_MS = 5000;

interface UseGameSyncOptions {
  gameId: string;
  session: StoredSession | null;
  hydrated: boolean;
  isDebug: boolean;
  toasts: GameToasts;
  /** Called with every fresh snapshot, in the same batch as the state update. */
  onSnapshot?: (state: GameState) => void;
}

/**
 * Keeps this device's copy of the game in step with the server: the snapshot itself, plus
 * the short-lived things only socket events carry (move history, card effects, the current
 * player's placement preview).
 */
export function useGameSync({ gameId, session, hydrated, isDebug, toasts, onSnapshot }: UseGameSyncOptions) {
  const myPlayerId = session?.playerId ?? null;
  const myToken = session?.token ?? '';
  const isSpectator = Boolean(session?.isSpectator);
  const { setError, flashInfo } = toasts;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
  const [cardUseEffects, setCardUseEffects] = useState<Record<string, string>>({});
  const [cardReveal, setCardReveal] = useState<CardReveal | null>(null);
  const [remotePlacements, setRemotePlacements] = useState<{ row: number; col: number }[]>([]);
  const [remoteBotTiles, setRemoteBotTiles] = useState<PlacedTile[]>([]);
  /** Server clock minus this device's clock. The turn timer runs on server time so every device agrees. */
  const clockOffsetRef = useRef(0);
  /** Server time when the latest snapshot arrived. */
  const [syncedAt, setSyncedAt] = useState(() => Date.now());
  /** The last snapshot applied, minus its server clock, to spot resyncs that bring nothing new. */
  const lastSnapshotRef = useRef<string | null>(null);
  const onSnapshotRef = useRef(onSnapshot);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  const loadGameState = useCallback(async () => {
    if (!myToken && !isSpectator) return;
    try {
      const state = await getGameState(gameId, myToken, isDebug);
      const serverNow = Date.parse(state.server_time);
      if (Number.isFinite(serverNow)) clockOffsetRef.current = serverNow - Date.now();
      // Most resyncs return exactly what we already show, apart from the server clock. Applying
      // them anyway re-rendered the whole screen and redrew the board every few seconds.
      // The token is part of the key: after a debug "Act as" switch the same state still has to be
      // applied, so the new player's rack gets seated.
      const snapshot = `${myToken}|${JSON.stringify({ ...state, server_time: null })}`;
      if (snapshot === lastSnapshotRef.current) return;
      lastSnapshotRef.current = snapshot;
      setGameState(state);
      if (state.move_history && Array.isArray(state.move_history)) {
        const formattedHistory: MoveHistoryEntry[] = state.move_history.map(m => {
          const isMe = m.player_id === myPlayerId;
          const pName = isMe ? 'You' : (m.display_name || 'Player');
          let text = m.text;
          if (m.type === 'move') {
            const wordsStr = (m.words || []).join(', ');
            text = wordsStr ? `${pName}: ${wordsStr}` : `${pName} placed tiles`;
          } else if (m.type === 'pass') {
            text = `${pName} passed turn`;
          } else if (m.type === 'exchange') {
            text = `${pName} swapped tiles`;
          }
          return {
            id: m.id,
            text,
            score: m.score,
            type: m.type,
            words: m.words,
            player_id: m.player_id,
            display_name: m.display_name,
            turn_number: m.turn_number,
          };
        });
        setMoveHistory(formattedHistory);
      }
      setSyncedAt(Date.now() + clockOffsetRef.current);
      onSnapshotRef.current?.(state);
      setLoading(false);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to load game state');
      setLoading(false);
    }
  }, [gameId, isSpectator, myToken, isDebug, myPlayerId, setError]);

  useEffect(() => {
    if (!hydrated || !session) return;
    const initialLoad = setTimeout(() => { void loadGameState(); }, 0);
    return () => clearTimeout(initialLoad);
  }, [hydrated, session, loadGameState]);

  /** Applies a state that did not come from loadGameState (debug tools, game-over event). */
  const replaceGameState = useCallback((update: React.SetStateAction<GameState | null>) => {
    lastSnapshotRef.current = null;
    setGameState(update);
  }, []);

  const players = gameState?.players;
  const handleSocketEvent = useCallback((event: WebSocketEvent) => {
    const nameOf = (playerId: string | undefined, fallback: string) => (
      playerId === myPlayerId ? 'You' : players?.find(player => player.id === playerId)?.display_name ?? fallback
    );
    const addHistory = (entry: Omit<MoveHistoryEntry, 'id'>) => setMoveHistory(previous => [
      ...previous,
      { id: `${Date.now()}-${Math.random()}`, ...entry },
    ]);

    switch (event.type) {
      case 'GAME_STATE_SYNC':
      case 'MOVE_COMMITTED':
      case 'TURN_PASSED':
      case 'TURN_STARTED': {
        setRemoteBotTiles([]);
        if (event.type === 'MOVE_COMMITTED' && event.payload?.boardState) {
          const newBoard = event.payload.boardState as Record<string, BoardCell>;
          replaceGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              board_state: newBoard,
              current_player_id: (event.payload.nextPlayerId as string | null | undefined) ?? prev.current_player_id,
              turn_number: (event.payload.turnNumber as number | undefined) ?? prev.turn_number,
              pending_effect: event.payload.pendingEffect !== undefined ? (event.payload.pendingEffect as any) : prev.pending_effect,
              players: prev.players.map(p => {
                if (p.id === event.payload.playerId && typeof event.payload.playerTotalScore === 'number') {
                  return { ...p, score: event.payload.playerTotalScore };
                }
                return p;
              }),
            };
          });
        }
        loadGameState();
        const wordsFormed = event.payload?.wordsFormed ?? [];
        if (event.type === 'MOVE_COMMITTED' && wordsFormed.length > 0) {
          if (event.payload.cardAwarded && event.payload.playerId) {
            const reveal = { card: event.payload.cardAwarded, playerId: event.payload.playerId };
            setCardReveal({ ...reveal, phase: 'lightning' });
            window.setTimeout(() => setCardReveal({ ...reveal, phase: 'reveal' }), 1000);
            window.setTimeout(() => setCardReveal(null), 2600);
          }
          const wordList = wordsFormed.map((word) => word.word.toUpperCase());
          const words = wordList.join(', ');
          const score = event.payload.scoreEarned ?? 0;
          const name = nameOf(event.payload?.playerId, 'Player');
          flashInfo(`${words} (+${score} pts)`);
          addHistory({ text: `${name}: ${words}`, score, type: 'move', words: wordList });
        } else if (event.type === 'TURN_PASSED') {
          const name = nameOf(event.payload?.playerId, 'Player');
          addHistory({ text: `${name} passed turn`, type: 'pass' });
        }
        break;
      }
      case 'TILES_EXCHANGED': {
        loadGameState();
        const exchangedBy = nameOf(event.payload?.playerId, 'Opponent');
        const count = event.payload?.count ?? 0;
        flashInfo(`${exchangedBy} exchanged ${count} tile${count === 1 ? '' : 's'}`);
        addHistory({ text: `${exchangedBy} swapped ${count} tiles`, type: 'exchange' });
        break;
      }
      case 'CARD_USED': {
        const playerId = event.payload?.playerId;
        const card = event.payload?.card;
        if (!playerId || !card) break;
        setCardUseEffects(previous => ({ ...previous, [playerId]: card }));
        window.setTimeout(() => {
          setCardUseEffects(previous => {
            if (previous[playerId] !== card) return previous;
            const next = { ...previous };
            delete next[playerId];
            return next;
          });
        }, 2200);
        break;
      }
      case 'PLACEMENT_PREVIEW':
        if (event.payload?.playerId !== myPlayerId) {
          setRemotePlacements(event.payload?.tiles ?? []);
        }
        break;
      case 'GAME_ENDED':
        replaceGameState(prev => prev ? { ...prev, status: 'FINISHED', winner_id: event.payload?.winnerId ?? prev.winner_id } : prev);
        // Pick up the final scores and HP too.
        loadGameState();
        break;
      case 'PLAYER_JOINED':
      case 'PLAYER_LEFT':
      case 'PLAYER_RECONNECTED':
      case 'PLAYER_DISCONNECTED':
      case 'EFFECT_PENDING':
        loadGameState();
        break;
      case 'EFFECT_RESOLVED': {
        if (event.payload?.applied && typeof event.payload.applied === 'object') {
          const applied = event.payload.applied as Record<string, number>;
          replaceGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              pending_effect: null,
              players: prev.players.map(p => {
                const dmg = applied[p.id];
                if (dmg && dmg > 0) {
                  return { ...p, hp: Math.max(0, p.hp - dmg) };
                }
                return p;
              }),
            };
          });
        }
        loadGameState();
        break;
      }
    }
  }, [flashInfo, loadGameState, myPlayerId, players, replaceGameState]);

  const { isConnected, sendMessage } = useGameSocket({
    gameId,
    token: myToken,
    spectate: isSpectator,
    debug: isDebug,
    onEvent: handleSocketEvent,
  });

  // Keep resyncing on the game-over screen too: that is where a new lobby (`rematch_pin`) shows
  // up, and where it has to disappear again once that lobby starts without us.
  useEffect(() => {
    if (gameState?.status !== 'PLAYING' && gameState?.status !== 'FINISHED') return;
    const interval = window.setInterval(() => { void loadGameState(); }, RESYNC_MS);
    return () => window.clearInterval(interval);
  }, [gameState?.status, loadGameState]);

  // A DAMAGE/SWAP effect only becomes real once someone calls the resolve endpoint — nothing on
  // the server does this on its own. Every connected client schedules the call for when the
  // SHIELD window closes; the endpoint is a no-op once another client (or a later call here)
  // already resolved it, so racing harmlessly is fine.
  const pendingEffectExpiry = gameState?.pending_effect?.expires_at ?? null;
  useEffect(() => {
    if (!pendingEffectExpiry) return;
    const msRemaining = Date.parse(pendingEffectExpiry) - (Date.now() + clockOffsetRef.current);
    const delay = Math.min(1200, Math.max(0, msRemaining));
    const timer = window.setTimeout(() => {
      void resolvePendingEffect(gameId).then(() => loadGameState()).catch(() => {});
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pendingEffectExpiry, gameId, loadGameState]);

  const clearRemotePlacements = useCallback(() => {
    setRemotePlacements([]);
    setRemoteBotTiles([]);
  }, []);

  return {
    gameState,
    setGameState: replaceGameState,
    loading,
    reload: loadGameState,
    isConnected,
    sendMessage,
    moveHistory,
    cardUseEffects,
    cardReveal,
    remotePlacements,
    remoteBotTiles,
    clearRemotePlacements,
    clockOffsetRef,
    syncedAt,
  };
}
