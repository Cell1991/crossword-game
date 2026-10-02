'use client';

import React, { memo, useState } from 'react';
import { BoardCard, CellPosition, Player, Tile } from '@/lib/types';
import { isBlankLetter } from '@/lib/tiles';
import { cardIcon } from './cardIcons';
import { X, Check, ArrowRight } from 'lucide-react';

/** Cards the server resolves from the card name alone, with no extra target payload. */
type SimpleCard = 'HINT' | 'HEAL' | 'SHIELD' | 'DRAW_TILE' | 'FREE_EXCHANGE';
/** The subset of those that ask for a confirmation step before being spent. */
type ConfirmableCard = 'HINT' | 'HEAL' | 'SHIELD';
type TargetedCard = 'DOUBLE_DAMAGE';
type SpySwapStep = 'own' | 'opponent' | 'tiles';

interface CardStyleConfig {
  icon: React.ReactNode;
  label: string;
  ownTurnOnly: boolean;
  bgGradient: string;
  borderColor: string;
  textColor: string;
  glowClass: string;
  badgeBg: string;
}

const CARD_META: Record<string, CardStyleConfig> = {
  HEAL: {
    icon: cardIcon('HEAL', 'h-4 w-4 text-pink-300', '×2'),
    label: 'Heal',
    ownTurnOnly: false,
    bgGradient: 'from-rose-950/90 via-pink-950/70 to-slate-950/90',
    borderColor: 'border-rose-500/50 hover:border-pink-400/90',
    textColor: 'text-rose-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(244,63,94,0.45)] hover:ring-1 hover:ring-pink-400/40',
    badgeBg: 'bg-rose-500/30 border border-rose-400/50 text-rose-200',
  },
  FREEZE_TILE: {
    icon: cardIcon('FREEZE_TILE', 'h-4 w-4 text-cyan-300', '×2'),
    label: 'Freeze Word',
    ownTurnOnly: true,
    bgGradient: 'from-sky-950/90 via-cyan-950/70 to-slate-950/90',
    borderColor: 'border-cyan-500/50 hover:border-cyan-400/90',
    textColor: 'text-cyan-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(6,182,212,0.45)] hover:ring-1 hover:ring-cyan-400/40',
    badgeBg: 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-200',
  },
  DOUBLE_DAMAGE: {
    icon: cardIcon('DOUBLE_DAMAGE', 'h-4 w-4 text-purple-300', '×2'),
    label: 'Word ×2',
    ownTurnOnly: true,
    bgGradient: 'from-purple-950/90 via-indigo-950/70 to-slate-950/90',
    borderColor: 'border-purple-500/50 hover:border-purple-400/90',
    textColor: 'text-purple-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(168,85,247,0.45)] hover:ring-1 hover:ring-purple-400/40',
    badgeBg: 'bg-purple-500/30 border border-purple-400/50 text-purple-200',
  },
  SHIELD: {
    icon: cardIcon('SHIELD', 'h-4 w-4 text-blue-300', '×2'),
    label: 'Shield',
    ownTurnOnly: false,
    bgGradient: 'from-blue-950/90 via-indigo-950/70 to-slate-950/90',
    borderColor: 'border-blue-500/50 hover:border-blue-400/90',
    textColor: 'text-blue-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(59,130,246,0.45)] hover:ring-1 hover:ring-blue-400/40',
    badgeBg: 'bg-blue-500/30 border border-blue-400/50 text-blue-200',
  },
  HINT: {
    icon: cardIcon('HINT', 'h-4 w-4 text-amber-300', '×2'),
    label: 'Hint',
    ownTurnOnly: true,
    bgGradient: 'from-amber-950/90 via-yellow-950/70 to-slate-950/90',
    borderColor: 'border-amber-500/50 hover:border-amber-400/90',
    textColor: 'text-amber-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(245,158,11,0.45)] hover:ring-1 hover:ring-amber-400/40',
    badgeBg: 'bg-amber-500/30 border border-amber-400/50 text-amber-200',
  },
  SPY_SWAP: {
    icon: cardIcon('SPY_SWAP', 'h-4 w-4 text-emerald-300', '×2'),
    label: 'Swap Word',
    ownTurnOnly: false,
    bgGradient: 'from-emerald-950/90 via-teal-950/70 to-slate-950/90',
    borderColor: 'border-emerald-500/50 hover:border-emerald-400/90',
    textColor: 'text-emerald-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(16,185,129,0.45)] hover:ring-1 hover:ring-emerald-400/40',
    badgeBg: 'bg-emerald-500/30 border border-emerald-400/50 text-emerald-200',
  },
  DESTROY_TILE: {
    icon: cardIcon('DESTROY_TILE', 'h-4 w-4 text-orange-300', '×2'),
    label: 'Clear Word',
    ownTurnOnly: false,
    bgGradient: 'from-orange-950/90 via-red-950/70 to-slate-950/90',
    borderColor: 'border-orange-500/50 hover:border-orange-400/90',
    textColor: 'text-orange-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(249,115,22,0.45)] hover:ring-1 hover:ring-orange-400/40',
    badgeBg: 'bg-orange-500/30 border border-orange-400/50 text-orange-200',
  },
  BAN_LETTER: {
    icon: cardIcon('BAN_LETTER', 'h-4 w-4 text-red-300', '×2'),
    label: 'Ban Letter',
    ownTurnOnly: false,
    bgGradient: 'from-red-950/90 via-rose-950/70 to-slate-950/90',
    borderColor: 'border-red-500/50 hover:border-red-400/90',
    textColor: 'text-red-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(239,68,68,0.45)] hover:ring-1 hover:ring-red-400/40',
    badgeBg: 'bg-red-500/30 border border-red-400/50 text-red-200',
  },
  FREE_EXCHANGE: {
    icon: cardIcon('FREE_EXCHANGE', 'h-4 w-4 text-teal-300', '×2'),
    label: 'Free Exchange',
    ownTurnOnly: false,
    bgGradient: 'from-teal-950/90 via-cyan-950/70 to-slate-950/90',
    borderColor: 'border-teal-500/50 hover:border-teal-400/90',
    textColor: 'text-teal-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(20,184,166,0.45)] hover:ring-1 hover:ring-teal-400/40',
    badgeBg: 'bg-teal-500/30 border border-teal-400/50 text-teal-200',
  },
  DRAW_TILE: {
    icon: cardIcon('DRAW_TILE', 'h-4 w-4 text-lime-300', '×2'),
    label: 'Draw Tile',
    ownTurnOnly: false,
    bgGradient: 'from-lime-950/90 via-green-950/70 to-slate-950/90',
    borderColor: 'border-lime-500/50 hover:border-lime-400/90',
    textColor: 'text-lime-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(132,204,22,0.45)] hover:ring-1 hover:ring-lime-400/40',
    badgeBg: 'bg-lime-500/30 border border-lime-400/50 text-lime-200',
  },
  MOVE_HEAL: {
    icon: cardIcon('MOVE_HEAL', 'h-4 w-4 text-fuchsia-300', '×2'),
    label: 'Move Heal',
    ownTurnOnly: true,
    bgGradient: 'from-fuchsia-950/90 via-purple-950/70 to-slate-950/90',
    borderColor: 'border-fuchsia-500/50 hover:border-fuchsia-400/90',
    textColor: 'text-fuchsia-200 group-hover:text-white',
    glowClass: 'hover:shadow-[0_0_18px_rgba(217,70,239,0.45)] hover:ring-1 hover:ring-fuchsia-400/40',
    badgeBg: 'bg-fuchsia-500/30 border border-fuchsia-400/50 text-fuchsia-200',
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
  onUseBanLetter: (letter: string) => void;
  /** MOVE_HEAL heals by the staged word's value, so the caller supplies the staged tiles. */
  onUseMoveHeal: () => void;
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
  hasStagedMove,
  armedCard,
  pendingArmedCell,
  deferredFreezeTileId,
  busy,
  onUseSimple,
  onUseTargeted,
  onUseSpySwap,
  onUseBanLetter,
  onUseMoveHeal,
  onArmBoardCard,
  onCancelArm,
  onConfirmArmedCell,
  onCancelDeferredFreeze,
}: PowerCardBarProps) {
  const [pickingTargetFor, setPickingTargetFor] = useState<TargetedCard | null>(null);
  const [pickingLetter, setPickingLetter] = useState(false);
  const [letterDraft, setLetterDraft] = useState('');
  const [spySwapStep, setSpySwapStep] = useState<SpySwapStep | null>(null);
  const [spyOwnTileIds, setSpyOwnTileIds] = useState<string[]>([]);
  const [spyTargetPlayerId, setSpyTargetPlayerId] = useState<string | null>(null);
  const [spyTargetTileIndices, setSpyTargetTileIndices] = useState<number[]>([]);
  const [confirmingSimpleCard, setConfirmingSimpleCard] = useState<ConfirmableCard | null>(null);

  const counts = new Map<string, number>();
  for (const card of cards) {
    if (CARD_META[card]) counts.set(card, (counts.get(card) ?? 0) + 1);
  }

  if (deferredFreezeTileId) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-cyan-400/80 bg-gradient-to-r from-sky-950 via-cyan-950 to-slate-950 px-2.5 py-1 text-xs text-cyan-100 shadow-md ring-1 ring-cyan-400/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/50 shrink-0">
            <span className="text-xs">❄️</span>
          </div>
          <span className="font-semibold text-slate-100 text-[11px] truncate">
            <strong className="text-cyan-300 font-bold">Freeze Marked</strong> — on move confirm
          </span>
        </div>
        <button
          type="button"
          onClick={onCancelDeferredFreeze}
          className="flex shrink-0 items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-950/80 hover:bg-cyan-900 px-2 py-0.5 text-[11px] font-bold text-cyan-200 hover:text-white transition-colors cursor-pointer shadow-sm active:scale-95"
        >
          <X className="w-3 h-3" />
          <span>Unmark</span>
        </button>
      </div>
    );
  }

  if (armedCard && pendingArmedCell) {
    const meta = CARD_META[armedCard];
    const isDestroy = armedCard === 'DESTROY_TILE';
    const verb = isDestroy ? 'Destroy' : 'Freeze';

    return (
      <div className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-xs shadow-md ${
        isDestroy
          ? 'border-orange-500/80 bg-gradient-to-r from-orange-950 via-red-950 to-slate-950 text-orange-100 ring-1 ring-orange-500/40'
          : 'border-cyan-400/80 bg-gradient-to-r from-sky-950 via-cyan-950 to-slate-950 text-cyan-100 ring-1 ring-cyan-400/40'
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`flex items-center justify-center w-5 h-5 rounded-md border shrink-0 ${
            isDestroy
              ? 'bg-orange-500/20 border-orange-400/60'
              : 'bg-cyan-500/20 border-cyan-400/60'
          }`}>
            {meta?.icon}
          </div>
          <span className="font-bold text-slate-100 text-[11px] truncate">
            {verb} tile at ({pendingArmedCell.row + 1}, {pendingArmedCell.col + 1})?
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmArmedCell}
            className={`flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[11px] font-black hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer ${
              isDestroy
                ? 'bg-gradient-to-r from-orange-500 via-rose-500 to-red-500 text-white shadow-sm'
                : 'bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 text-slate-950 shadow-sm'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Confirm</span>
          </button>
          <button
            type="button"
            onClick={onCancelArm}
            className="rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (armedCard) {
    const meta = CARD_META[armedCard];
    const isDestroy = armedCard === 'DESTROY_TILE';
    return (
      <div className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-xs shadow-md ${
        isDestroy
          ? 'border-orange-500/80 bg-gradient-to-r from-orange-950 via-slate-900 to-slate-950 text-orange-100 ring-1 ring-orange-500/40'
          : 'border-cyan-400/80 bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-950 text-cyan-100 ring-1 ring-cyan-500/40'
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`flex items-center justify-center w-5 h-5 rounded-md border animate-pulse shrink-0 ${
            isDestroy
              ? 'bg-orange-500/20 border-orange-400/60'
              : 'bg-cyan-500/20 border-cyan-400/60'
          }`}>
            {meta?.icon}
          </div>
          <span className="font-bold text-slate-100 text-[11px] truncate">
            {isDestroy ? 'Tap board tile to clear' : 'Tap board tile to freeze'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancelArm}
          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          <X className="w-3 h-3" />
          <span>Cancel</span>
        </button>
      </div>
    );
  }

  if (spySwapStep) {
    const selectedOpponent = opponents.find(opponent => opponent.id === spyTargetPlayerId);
    const toggleOwnTile = (tileId: string) => {
      setSpyOwnTileIds(current => current.includes(tileId)
        ? current.filter(id => id !== tileId)
        : current.length < 3 ? [...current, tileId] : current);
    };
    const toggleTargetSlot = (index: number) => {
      setSpyTargetTileIndices(current => current.includes(index)
        ? current.filter(item => item !== index)
        : current.length < spyOwnTileIds.length ? [...current, index] : current);
    };
    const cancelSpySwap = () => {
      setSpySwapStep(null);
      setSpyOwnTileIds([]);
      setSpyTargetPlayerId(null);
      setSpyTargetTileIndices([]);
    };

    return (
      <div className="flex flex-col w-full gap-2 rounded-xl border border-emerald-400/80 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-2 text-xs text-emerald-100 shadow-lg ring-1 ring-emerald-500/40">
        {spySwapStep === 'own' && (
          <div className="flex flex-col items-center gap-1.5 w-full">
            {/* Header + Counter */}
            <div className="flex items-center justify-between w-full px-0.5">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-400/60">
                  {CARD_META.SPY_SWAP?.icon}
                </div>
                <span className="font-extrabold text-emerald-300 text-[11px]">Give up to 3 tiles:</span>
              </div>
              <span className="font-mono font-bold text-emerald-300 text-[11px] bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                {spyOwnTileIds.length}/3 Selected
              </span>
            </div>

            {/* 7 Tiles Single Horizontal Row */}
            <div className="flex flex-nowrap items-center justify-center gap-1 sm:gap-1.5 w-full overflow-x-auto hide-scrollbar py-0.5">
              {ownRack.map(tile => {
                const selected = spyOwnTileIds.includes(tile.id);
                return (
                  <button
                    key={tile.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleOwnTile(tile.id)}
                    className={`tile-face relative flex shrink-0 h-[40px] w-[34px] sm:h-[44px] sm:w-[38px] flex-col items-center justify-center overflow-hidden rounded-lg border font-sans cursor-pointer transition-all active:scale-95 ${
                      selected
                        ? 'border-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)] -translate-y-1 scale-105'
                        : 'border-amber-100/80 hover:brightness-105'
                    }`}
                  >
                    {isBlankLetter(tile.letter) ? (
                      <span className="text-amber-300 text-xs font-bold">★</span>
                    ) : (
                      <span className="tile-letter tile-letter-orange text-[21px] sm:text-[23px] leading-none font-maple">
                        {tile.letter}
                      </span>
                    )}
                    <span className="tile-score-blue absolute bottom-0.5 right-0.5 text-[8.5px] sm:text-[9.5px] font-maple">
                      {tile.value}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-1.5 w-full pt-0.5">
              <button
                type="button"
                disabled={!spyOwnTileIds.length || busy || !opponents.length}
                onClick={() => setSpySwapStep('opponent')}
                className="flex items-center gap-1 rounded-md bg-gradient-to-r from-emerald-500 to-teal-400 px-3 py-1 font-black text-slate-950 hover:brightness-110 shadow-sm disabled:opacity-40 transition-all cursor-pointer uppercase text-[11px] active:scale-95"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={cancelSpySwap}
                className="rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 font-bold text-slate-400 hover:text-white cursor-pointer text-[11px] active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {spySwapStep === 'opponent' && (
          <div className="flex flex-col items-center gap-1.5 w-full">
            <span className="font-extrabold text-emerald-300 text-[11px] self-start">Select target player:</span>
            <div className="flex flex-wrap items-center justify-center gap-1.5 w-full py-1">
              {opponents.map(opponent => (
                <button
                  key={opponent.id}
                  type="button"
                  disabled={busy || opponent.rack_count < spyOwnTileIds.length}
                  onClick={() => { setSpyTargetPlayerId(opponent.id); setSpyTargetTileIndices([]); setSpySwapStep('tiles'); }}
                  className="rounded-md border border-emerald-400/50 bg-emerald-950/60 hover:bg-emerald-800/80 px-3 py-1 font-bold text-emerald-200 hover:text-white disabled:opacity-40 transition-all cursor-pointer shadow-sm text-[11px] active:scale-95"
                >
                  {opponent.display_name}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end w-full">
              <button
                type="button"
                onClick={cancelSpySwap}
                className="rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 font-bold text-slate-400 hover:text-white cursor-pointer text-[11px] active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {spySwapStep === 'tiles' && selectedOpponent && (
          <div className="flex flex-col items-center gap-1.5 w-full">
            <span className="font-extrabold text-emerald-300 text-[11px] self-start">
              Pick {spyOwnTileIds.length} hidden tiles from {selectedOpponent.display_name}:
            </span>
            <div className="flex flex-nowrap items-center justify-center gap-1.5 w-full overflow-x-auto hide-scrollbar py-0.5">
              {Array.from({ length: selectedOpponent.rack_count }, (_, index) => {
                const selected = spyTargetTileIndices.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={!selected && spyTargetTileIndices.length >= spyOwnTileIds.length}
                    onClick={() => toggleTargetSlot(index)}
                    className={`h-[38px] w-[32px] sm:h-[42px] sm:w-[36px] shrink-0 rounded-lg border font-black text-sm transition-all cursor-pointer active:scale-95 ${
                      selected
                        ? 'border-emerald-300 bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)] -translate-y-1 scale-105'
                        : 'border-slate-700 bg-slate-800/90 text-slate-300 hover:border-emerald-400 hover:text-white'
                    }`}
                  >
                    ?
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-1.5 w-full pt-0.5">
              <button
                type="button"
                disabled={busy || spyTargetTileIndices.length !== spyOwnTileIds.length}
                onClick={() => {
                  onUseSpySwap(spyTargetPlayerId!, spyOwnTileIds, spyTargetTileIndices);
                  cancelSpySwap();
                }}
                className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-400 px-3 py-1 font-black text-slate-950 hover:brightness-110 shadow-sm disabled:opacity-40 transition-all cursor-pointer uppercase text-[11px] active:scale-95"
              >
                Confirm Swap
              </button>
              <button
                type="button"
                onClick={() => setSpySwapStep('opponent')}
                className="rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 font-bold text-slate-300 hover:text-white cursor-pointer text-[11px] active:scale-95"
              >
                Back
              </button>
              <button
                type="button"
                onClick={cancelSpySwap}
                className="rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 font-bold text-slate-400 hover:text-white cursor-pointer text-[11px] active:scale-95"
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
    const meta = CARD_META[pickingTargetFor];
    return (
      <div className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-purple-400/80 bg-gradient-to-r from-purple-950 via-slate-900 to-slate-950 px-2.5 py-1 text-xs text-purple-100 shadow-md ring-1 ring-purple-500/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-500/20 border border-purple-400/60 shrink-0">
            {meta?.icon}
          </div>
          <span className="font-bold text-slate-100 text-[11px] truncate">
            Target:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          {opponents.map(opponent => (
            <button
              key={opponent.id}
              disabled={busy}
              onClick={() => { onUseTargeted(pickingTargetFor, opponent.id); setPickingTargetFor(null); }}
              className="rounded-md border border-purple-400/50 bg-purple-950/70 hover:bg-purple-800/90 px-2 py-0.5 font-bold text-[11px] text-purple-200 hover:text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer active:scale-95"
            >
              {opponent.display_name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickingTargetFor(null)}
            className="rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (pickingLetter) {
    return (
      <div className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-fuchsia-400/80 bg-gradient-to-r from-fuchsia-950 via-slate-900 to-slate-950 px-2.5 py-1 text-xs text-fuchsia-100 shadow-md ring-1 ring-fuchsia-500/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs">🚫</span>
          <span className="font-bold text-slate-100 text-[11px] truncate">Ban Letter:</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            autoFocus
            maxLength={1}
            value={letterDraft}
            onChange={e => setLetterDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              const letter = letterDraft.trim();
              if (/^[A-Za-z]$/.test(letter)) { onUseBanLetter(letter); setPickingLetter(false); setLetterDraft(''); }
            }}
            className="w-7 h-7 rounded-md border border-fuchsia-400/80 bg-fuchsia-950/90 text-center uppercase text-sm font-black text-white outline-none focus:ring-2 focus:ring-fuchsia-400"
          />
          <button
            type="button"
            disabled={busy || !/^[A-Za-z]$/.test(letterDraft.trim())}
            onClick={() => { onUseBanLetter(letterDraft.trim()); setPickingLetter(false); setLetterDraft(''); }}
            className="rounded-md bg-gradient-to-r from-fuchsia-500 to-pink-500 px-2.5 py-0.5 font-black text-white hover:brightness-110 shadow-sm disabled:opacity-40 transition-all cursor-pointer uppercase text-[11px] active:scale-95"
          >
            Ban
          </button>
          <button
            type="button"
            onClick={() => { setPickingLetter(false); setLetterDraft(''); }}
            className="rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (confirmingSimpleCard) {
    const meta = CARD_META[confirmingSimpleCard];
    const isHeal = confirmingSimpleCard === 'HEAL';
    const isHint = confirmingSimpleCard === 'HINT';
    const label = isHint ? 'Hint (3 moves)' : isHeal ? 'Heal (+1 HP)' : 'Shield (Defense)';

    return (
      <div className={`flex w-full items-center justify-between gap-1.5 rounded-lg border px-2 py-0.5 text-xs shadow-md select-none ${
        isHint
          ? 'border-amber-500/80 bg-gradient-to-r from-amber-950 via-yellow-950 to-slate-950 text-amber-100 ring-1 ring-amber-500/40'
          : isHeal
          ? 'border-rose-500/80 bg-gradient-to-r from-rose-950 via-pink-950 to-slate-950 text-rose-100 ring-1 ring-rose-500/40'
          : 'border-blue-500/80 bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-950 text-blue-100 ring-1 ring-blue-500/40'
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`flex items-center justify-center w-5 h-5 rounded-md border shrink-0 ${
            isHint
              ? 'bg-amber-500/20 border-amber-400/60'
              : isHeal
              ? 'bg-rose-500/20 border-rose-400/60'
              : 'bg-blue-500/20 border-blue-400/60'
          }`}>
            {meta?.icon}
          </div>
          <span className="font-bold text-slate-100 text-[11px] truncate">
            Use {label}?
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
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-black hover:brightness-110 active:scale-95 disabled:opacity-50 transition-colors cursor-pointer ${
              isHint
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950 shadow-sm'
                : isHeal
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Confirm</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmingSimpleCard(null)}
            className="rounded-md border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const maxSlots = 3;
  const slotCards = cards.slice(0, maxSlots);

  return (
    <div className="flex w-full items-center justify-between gap-1.5 sm:gap-2 mb-0.5 select-none">
      {[0, 1, 2].map(slotIndex => {
        const card = slotCards[slotIndex];
        if (!card || !CARD_META[card]) {
          return (
            <div
              key={`empty-card-slot-${slotIndex}`}
              title={`Card Slot ${slotIndex + 1} (Empty)`}
              className="group relative flex h-7 sm:h-7.5 flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-400/30 bg-gradient-to-b from-sky-950/40 via-slate-900/60 to-slate-950/80 px-2 py-0.5 select-none shadow-[inset_0_1px_3px_rgba(0,0,0,0.7)] transition-all"
            >
              <div className="flex items-center justify-center w-3.5 h-3.5 rounded bg-sky-400/15 border border-sky-300/40 text-sky-300">
                <span className="text-[9px] font-black">{slotIndex + 1}</span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-extrabold tracking-wider text-sky-300/80">
                CARD {slotIndex + 1}
              </span>
            </div>
          );
        }

        const meta = CARD_META[card];
        const disabled = busy || (meta.ownTurnOnly && !isMyTurn) || (card === 'MOVE_HEAL' && !hasStagedMove);

        return (
          <button
            key={`card-slot-${slotIndex}-${card}`}
            type="button"
            disabled={disabled}
            title={meta.ownTurnOnly && !isMyTurn ? 'Available only during your turn' : `Click to use ${meta.label}`}
            onClick={() => {
              if (card === 'FREEZE_TILE' || card === 'DESTROY_TILE') {
                onArmBoardCard(card as BoardCard);
              } else if (card === 'DOUBLE_DAMAGE') {
                setPickingTargetFor(card);
              } else if (card === 'SPY_SWAP') {
                setSpySwapStep('own');
                setSpyOwnTileIds([]);
              } else if (card === 'BAN_LETTER') {
                setPickingLetter(true);
              } else if (card === 'MOVE_HEAL') {
                onUseMoveHeal();
              } else if (card === 'HEAL' || card === 'HINT' || card === 'SHIELD') {
                setConfirmingSimpleCard(card);
              } else {
                onUseSimple(card as SimpleCard);
              }
            }}
            className={`group relative flex h-7 sm:h-7.5 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold transition-all duration-150 cursor-pointer select-none active:scale-[0.97] focus-visible:outline-none ${
              disabled
                ? 'border-slate-700/60 bg-slate-900/60 text-slate-500 cursor-not-allowed opacity-60'
                : `bg-gradient-to-r ${meta.bgGradient} ${meta.borderColor} ${meta.textColor} ${meta.glowClass} shadow-md hover:brightness-110`
            }`}
          >
            {/* Icon */}
            <div className="relative z-10 flex shrink-0 items-center scale-90">
              {meta.icon}
            </div>

            {/* Card Label */}
            <span className="relative z-10 text-[10.5px] sm:text-[11px] font-bold tracking-wide leading-none truncate">
              {meta.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});
