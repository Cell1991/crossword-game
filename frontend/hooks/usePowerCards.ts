'use client';

import { useCallback, useState } from 'react';
import { playCard, UseCardPayload } from '@/lib/api';
import { BoardCard, BoardCell, CellPosition } from '@/lib/types';
import { isCellCommitted } from '@/lib/tiles';
import { GameToasts } from './useGameToasts';

/** How long the HINT card's suggested cell stays highlighted. */
const HINT_HIGHLIGHT_MS = 5000;

interface UsePowerCardsOptions {
  gameId: string;
  myPlayerId: string | null;
  boardState: Record<string, BoardCell>;
  reload: () => Promise<void>;
  toasts: GameToasts;
}

/** Playing power cards: one request at a time, then a fresh snapshot. */
export function usePowerCards({ gameId, myPlayerId, boardState, reload, toasts }: UsePowerCardsOptions) {
  const { flashError, flashInfo } = toasts;
  const [armedCard, setArmedCard] = useState<BoardCard | null>(null);
  const [hintCell, setHintCell] = useState<CellPosition | null>(null);
  const [busy, setBusy] = useState(false);

  const runCard = useCallback(async (payload: UseCardPayload, failureMessage = 'Failed to use card') => {
    if (!myPlayerId || busy) return;
    setBusy(true);
    try {
      const result = await playCard(gameId, myPlayerId, payload);
      if (payload.card === 'HINT') {
        if (result.found && typeof result.row === 'number' && typeof result.col === 'number') {
          setHintCell({ row: result.row, col: result.col });
          setTimeout(() => setHintCell(null), HINT_HIGHLIGHT_MS);
        } else {
          // The hint search found nothing this time; the card stays in hand (see cards.py) so it's
          // worth telling the player explicitly rather than leaving the click looking like a no-op.
          flashInfo('No valid move found with your current rack — Hint card kept, try again');
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

  const playTargetedCard = useCallback((card: 'DOUBLE_DAMAGE' | 'SPY_SWAP', targetPlayerId: string) => (
    runCard({ card, target_player_id: targetPlayerId })
  ), [runCard]);

  const playBanLetter = useCallback((letter: string) => runCard({ card: 'BAN_LETTER', letter }), [runCard]);

  /** Blocks an incoming DAMAGE/SWAP while its window is open. */
  const playShield = useCallback(() => runCard({ card: 'SHIELD' }, 'Failed to use Shield'), [runCard]);

  /** An armed board card (FREEZE/DESTROY) is spent on the committed tile the player clicks. */
  const playArmedCardAt = useCallback((row: number, col: number) => {
    if (!armedCard) return;
    if (!myPlayerId || !isCellCommitted(boardState, row, col) || busy) return;
    setBusy(true);
    playCard(gameId, myPlayerId, { card: armedCard, row, col })
      .then(() => reload())
      .catch((error: unknown) => flashError(error instanceof Error ? error.message : 'Failed to use card'))
      .finally(() => { setBusy(false); setArmedCard(null); });
  }, [armedCard, boardState, busy, flashError, gameId, myPlayerId, reload]);

  const cancelArm = useCallback(() => setArmedCard(null), []);

  return {
    armedCard,
    armBoardCard: setArmedCard,
    cancelArm,
    hintCell,
    busy,
    playSimpleCard,
    playTargetedCard,
    playBanLetter,
    playShield,
    playArmedCardAt,
  };
}
