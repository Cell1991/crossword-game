'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getGameState, StoredSession } from '@/lib/api';
import { CardReveal, GameState, MoveHistoryEntry, WebSocketEvent } from '@/lib/types';
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
      setSyncedAt(Date.now() + clockOffsetRef.current);
      onSnapshotRef.current?.(state);
      setLoading(false);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to load game state');
      setLoading(false);
    }
  }, [gameId, isSpectator, myToken, isDebug, setError]);

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
        loadGameState();
        const wordsFormed = event.payload?.wordsFormed ?? [];
        if (event.type === 'MOVE_COMMITTED' && wordsFormed.length > 0) {
          if (event.payload.cardAwarded && event.payload.playerId) {
            const reveal = { card: event.payload.cardAwarded, playerId: event.payload.playerId };
            setCardReveal({ ...reveal, phase: 'lightning' });
            window.setTimeout(() => setCardReveal({ ...reveal, phase: 'reveal' }), 1000);
            window.setTimeout(() => setCardReveal(null), 2600);
          }
          const words = wordsFormed.map((word) => word.word).join(', ');
          const score = event.payload.scoreEarned ?? 0;
          const name = nameOf(event.payload?.playerId, 'Player');
          flashInfo(`${words} (+${score} pts)`);
          addHistory({ text: `${name}: ${words}`, score, type: 'move' });
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
      case 'EFFECT_RESOLVED':
        loadGameState();
        break;
    }
  }, [flashInfo, loadGameState, myPlayerId, players, replaceGameState]);

  const { isConnected, sendMessage } = useGameSocket({
    gameId,
    token: myToken,
    spectate: isSpectator,
    onEvent: handleSocketEvent,
  });

  useEffect(() => {
    if (gameState?.status !== 'PLAYING') return;
    const interval = window.setInterval(() => { void loadGameState(); }, RESYNC_MS);
    return () => window.clearInterval(interval);
  }, [gameState?.status, loadGameState]);

  const clearRemotePlacements = useCallback(() => setRemotePlacements([]), []);

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
    clearRemotePlacements,
    clockOffsetRef,
    syncedAt,
  };
}
