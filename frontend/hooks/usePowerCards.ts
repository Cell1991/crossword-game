'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { playCard, UseCardPayload } from '@/lib/api';
import { BoardCard, BoardCell, CellPosition, HintSuggestion, PlacedTile } from '@/lib/types';
import { isCellCommitted } from '@/lib/tiles';
import { GameToasts } from './useGameToasts';

/** How long the HINT card's suggested cell stays highlighted. */
const HINT_HIGHLIGHT_MS = 15000;

interface UsePowerCardsOptions {
  gameId: string;
  myPlayerId: string | null;
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  reload: () => Promise<void>;
  toasts: GameToasts;
}

/** Playing power cards: one request at a time, then a fresh snapshot. */
export function usePowerCards({ gameId, myPlayerId, boardState, temporaryTiles, reload, toasts }: UsePowerCardsOptions) {
  const { flashError, flashInfo } = toasts;
  const [armedCard, setArmedCard] = useState<BoardCard | null>(null);
  const [pendingArmedCell, setPendingArmedCell] = useState<CellPosition | null>(null);
  // FREEZE_TILE marked on a tile placed this turn (not yet committed): applied atomically with
  // Confirm Move (see commitMove's freezeTileId). Recalling that tile clears it below - that
  // recall *is* the cancel, so no extra confirmation step is needed for this path.
  const [deferredFreezeTileId, setDeferredFreezeTileId] = useState<string | null>(null);
  const [hintCell, setHintCell] = useState<CellPosition | null>(null);
  const [hintSuggestions, setHintSuggestions] = useState<HintSuggestion[]>([]);
  const [activeHintIndex, setActiveHintIndex] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const hasLoadedFromStorageRef = useRef(false);

  const activeDeferredFreezeTileId = deferredFreezeTileId && temporaryTiles.some(t => t.tile_id === deferredFreezeTileId)
    ? deferredFreezeTileId
    : null;

  // Load persisted hints when player ID and game ID become available
  useEffect(() => {
    if (typeof window === 'undefined' || !gameId || !myPlayerId) return;
    if (hasLoadedFromStorageRef.current) return;
    try {
      const key = `crossword_hint_${gameId}_${myPlayerId}`;
      const stored = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
          const activeIdx = typeof parsed.activeIndex === 'number' ? parsed.activeIndex : 0;
          const firstTile = parsed.suggestions[activeIdx]?.tiles?.[0];
          startTransition(() => {
            setHintSuggestions(parsed.suggestions);
            setActiveHintIndex(activeIdx);
            setHintCell(firstTile ? { row: firstTile.row, col: firstTile.col } : null);
          });
        }
      }
    } catch {
      // ignore
    } finally {
      hasLoadedFromStorageRef.current = true;
    }
  }, [gameId, myPlayerId]);

  // Persist hint suggestions and active index across page reloads (only after initial load completed)
  useEffect(() => {
    if (typeof window === 'undefined' || !gameId || !myPlayerId || !hasLoadedFromStorageRef.current) return;
    const key = `crossword_hint_${gameId}_${myPlayerId}`;
    if (hintSuggestions.length > 0) {
      const data = JSON.stringify({ suggestions: hintSuggestions, activeIndex: activeHintIndex });
      sessionStorage.setItem(key, data);
      localStorage.setItem(key, data);
    } else {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
  }, [activeHintIndex, gameId, hintSuggestions, myPlayerId]);

  const clearHints = useCallback(() => {
    hasLoadedFromStorageRef.current = true;
    setHintSuggestions([]);
    setActiveHintIndex(0);
    setHintCell(null);
    if (typeof window !== 'undefined' && gameId && myPlayerId) {
      const key = `crossword_hint_${gameId}_${myPlayerId}`;
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
  }, [gameId, myPlayerId]);

  const runCard = useCallback(async (payload: UseCardPayload, failureMessage = 'Failed to use card') => {
    if (!myPlayerId || busy) return;
    setBusy(true);
    try {
      const result = await playCard(gameId, myPlayerId, payload);
      if (payload.card === 'HINT') {
        const suggestions: HintSuggestion[] = (result.suggestions as HintSuggestion[] | undefined) ?? [];
        if (result.found && suggestions.length > 0) {
          setHintSuggestions(suggestions);
          setActiveHintIndex(0);
          const firstTile = suggestions[0].tiles[0];
          if (firstTile) setHintCell({ row: firstTile.row, col: firstTile.col });
        } else {
          flashInfo('No valid words can be formed with your current rack tiles — Hint card returned.');
        }
      }
      await reload();
    } catch (error: unknown) {
      flashError(error instanceof Error ? error.message : failureMessage);
    } finally {
      setBusy(false);
    }
  }, [busy, flashError, flashInfo, gameId, myPlayerId, reload]);

  const playSimpleCard = useCallback((card: 'HINT' | 'HEAL' | 'SHIELD') => runCard({ card }), [runCard]);

  const playTargetedCard = useCallback((card: 'DOUBLE_DAMAGE', targetPlayerId: string) => (
    runCard({ card, target_player_id: targetPlayerId })
  ), [runCard]);

  const playSpySwap = useCallback((targetPlayerId: string, ownTileIds: string[], targetTileIndices: number[]) => (
    runCard({
      card: 'SPY_SWAP',
      target_player_id: targetPlayerId,
      own_tile_ids: ownTileIds,
      target_tile_indices: targetTileIndices,
    })
  ), [runCard]);

  const playBanLetter = useCallback((letter: string) => runCard({ card: 'BAN_LETTER', letter }), [runCard]);

  /** Blocks an incoming DAMAGE/SWAP while its window is open. */
  const playShield = useCallback(() => runCard({ card: 'SHIELD' }, 'Failed to use Shield'), [runCard]);

  /**
   * An armed board card picks a target. A committed tile (from a prior turn) stages a second
   * confirm and is only spent once confirmed. FREEZE_TILE can also target one of this turn's own
   * staged tiles - that mark takes effect with Confirm Move itself, no extra confirm needed here
   * since recalling the tile is already how you'd cancel it.
   */
  const playArmedCardAt = useCallback((row: number, col: number) => {
    if (!armedCard || busy) return;
    if (isCellCommitted(boardState, row, col)) {
      setPendingArmedCell({ row, col });
      return;
    }
    if (armedCard === 'FREEZE_TILE') {
      const staged = temporaryTiles.find(tile => tile.row === row && tile.col === col);
      if (staged) {
        setDeferredFreezeTileId(staged.tile_id);
        setArmedCard(null);
      }
    }
  }, [armedCard, boardState, busy, temporaryTiles]);

  const confirmArmedCardAt = useCallback(() => {
    if (!armedCard || !pendingArmedCell || !myPlayerId || busy) return;
    setBusy(true);
    playCard(gameId, myPlayerId, { card: armedCard, ...pendingArmedCell })
      .then(() => reload())
      .catch((error: unknown) => flashError(error instanceof Error ? error.message : 'Failed to use card'))
      .finally(() => { setBusy(false); setArmedCard(null); setPendingArmedCell(null); });
  }, [armedCard, pendingArmedCell, myPlayerId, busy, flashError, gameId, reload]);

  const cancelPendingArmedCell = useCallback(() => setPendingArmedCell(null), []);
  const cancelArm = useCallback(() => { setArmedCard(null); setPendingArmedCell(null); }, []);
  const cancelDeferredFreeze = useCallback(() => setDeferredFreezeTileId(null), []);

  const activeHintTiles = hintSuggestions.length > 0
    ? (hintSuggestions[activeHintIndex]?.tiles ?? null)
    : null;

  return {
    armedCard,
    armBoardCard: setArmedCard,
    cancelArm,
    pendingArmedCell,
    confirmArmedCardAt,
    cancelPendingArmedCell,
    deferredFreezeTileId: activeDeferredFreezeTileId,
    cancelDeferredFreeze,
    hintCell,
    hintSuggestions,
    activeHintIndex,
    setActiveHintIndex,
    clearHints,
    activeHintTiles,
    busy,
    playSimpleCard,
    playTargetedCard,
    playSpySwap,
    playBanLetter,
    playShield,
    playArmedCardAt,
  };
}

