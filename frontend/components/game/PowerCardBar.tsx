'use client';

import React, { memo, useState } from 'react';
import { BoardCard, CellPosition, Player, Tile } from '@/lib/types';
import { isBlankLetter } from '@/lib/tiles';
import {
  X,
  Check,
  ArrowRight,
  Swords,
  Shield,
  Snowflake,
  Flame,
  Heart,
  Eye,
  Repeat2,
  Sparkles,
  Zap,
} from 'lucide-react';

/** Cards the server resolves from the card name alone, with no extra target payload. */
type SimpleCard = 'HINT' | 'HEAL' | 'SHIELD';
/** The subset of those that ask for a confirmation step before being spent. */
type ConfirmableCard = 'HINT' | 'HEAL' | 'SHIELD';
type TargetedCard = 'DOUBLE_DAMAGE';
type SpySwapStep = 'own' | 'opponent' | 'tiles';

export interface CardPowerMeta {
  title: string;
  shortTitle?: string;
  subtitle: string;
  element: string;
  description: string;
  ownTurnOnly: boolean;
  icon: React.ReactNode;
  bgGradient: string;
  borderColor: string;
  hoverBorder: string;
  textColor: string;
  glowClass: string;
  badgeBg: string;
  accentColor: string;
}

export const POWER_CARDS_META: Record<string, CardPowerMeta> = {
  DOUBLE_DAMAGE: {
    title: 'Double Damage',
    shortTitle: '2× DMG',
    subtitle: '2× DAMAGE',
    element: 'HP MODE',
    description: 'Your next word deals double (2×) damage to a targeted opponent.',
    ownTurnOnly: true,
    icon: <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-200 drop-shadow-[0_0_8px_#c084fc]" />,
    bgGradient: 'from-purple-950/95 via-indigo-950/90 to-slate-950/95',
    borderColor: 'border-purple-500/60',
    hoverBorder: 'hover:border-purple-300',
    textColor: 'text-purple-200 group-hover:text-white',
    glowClass: 'shadow-[0_0_14px_rgba(168,85,247,0.35),inset_0_0_10px_rgba(168,85,247,0.2)] hover:shadow-[0_0_24px_rgba(168,85,247,0.65),inset_0_0_14px_rgba(168,85,247,0.35)]',
    badgeBg: 'bg-purple-500/25 border-purple-400/50 text-purple-200',
    accentColor: '#c084fc',
  },
  SHIELD: {
    title: 'Shield',
    shortTitle: 'Shield',
    subtitle: 'PROTECTION',
    element: 'PASSIVE',
    description: 'Blocks the next incoming attack damage or hostile tile swap.',
    ownTurnOnly: false,
    icon: <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-200 fill-sky-400/20 drop-shadow-[0_0_8px_#38bdf8]" />,
    bgGradient: 'from-sky-950/95 via-blue-950/90 to-slate-950/95',
    borderColor: 'border-sky-500/60',
    hoverBorder: 'hover:border-sky-300',
    textColor: 'text-sky-200 group-hover:text-white',
    glowClass: 'shadow-[0_0_14px_rgba(14,165,233,0.35),inset_0_0_10px_rgba(14,165,233,0.2)] hover:shadow-[0_0_24px_rgba(14,165,233,0.65),inset_0_0_14px_rgba(14,165,233,0.35)]',
    badgeBg: 'bg-sky-500/25 border-sky-400/50 text-sky-200',
    accentColor: '#38bdf8',
  },
  FREEZE_TILE: {
    title: 'Freeze Tile',
    shortTitle: 'Freeze',
    subtitle: 'LOCK CELL',
    element: 'YOUR TURN',
    description: 'Locks a board tile in ice so opponents cannot connect words to it.',
    ownTurnOnly: true,
    icon: <Snowflake className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-200 drop-shadow-[0_0_8px_#22d3ee]" />,
    bgGradient: 'from-cyan-950/95 via-teal-950/90 to-slate-950/95',
    borderColor: 'border-cyan-500/60',
    hoverBorder: 'hover:border-cyan-300',
    textColor: 'text-cyan-200 group-hover:text-white',
    glowClass: 'shadow-[0_0_14px_rgba(6,182,212,0.35),inset_0_0_10px_rgba(6,182,212,0.2)] hover:shadow-[0_0_24px_rgba(6,182,212,0.65),inset_0_0_14px_rgba(6,182,212,0.35)]',
    badgeBg: 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200',
    accentColor: '#22d3ee',
  },
  DESTROY_TILE: {
    title: 'Destroy Tile',
    shortTitle: 'Destroy',
    subtitle: 'BREAK TILE',
    element: 'YOUR TURN',
    description: 'Removes 1 tile from the board to disrupt words and reopen bonus cells. (Your turn only)',
    ownTurnOnly: true,
    icon: <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 fill-orange-500/30 drop-shadow-[0_0_8px_#f97316]" />,
    bgGradient: 'from-orange-950/95 via-red-950/90 to-slate-950/95',
    borderColor: 'border-orange-500/60',
    hoverBorder: 'hover:border-orange-300',
    textColor: 'text-orange-200 group-hover:text-white',
    glowClass: 'shadow-[0_0_14px_rgba(249,115,22,0.35),inset_0_0_10px_rgba(249,115,22,0.2)] hover:shadow-[0_0_24px_rgba(249,115,22,0.65),inset_0_0_14px_rgba(249,115,22,0.35)]',
    badgeBg: 'bg-orange-500/25 border-orange-400/50 text-orange-200',
    accentColor: '#fb923c',
  },
  HEAL: {
    title: 'Heal',
    shortTitle: 'Heal',
    subtitle: 'RESTORE HP',
    element: 'HP MODE',
    description: 'Restores HP equal to the total point value of tiles in your rack.',
    ownTurnOnly: false,
    icon: <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-rose-400 text-rose-200 drop-shadow-[0_0_8px_#fb7185]" />,
    bgGradient: 'from-rose-950/95 via-pink-950/90 to-slate-950/95',
    borderColor: 'border-rose-500/60',
    hoverBorder: 'hover:border-rose-300',
    textColor: 'text-rose-200 group-hover:text-white',
    glowClass: 'shadow-[0_0_14px_rgba(244,63,94,0.35),inset_0_0_10px_rgba(244,63,94,0.2)] hover:shadow-[0_0_24px_rgba(244,63,94,0.65),inset_0_0_14px_rgba(244,63,94,0.35)]',
    badgeBg: 'bg-rose-500/25 border-rose-400/50 text-rose-200',
    accentColor: '#fb7185',
  },
  HINT: {
    title: 'Hint',
    shortTitle: 'Hint',
    subtitle: 'TOP 3 MOVES',
    element: 'YOUR TURN',
    description: 'Highlights the top 3 highest-scoring word placements on the board.',
    ownTurnOnly: true,
    icon: <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-200 drop-shadow-[0_0_8px_#fbbf24]" />,
    bgGradient: 'from-amber-950/95 via-yellow-950/90 to-slate-950/95',
    borderColor: 'border-amber-500/60',
    hoverBorder: 'hover:border-amber-300',
    textColor: 'text-amber-200 group-hover:text-white',
    glowClass: 'shadow-[0_0_14px_rgba(245,158,11,0.35),inset_0_0_10px_rgba(245,158,11,0.2)] hover:shadow-[0_0_24px_rgba(245,158,11,0.65),inset_0_0_14px_rgba(245,158,11,0.35)]',
    badgeBg: 'bg-amber-500/25 border-amber-400/50 text-amber-200',
    accentColor: '#fbbf24',
  },
  SPY_SWAP: {
    title: 'Spy Swap',
    shortTitle: 'Spy Swap',
    subtitle: 'STEAL TILES',
    element: 'YOUR TURN',
    description: 'Swap 1 to 3 rack tiles with random tiles stolen from an opponent. (Your turn only)',
    ownTurnOnly: true,
    icon: <Repeat2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200 drop-shadow-[0_0_8px_#34d399]" />,
    bgGradient: 'from-emerald-950/95 via-teal-950/90 to-slate-950/95',
    borderColor: 'border-emerald-500/60',
    hoverBorder: 'hover:border-emerald-300',
    textColor: 'text-emerald-200 group-hover:text-white',
    glowClass: 'shadow-[0_0_14px_rgba(16,185,129,0.35),inset_0_0_10px_rgba(16,185,129,0.2)] hover:shadow-[0_0_24px_rgba(16,185,129,0.65),inset_0_0_14px_rgba(16,185,129,0.35)]',
    badgeBg: 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200',
    accentColor: '#34d399',
  },
};

interface PowerCardBarProps {
  cards: string[];
  opponents: Player[];
  ownRack: Tile[];
  isMyTurn: boolean;
  hasStagedMove: boolean;
  armedCard: BoardCard | null;
  pendingArmedCell: CellPosition | null;
  deferredFreezeTileId: string | null;
  busy: boolean;
  onUseSimple: (card: SimpleCard) => void;
  onUseTargeted: (card: TargetedCard, targetPlayerId: string) => void;
  onUseSpySwap: (targetPlayerId: string, ownTileIds: string[], targetTileIndices: number[]) => void;
  onArmBoardCard: (card: BoardCard) => void;
  onCancelArm: () => void;
  onConfirmArmedCell: () => void;
  onCancelArmedCell: () => void;
  onCancelDeferredFreeze: () => void;
}

export const PowerCardBar = memo(function PowerCardBar({
  cards,
  opponents,
  ownRack,
  isMyTurn,
  hasStagedMove: _hasStagedMove,
  armedCard,
  pendingArmedCell,
  deferredFreezeTileId,
  busy,
  onUseSimple,
  onUseTargeted,
  onUseSpySwap,
  onArmBoardCard,
  onCancelArm,
  onConfirmArmedCell,
  onCancelDeferredFreeze,
}: PowerCardBarProps) {
  const [pickingTargetFor, setPickingTargetFor] = useState<TargetedCard | null>(null);
  const [spySwapStep, setSpySwapStep] = useState<SpySwapStep | null>(null);
  const [spyOwnTileIds, setSpyOwnTileIds] = useState<string[]>([]);
  const [spyTargetPlayerId, setSpyTargetPlayerId] = useState<string | null>(null);
  const [spyTargetTileIndices, setSpyTargetTileIndices] = useState<number[]>([]);
  const [confirmingSimpleCard, setConfirmingSimpleCard] = useState<ConfirmableCard | null>(null);

  // Filter only the 7 true power cards
  const validCards = cards.filter(card => POWER_CARDS_META[card]);

  if (deferredFreezeTileId) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-cyan-400/80 bg-gradient-to-r from-sky-950 via-cyan-950 to-slate-950 px-3 py-1.5 text-xs text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-400/50 shadow-[0_0_8px_rgba(6,182,212,0.5)] shrink-0">
            <Snowflake className="w-3.5 h-3.5 text-cyan-200" />
          </div>
          <span className="font-semibold text-slate-100 text-xs truncate">
            <strong className="text-cyan-300 font-extrabold">Freeze Armed</strong> — activates on move
          </span>
        </div>
        <button
          type="button"
          onClick={onCancelDeferredFreeze}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-950/80 hover:bg-cyan-900 px-2.5 py-1 text-xs font-bold text-cyan-200 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <X className="w-3.5 h-3.5" />
          <span>Unmark</span>
        </button>
      </div>
    );
  }

  if (armedCard && pendingArmedCell) {
    const meta = POWER_CARDS_META[armedCard];
    const isDestroy = armedCard === 'DESTROY_TILE';
    const verb = isDestroy ? 'Destroy' : 'Freeze';

    return (
      <div
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-lg ${
          isDestroy
            ? 'border-orange-500/80 bg-gradient-to-r from-orange-950 via-red-950 to-slate-950 text-orange-100 shadow-[0_0_20px_rgba(249,115,22,0.4)] ring-1 ring-orange-500/40'
            : 'border-cyan-400/80 bg-gradient-to-r from-sky-950 via-cyan-950 to-slate-950 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/40'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-lg border shrink-0 ${
              isDestroy
                ? 'bg-orange-500/20 border-orange-400/60 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                : 'bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
            }`}
          >
            {meta?.icon}
          </div>
          <span className="font-extrabold text-slate-100 text-xs truncate">
            {verb} ({pendingArmedCell.row + 1},{pendingArmedCell.col + 1})?
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmArmedCell}
            className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-black hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer ${
              isDestroy
                ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-red-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.6)]'
                : 'bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.6)]'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Confirm</span>
          </button>
          <button
            type="button"
            onClick={onCancelArm}
            className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (armedCard) {
    const meta = POWER_CARDS_META[armedCard];
    const isDestroy = armedCard === 'DESTROY_TILE';
    return (
      <div
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-lg ${
          isDestroy
            ? 'border-orange-500/80 bg-gradient-to-r from-orange-950 via-slate-900 to-slate-950 text-orange-100 shadow-[0_0_20px_rgba(249,115,22,0.4)] ring-1 ring-orange-500/40'
            : 'border-cyan-400/80 bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-950 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-cyan-500/40'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-lg border animate-pulse shrink-0 ${
              isDestroy
                ? 'bg-orange-500/20 border-orange-400/60 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                : 'bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
            }`}
          >
            {meta?.icon}
          </div>
          <span className="font-extrabold text-slate-100 text-xs truncate">
            {isDestroy ? 'Tap tile to destroy' : 'Tap tile to freeze'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancelArm}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
      </div>
    );
  }

  if (spySwapStep) {
    const selectedOpponent = opponents.find(opponent => opponent.id === spyTargetPlayerId);
    const toggleOwnTile = (tileId: string) => {
      setSpyOwnTileIds(current =>
        current.includes(tileId)
          ? current.filter(id => id !== tileId)
          : current.length < 3
          ? [...current, tileId]
          : current
      );
    };
    const toggleTargetSlot = (index: number) => {
      setSpyTargetTileIndices(current =>
        current.includes(index)
          ? current.filter(item => item !== index)
          : current.length < spyOwnTileIds.length
          ? [...current, index]
          : current
      );
    };
    const cancelSpySwap = () => {
      setSpySwapStep(null);
      setSpyOwnTileIds([]);
      setSpyTargetPlayerId(null);
      setSpyTargetTileIndices([]);
    };

    return (
      <div className="flex flex-col w-full gap-2 rounded-xl border border-emerald-400/80 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-2.5 text-xs text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/40">
        {spySwapStep === 'own' && (
          <div className="flex flex-col items-center gap-2 w-full">
            {/* Header + Counter */}
            <div className="flex items-center justify-between w-full px-0.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                  {POWER_CARDS_META.SPY_SWAP?.icon}
                </div>
                <div>
                  <span className="font-extrabold text-emerald-300 text-xs">Pick 1–3 tiles to swap:</span>
                </div>
              </div>
              <span className="font-mono font-black text-emerald-300 text-xs bg-emerald-950/90 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
                {spyOwnTileIds.length}/3 Picked
              </span>
            </div>

            {/* Tiles Row */}
            <div className="flex flex-nowrap items-center justify-center gap-1.5 sm:gap-2 w-full overflow-x-auto hide-scrollbar py-1">
              {ownRack.map(tile => {
                const selected = spyOwnTileIds.includes(tile.id);
                return (
                  <button
                    key={tile.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleOwnTile(tile.id)}
                    className={`tile-face relative flex shrink-0 h-[42px] w-[36px] sm:h-[46px] sm:w-[40px] flex-col items-center justify-center overflow-hidden rounded-xl border font-sans cursor-pointer transition-all active:scale-95 ${
                      selected
                        ? 'border-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.8)] -translate-y-1 scale-105'
                        : 'border-amber-100/80 hover:brightness-105'
                    }`}
                  >
                    {isBlankLetter(tile.letter) ? (
                      <span className="text-amber-300 text-xs font-bold">★</span>
                    ) : (
                      <span className="tile-letter tile-letter-orange text-[22px] sm:text-[24px] leading-none font-maple">
                        {tile.letter}
                      </span>
                    )}
                    <span className="tile-score-blue absolute bottom-0.5 right-0.5 text-[9px] sm:text-[10px] font-maple">
                      {tile.value}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 w-full pt-1">
              <button
                type="button"
                disabled={!spyOwnTileIds.length || busy || !opponents.length}
                onClick={() => setSpySwapStep('opponent')}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-3.5 py-1.5 font-black text-slate-950 hover:brightness-110 shadow-[0_0_12px_rgba(16,185,129,0.5)] disabled:opacity-40 transition-all cursor-pointer uppercase text-xs active:scale-95"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
              </button>
              <button
                type="button"
                onClick={cancelSpySwap}
                className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 font-bold text-slate-400 hover:text-white cursor-pointer text-xs active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {spySwapStep === 'opponent' && (
          <div className="flex flex-col items-center gap-2 w-full">
            <span className="font-extrabold text-emerald-300 text-xs self-start">Select Target Opponent:</span>
            <div className="flex flex-wrap items-center justify-center gap-2 w-full py-1">
              {opponents.map(opponent => (
                <button
                  key={opponent.id}
                  type="button"
                  disabled={busy || opponent.rack_count < spyOwnTileIds.length}
                  onClick={() => {
                    setSpyTargetPlayerId(opponent.id);
                    setSpyTargetTileIndices([]);
                    setSpySwapStep('tiles');
                  }}
                  className="rounded-lg border border-emerald-400/60 bg-emerald-950/70 hover:bg-emerald-800/90 px-3.5 py-1.5 font-extrabold text-emerald-200 hover:text-white disabled:opacity-40 transition-all cursor-pointer shadow-md text-xs active:scale-95"
                >
                  {opponent.display_name} ({opponent.rack_count} tiles)
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end w-full">
              <button
                type="button"
                onClick={cancelSpySwap}
                className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 font-bold text-slate-400 hover:text-white cursor-pointer text-xs active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {spySwapStep === 'tiles' && selectedOpponent && (
          <div className="flex flex-col items-center gap-2 w-full">
            <span className="font-extrabold text-emerald-300 text-xs self-start">
              Pick {spyOwnTileIds.length} from {selectedOpponent.display_name}:
            </span>
            <div className="flex flex-nowrap items-center justify-center gap-2 w-full overflow-x-auto hide-scrollbar py-1">
              {Array.from({ length: selectedOpponent.rack_count }, (_, index) => {
                const selected = spyTargetTileIndices.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={!selected && spyTargetTileIndices.length >= spyOwnTileIds.length}
                    onClick={() => toggleTargetSlot(index)}
                    className={`h-[42px] w-[36px] sm:h-[46px] sm:w-[40px] shrink-0 rounded-xl border font-black text-base transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                      selected
                        ? 'border-emerald-300 bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.8)] -translate-y-1 scale-105'
                        : 'border-slate-700 bg-slate-800/90 text-slate-300 hover:border-emerald-400 hover:text-white'
                    }`}
                  >
                    ?
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 w-full pt-1">
              <button
                type="button"
                disabled={busy || spyTargetTileIndices.length !== spyOwnTileIds.length}
                onClick={() => {
                  onUseSpySwap(spyTargetPlayerId!, spyOwnTileIds, spyTargetTileIndices);
                  cancelSpySwap();
                }}
                className="rounded-lg bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-1.5 font-black text-slate-950 hover:brightness-110 shadow-[0_0_12px_rgba(16,185,129,0.5)] disabled:opacity-40 transition-all cursor-pointer uppercase text-xs active:scale-95"
              >
                Confirm Swap
              </button>
              <button
                type="button"
                onClick={() => setSpySwapStep('opponent')}
                className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 font-bold text-slate-300 hover:text-white cursor-pointer text-xs active:scale-95"
              >
                Back
              </button>
              <button
                type="button"
                onClick={cancelSpySwap}
                className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 font-bold text-slate-400 hover:text-white cursor-pointer text-xs active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (pickingTargetFor) {
    const meta = POWER_CARDS_META[pickingTargetFor];
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-purple-400/80 bg-gradient-to-r from-purple-950 via-slate-900 to-slate-950 px-3 py-1.5 text-xs text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.4)] ring-1 ring-purple-500/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-400/60 shadow-[0_0_8px_rgba(168,85,247,0.5)] shrink-0">
            {meta?.icon}
          </div>
          <span className="font-extrabold text-slate-100 text-xs truncate">Target Opponent:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {opponents.map(opponent => (
            <button
              key={opponent.id}
              disabled={busy}
              onClick={() => {
                onUseTargeted(pickingTargetFor, opponent.id);
                setPickingTargetFor(null);
              }}
              className="rounded-lg border border-purple-400/60 bg-purple-950/80 hover:bg-purple-800/90 px-2.5 py-1 font-extrabold text-xs text-purple-200 hover:text-white shadow-md disabled:opacity-50 transition-all cursor-pointer active:scale-95"
            >
              {opponent.display_name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickingTargetFor(null)}
            className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (confirmingSimpleCard) {
    const meta = POWER_CARDS_META[confirmingSimpleCard];
    const isHeal = confirmingSimpleCard === 'HEAL';
    const isHint = confirmingSimpleCard === 'HINT';

    return (
      <div
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-lg select-none ${
          isHint
            ? 'border-amber-500/80 bg-gradient-to-r from-amber-950 via-yellow-950 to-slate-950 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.4)] ring-1 ring-amber-500/40'
            : isHeal
            ? 'border-rose-500/80 bg-gradient-to-r from-rose-950 via-pink-950 to-slate-950 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.4)] ring-1 ring-rose-500/40'
            : 'border-blue-500/80 bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-950 text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.4)] ring-1 ring-blue-500/40'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-lg border shrink-0 ${
              isHint
                ? 'bg-amber-500/20 border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : isHeal
                ? 'bg-rose-500/20 border-rose-400/60 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                : 'bg-blue-500/20 border-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
            }`}
          >
            {meta?.icon}
          </div>
          <span className="font-extrabold text-slate-100 text-xs truncate">
            Use <span className="font-black text-white">{meta.title}</span>?
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onUseSimple(confirmingSimpleCard);
              setConfirmingSimpleCard(null);
            }}
            className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-black hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer ${
              isHint
                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-neutral-950 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                : isHeal
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.6)]'
                : 'bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950 shadow-[0_0_12px_rgba(14,165,233,0.6)]'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Confirm</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmingSimpleCard(null)}
            className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const maxSlots = 3;
  const slotCards = validCards.slice(0, maxSlots);

  return (
    <div className="flex w-full items-center justify-between gap-1.5 sm:gap-2 mb-0.5 select-none">
      {[0, 1, 2].map(slotIndex => {
        const card = slotCards[slotIndex];

        // Empty Holographic Card Bay
        if (!card || !POWER_CARDS_META[card]) {
          return (
            <div
              key={`empty-card-slot-${slotIndex}`}
              title={`Power Card Slot ${slotIndex + 1} (Empty)`}
              className="group relative flex h-7 sm:h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-400/35 bg-gradient-to-b from-[#1a1d48]/90 via-[#111334]/90 to-[#0a0c22]/95 px-2 py-0.5 select-none shadow-[inset_0_1px_3px_rgba(0,0,0,0.8),0_2px_6px_rgba(0,0,0,0.5)] transition-all overflow-hidden"
            >
              {/* Top Glass Specular Line */}
              <div className="absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-300/40 to-transparent pointer-events-none" />

              {/* Slot Indicator */}
              <div className="flex items-center justify-center w-4 h-4 rounded-md bg-amber-400/20 border border-amber-300/50 text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.35)]">
                <span className="text-[10px] font-black leading-none">{slotIndex + 1}</span>
              </div>

              {/* Celestial Text */}
              <span className="text-[10.5px] sm:text-[11.5px] font-black tracking-wider text-slate-100 uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] truncate">
                CARD {slotIndex + 1}
              </span>
            </div>
          );
        }

        const meta = POWER_CARDS_META[card];
        const disabled = busy || (meta.ownTurnOnly && !isMyTurn);

        return (
          <button
            key={`card-slot-${slotIndex}-${card}`}
            type="button"
            disabled={disabled}
            title={
              meta.ownTurnOnly && !isMyTurn
                ? `${meta.title} (${meta.subtitle}) — Available only during your turn`
                : `Activate ${meta.title}: ${meta.description}`
            }
            onClick={() => {
              if (card === 'FREEZE_TILE' || card === 'DESTROY_TILE') {
                onArmBoardCard(card as BoardCard);
              } else if (card === 'DOUBLE_DAMAGE') {
                setPickingTargetFor(card);
              } else if (card === 'SPY_SWAP') {
                setSpySwapStep('own');
                setSpyOwnTileIds([]);
              } else if (card === 'HEAL' || card === 'HINT' || card === 'SHIELD') {
                setConfirmingSimpleCard(card);
              } else {
                onUseSimple(card as SimpleCard);
              }
            }}
            className={`group relative flex h-7 sm:h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold transition-all duration-200 cursor-pointer select-none active:scale-[0.97] focus-visible:outline-none overflow-hidden ${
              disabled
                ? 'border-slate-700/60 bg-slate-900/60 text-slate-500 cursor-not-allowed opacity-60'
                : `bg-gradient-to-r ${meta.bgGradient} ${meta.borderColor} ${meta.hoverBorder} ${meta.textColor} ${meta.glowClass} hover:-translate-y-0.5 hover:brightness-110`
            }`}
          >
            {/* Top Gloss Specular Layer */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none z-10" />

            {/* Glowing Element Icon */}
            <div className="relative z-20 flex shrink-0 items-center">
              {meta.icon}
            </div>

            {/* Card Name */}
            <span className="relative z-20 text-[11px] sm:text-[12px] font-black tracking-wide leading-none drop-shadow-sm whitespace-nowrap">
              {meta.shortTitle ?? meta.title}
            </span>
          </button>
        );
      })}
    </div>
  );
});
