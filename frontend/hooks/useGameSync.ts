'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getGameState, resolvePendingEffect, StoredSession } from '@/lib/api';
import { BoardCell, CardReveal, GameState, MoveHistoryEntry, PlacedTile, WebSocketEvent } from '@/lib/types';
import { BoardCellEffect, SpySwapAlertData, TargetLockAlertData } from '@/components/game/CardCinematicEffects';
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
  const cardRevealQueueRef = useRef<Array<{ card: string; playerId: string }>>([]);
  const cardPhaseTimerRef = useRef<number | null>(null);
  const isRevealingRef = useRef(false);

  const showNextCardReveal = useCallback(() => {
    if (cardPhaseTimerRef.current !== null) {
      window.clearTimeout(cardPhaseTimerRef.current);
      cardPhaseTimerRef.current = null;
    }
    const next = cardRevealQueueRef.current.shift();
    if (!next) {
      isRevealingRef.current = false;
      setCardReveal(null);
      return;
    }
    isRevealingRef.current = true;
    setCardReveal({ card: next.card, playerId: next.playerId, phase: 'lightning' });
    cardPhaseTimerRef.current = window.setTimeout(() => {
      setCardReveal({ card: next.card, playerId: next.playerId, phase: 'reveal' });
      cardPhaseTimerRef.current = null;
    }, 700);
  }, []);

  const dismissCardReveal = useCallback(() => {
    // If still in charging phase, jump to reveal instead of dismissing
    if (cardPhaseTimerRef.current !== null) {
      window.clearTimeout(cardPhaseTimerRef.current);
      cardPhaseTimerRef.current = null;
      setCardReveal(prev => prev ? { ...prev, phase: 'reveal' } : null);
      return;
    }
    showNextCardReveal();
  }, [showNextCardReveal]);

  useEffect(() => {
    return () => {
      if (cardPhaseTimerRef.current !== null) {
        window.clearTimeout(cardPhaseTimerRef.current);
      }
    };
  }, []);
  const [activeCardCast, setActiveCardCast] = useState<{
    playerName: string;
    card: string;
    targetPlayerName?: string | null;
  } | null>(null);
  const [boardCellEffects, setBoardCellEffects] = useState<BoardCellEffect[]>([]);
  const [spySwapAlert, setSpySwapAlert] = useState<SpySwapAlertData | null>(null);
  const [targetLockAlert, setTargetLockAlert] = useState<TargetLockAlertData | null>(null);
  const [screenVignette, setScreenVignette] = useState<'FREEZE' | 'DESTROY' | 'HEAL' | 'DOUBLE_DAMAGE' | 'SWAP' | null>(null);

  const removeBoardCellEffect = useCallback((id: string) => {
    setBoardCellEffects(prev => prev.filter(fx => fx.id !== id));
  }, []);

  const dismissSpySwapAlert = useCallback(() => {
    setSpySwapAlert(null);
  }, []);

  const dismissTargetLockAlert = useCallback(() => {
    setTargetLockAlert(null);
  }, []);

  const clearScreenVignette = useCallback(() => {
    setScreenVignette(null);
  }, []);

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
      setGameState(prev => {
        if (!prev) return state;
        if (state.turn_number < prev.turn_number) {
          // A snapshot from before the last commit: a move writes the board and the turn number in
          // one transaction, so an older turn number means older tiles. Keep what we have.
          return prev;
        }
        // The server board replaces ours outright. Merging kept every tile we had ever drawn, so a
        // tile the server never committed (a bot preview, a race) or one DESTROY_TILE removed stayed
        // on screen until the page was reloaded.
        return state;
      });
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
        setRemotePlacements([]);
        if (event.type === 'MOVE_COMMITTED') {
          const rawBoard = (event.payload?.boardState || event.payload?.board_state || {}) as Record<string, BoardCell>;
          const placed = (event.payload?.placedTiles || []) as PlacedTile[];
          const updatedPlayers = event.payload?.players as Array<{ id: string; hp: number; score: number }> | undefined;
          const newBoard: Record<string, BoardCell> = { ...rawBoard };
          for (const pt of placed) {
            newBoard[`${pt.row}_${pt.col}`] = {
              row: pt.row,
              col: pt.col,
              letter: pt.letter,
              value: pt.value,
              player_id: (event.payload?.playerId as string) || '',
              turn_number: (event.payload?.turnNumber as number) || 0,
            };
          }
          replaceGameState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              board_state: { ...prev.board_state, ...newBoard },
              current_player_id: (event.payload?.nextPlayerId as string | null | undefined) ?? prev.current_player_id,
              turn_number: (event.payload?.turnNumber as number | undefined) ?? prev.turn_number,
              pending_effect: event.payload?.pendingEffect !== undefined ? (event.payload.pendingEffect as GameState['pending_effect']) : prev.pending_effect,
              pending_double_target_id: null,
              frozen_tile: event.payload?.frozenTile !== undefined ? (event.payload.frozenTile as GameState['frozen_tile']) : prev.frozen_tile,
              players: prev.players.map(p => {
                if (updatedPlayers) {
                  const up = updatedPlayers.find(u => u.id === p.id);
                  if (up) return {
                    ...p,
                    hp: up.hp,
                    score: up.score,
                    has_shield: (up as any).has_shield ?? p.has_shield,
                    shield_amount: (up as any).shield_amount ?? p.shield_amount,
                    cards: (up as any).cards ?? p.cards,
                  };
                }
                if (p.id === event.payload?.playerId && typeof event.payload?.playerTotalScore === 'number') {
                  return { ...p, score: event.payload.playerTotalScore };
                }
                return p;
              }),
            };
          });

          if (event.payload?.doubleDamageTargetId) {
            const doubleTargetId = event.payload.doubleDamageTargetId as string;
            const doubleTargetName = nameOf(doubleTargetId, 'Opponent');
            const isMeVictim = doubleTargetId === myPlayerId;
            const damageAmount = (event.payload.damageDealt as Record<string, number> | undefined)?.[doubleTargetId] ?? ((event.payload.scoreEarned ?? 0) * 2);
            flashInfo(`CRITICAL HIT! ${doubleTargetName} took ${damageAmount} (2×) Damage!`);
            if (isMeVictim) {
              setScreenVignette('DOUBLE_DAMAGE');
            }
          }

          // Heal resolves with the move (same timing as Double Damage) - this is the first live
          // reveal of it, so give it the same top banner the instant-use cards get.
          if (event.payload?.healedAmount) {
            const healerName = nameOf(event.payload?.playerId as string | undefined, 'Player');
            flashInfo(`${healerName} healed +${event.payload.healedAmount} HP!`);
            setActiveCardCast({ playerName: healerName, card: 'HEAL' });
            window.setTimeout(() => setActiveCardCast(null), 2500);
            setScreenVignette('HEAL');
          }

          // Shield intentionally has no live reveal when it's used - who used it (and whether it
          // blocked anything) only surfaces here, once the next move commits and "the turn" it
          // happened in is effectively over.
          const revealedEvents = Array.isArray(event.payload?.revealedCardEvents)
            ? (event.payload.revealedCardEvents as Array<Record<string, unknown>>)
            : [];
          for (const revealed of revealedEvents) {
            if (revealed?.card !== 'SHIELD') continue;
            const shielderId = revealed.player_id as string | undefined;
            const shielderName = nameOf(shielderId, (revealed.player_name as string) || 'Player');
            flashInfo(revealed.blocked ? `${shielderName} blocked an attack with Shield!` : `${shielderName} used Shield.`);
            setActiveCardCast({ playerName: shielderName, card: 'SHIELD' });
            window.setTimeout(() => setActiveCardCast(null), 2500);
          }
        }
        loadGameState();
        const wordsFormed = event.payload?.wordsFormed ?? [];
        if (event.type === 'MOVE_COMMITTED' && wordsFormed.length > 0) {
          const cardsAwarded: string[] = Array.isArray(event.payload.cardsAwarded)
            ? (event.payload.cardsAwarded as string[])
            : event.payload.cardAwarded
              ? [event.payload.cardAwarded]
              : [];

          if (cardsAwarded.length > 0 && event.payload.playerId) {
            const playerId = event.payload.playerId;
            // Only show the 3D card discovery modal to the player who actually earned the card
            if (playerId === myPlayerId) {
              const items = cardsAwarded.map((card) => ({ card, playerId }));
              const wasIdle = !isRevealingRef.current;
              cardRevealQueueRef.current.push(...items);
              if (wasIdle) {
                showNextCardReveal();
              }
            }
          }
          const wordList = wordsFormed.map((word) => word.word.toUpperCase());
          const words = wordList.join(', ');
          const score = event.payload.scoreEarned ?? 0;
          const name = nameOf(event.payload?.playerId, 'Player');
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
        // DOUBLE_DAMAGE and SHIELD never reach this case: the server deliberately broadcasts
        // GAME_STATE_SYNC for those instead, so neither the target nor the shield's user leaks
        // here - both only surface later via MOVE_COMMITTED (doubleDamageTargetId / revealedCardEvents).
        loadGameState();
        const playerId = event.payload?.playerId;
        const card = event.payload?.card;
        if (!playerId || !card) break;
        const sourceName = nameOf(playerId, playerId === myPlayerId ? 'You' : 'Player');

        setActiveCardCast({
          playerName: sourceName,
          card,
        });
        window.setTimeout(() => setActiveCardCast(null), 2500);

        // Trigger cinematic board burst & screen vignette pulses
        if (card === 'FREEZE_TILE') {
          setScreenVignette('FREEZE');
          const cells = Array.isArray(event.payload?.cells) ? (event.payload.cells as { row: number; col: number }[]) : [];
          if (cells.length > 0) {
            setBoardCellEffects(prev => [
              ...prev,
              ...cells.map(c => ({
                id: `freeze-${Date.now()}-${c.row}-${c.col}`,
                type: 'FREEZE' as const,
                row: c.row,
                col: c.col,
                timestamp: Date.now(),
              })),
            ]);
          } else {
            const row = typeof event.payload?.row === 'number' ? event.payload.row : undefined;
            const col = typeof event.payload?.col === 'number' ? event.payload.col : undefined;
            if (row !== undefined && col !== undefined) {
              setBoardCellEffects(prev => [
                ...prev,
                { id: `freeze-${Date.now()}-${Math.random()}`, type: 'FREEZE', row, col, timestamp: Date.now() },
              ]);
            }
          }
        } else if (card === 'DESTROY_TILE') {
          setScreenVignette('DESTROY');
          const row = typeof event.payload?.row === 'number' ? event.payload.row : undefined;
          const col = typeof event.payload?.col === 'number' ? event.payload.col : undefined;
          if (row !== undefined && col !== undefined) {
            setBoardCellEffects(prev => [
              ...prev,
              { id: `destroy-${Date.now()}-${Math.random()}`, type: 'DESTROY', row, col, timestamp: Date.now() },
            ]);
          }
        } else if (card === 'HEAL') {
          setScreenVignette('HEAL');
        } else if (card === 'SPY_SWAP') {
          setScreenVignette('SWAP');
        }

        setCardUseEffects(previous => ({ ...previous, [playerId]: card }));
        loadGameState();
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
          if (Array.isArray(event.payload?.botTiles)) {
            setRemoteBotTiles(event.payload.botTiles);
          }
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
        const effectType = event.payload?.type;
        if (effectType === 'SPY_SWAP' || effectType === 'SWAP') {
          const sourcePlayerId = event.payload?.sourcePlayerId as string | undefined;
          const targetPlayerId = event.payload?.targetPlayerId as string | undefined;
          const count = (event.payload?.count as number) || 1;
          if (sourcePlayerId && targetPlayerId) {
            const isVictim = targetPlayerId === myPlayerId;
            const isCaster = sourcePlayerId === myPlayerId;
            const sourcePlayerName = nameOf(sourcePlayerId, 'Player');
            const targetPlayerName = nameOf(targetPlayerId, 'Player');
            setSpySwapAlert({
              id: `${Date.now()}-${Math.random()}`,
              sourcePlayerId,
              sourcePlayerName,
              targetPlayerId,
              targetPlayerName,
              count,
              isVictim,
              isCaster,
            });
            setScreenVignette('SWAP');
          }
        }

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
    dismissCardReveal,
    activeCardCast,
    boardCellEffects,
    removeBoardCellEffect,
    spySwapAlert,
    dismissSpySwapAlert,
    targetLockAlert,
    dismissTargetLockAlert,
    screenVignette,
    clearScreenVignette,
    remotePlacements,
    remoteBotTiles,
    clearRemotePlacements,
    clockOffsetRef,
    syncedAt,
  };
}
