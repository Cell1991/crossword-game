'use client';

import React, { memo, useState } from 'react';
import { BoardCard, CellPosition, Player, Tile } from '@/lib/types';
import { isBlankLetter } from '@/lib/tiles';
import { cardIcon } from './cardIcons';
import { Sparkles, X, Check, ArrowRight, Shield, Zap, AlertTriangle } from 'lucide-react';

type SimpleCard = 'HINT' | 'HEAL' | 'SHIELD';
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
    label: 'Spell Word',
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
  onArmBoardCard,
  onCancelArm,
  onConfirmArmedCell,
  onCancelArmedCell,
  onCancelDeferredFreeze,
}: PowerCardBarProps) {
  const [pickingTargetFor, setPickingTargetFor] = useState<TargetedCard | null>(null);
  const [pickingLetter, setPickingLetter] = useState(false);
  const [letterDraft, setLetterDraft] = useState('');
  const [spySwapStep, setSpySwapStep] = useState<SpySwapStep | null>(null);
  const [spyOwnTileIds, setSpyOwnTileIds] = useState<string[]>([]);
  const [spyTargetPlayerId, setSpyTargetPlayerId] = useState<string | null>(null);
  const [spyTargetTileIndices, setSpyTargetTileIndices] = useState<number[]>([]);
  const [confirmingCard, setConfirmingCard] = useState<string | null>(null);

  const counts = new Map<string, number>();
  for (const card of cards) {
    if (CARD_META[card]) counts.set(card, (counts.get(card) ?? 0) + 1);
  }
  if (counts.size === 0 && armedCard === null && !deferredFreezeTileId) return null;

  if (deferredFreezeTileId) {
    return (
      <div className="flex flex-wrap items-center justify-between sm:justify-center gap-2 sm:gap-4 rounded-2xl border border-cyan-400/80 bg-gradient-to-r from-sky-950/95 via-cyan-950/90 to-slate-950/95 px-4 py-2 text-xs text-cyan-100 shadow-[0_8px_30px_rgba(6,182,212,0.35)] ring-1 ring-cyan-400/40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.4)]">
            <span className="text-sm">❄️</span>
          </div>
          <span className="font-medium text-slate-100">
            <strong className="text-cyan-300 font-bold">Freeze Marked</strong> — takes effect on move confirm
          </span>
        </div>
        <button
          type="button"
          onClick={onCancelDeferredFreeze}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-950/80 hover:bg-cyan-900/90 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <X className="w-3.5 h-3.5" />
          <span>Unmark</span>
        </button>
      </div>
    );
  }

  if (armedCard && pendingArmedCell) {
    const meta = CARD_META[armedCard];
    const verb = armedCard === 'DESTROY_TILE' ? 'Destroy' : 'Freeze';
    return (
      <div className="flex flex-wrap items-center justify-between sm:justify-center gap-2 sm:gap-4 rounded-2xl border border-rose-500/80 bg-gradient-to-r from-rose-950/95 via-slate-900/95 to-slate-950/95 px-4 py-2 text-xs text-rose-100 shadow-[0_8px_30px_rgba(244,63,94,0.4)] ring-1 ring-rose-500/50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-400/60 shadow-[0_0_12px_rgba(244,63,94,0.5)]">
            {meta?.icon}
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-rose-400">Target Selected</span>
            <p className="font-bold text-slate-100">{verb} this tile? <span className="text-rose-300 font-normal">Permanent</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmArmedCell}
            className="group relative flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-500 px-4 py-1.5 font-black text-white shadow-[0_0_16px_rgba(244,63,94,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <div className="pointer-events-none absolute inset-x-1.5 top-0.5 h-1/2 rounded-t-lg bg-gradient-to-b from-white/25 to-transparent" />
            <Check className="w-4 h-4 stroke-[3]" />
            <span className="tracking-wide uppercase text-[11px] sm:text-xs">Confirm {verb}</span>
          </button>
          <button
            type="button"
            onClick={onCancelArmedCell}
            className="rounded-xl border border-rose-400/40 bg-rose-950/70 hover:bg-rose-900 px-3 py-1.5 text-xs font-bold text-rose-200 hover:text-white transition-colors cursor-pointer"
          >
            Pick Another
          </button>
          <button
            type="button"
            onClick={onCancelArm}
            className="rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (armedCard) {
    const meta = CARD_META[armedCard];
    return (
      <div className="flex flex-wrap items-center justify-between sm:justify-center gap-2 sm:gap-4 rounded-2xl border border-cyan-400/80 bg-gradient-to-r from-cyan-950/95 via-slate-900/95 to-slate-950/95 px-4 py-2 text-xs text-cyan-100 shadow-[0_8px_30px_rgba(6,182,212,0.35)] ring-1 ring-cyan-500/40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.5)] animate-pulse">
            {meta?.icon}
          </div>
          <div className="text-left">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-cyan-400">Armed Power</span>
            <p className="font-bold text-slate-100">
              {armedCard === 'DESTROY_TILE' ? 'Select a board tile to clear' : 'Select a tile to freeze'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancelArm}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
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
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/80 bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-slate-950/95 p-3 text-xs text-emerald-100 shadow-[0_8px_30px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
        {spySwapStep === 'own' && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-400/60 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                {CARD_META.SPY_SWAP?.icon}
              </div>
              <span className="font-extrabold text-emerald-300">Give up to 3 tiles:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ownRack.map(tile => {
                const selected = spyOwnTileIds.includes(tile.id);
                return (
                  <button
                    key={tile.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleOwnTile(tile.id)}
                    className={`tile-face relative flex shrink-0 h-[46px] w-[40px] flex-col items-center justify-center overflow-hidden rounded-xl border font-sans cursor-pointer transition-all ${
                      selected ? 'border-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.7)] scale-105' : 'border-amber-100/80 hover:brightness-105'
                    }`}
                  >
                    <span className="tile-letter tile-letter-orange text-[26px] leading-none font-maple">
                      {tile.letter}
                    </span>
                    <span className="tile-score-blue absolute bottom-0.5 right-1 text-[10px] font-maple">
                      {tile.value}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="font-mono font-black text-emerald-300">{spyOwnTileIds.length}/3 Selected</span>
            <button
              type="button"
              disabled={!spyOwnTileIds.length || busy || !opponents.length}
              onClick={() => setSpySwapStep('opponent')}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-1.5 font-black text-slate-950 hover:brightness-110 shadow-[0_0_14px_rgba(16,185,129,0.6)] disabled:opacity-40 transition-all cursor-pointer uppercase text-xs"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {spySwapStep === 'opponent' && (
          <>
            <span className="font-extrabold text-emerald-300">Select target player:</span>
            <div className="flex flex-wrap gap-1.5">
              {opponents.map(opponent => (
                <button
                  key={opponent.id}
                  type="button"
                  disabled={busy || opponent.rack_count < spyOwnTileIds.length}
                  onClick={() => { setSpyTargetPlayerId(opponent.id); setSpyTargetTileIndices([]); setSpySwapStep('tiles'); }}
                  className="rounded-xl border border-emerald-400/50 bg-emerald-950/60 hover:bg-emerald-800/80 px-3.5 py-1.5 font-bold text-emerald-200 hover:text-white disabled:opacity-40 transition-all cursor-pointer shadow-sm"
                >
                  {opponent.display_name}
                </button>
              ))}
            </div>
          </>
        )}
        {spySwapStep === 'tiles' && selectedOpponent && (
          <>
            <span className="font-extrabold text-emerald-300">
              Pick {spyOwnTileIds.length} hidden tiles from {selectedOpponent.display_name}:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: selectedOpponent.rack_count }, (_, index) => {
                const selected = spyTargetTileIndices.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={!selected && spyTargetTileIndices.length >= spyOwnTileIds.length}
                    onClick={() => toggleTargetSlot(index)}
                    className={`h-11 w-9 rounded-xl border font-black text-sm transition-all cursor-pointer ${
                      selected
                        ? 'border-emerald-300 bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)] scale-105'
                        : 'border-slate-700 bg-slate-800/90 text-slate-300 hover:border-emerald-400 hover:text-white'
                    }`}
                  >
                    ?
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={busy || spyTargetTileIndices.length !== spyOwnTileIds.length}
              onClick={() => {
                onUseSpySwap(spyTargetPlayerId!, spyOwnTileIds, spyTargetTileIndices);
                cancelSpySwap();
              }}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-1.5 font-black text-slate-950 hover:brightness-110 shadow-[0_0_14px_rgba(16,185,129,0.6)] disabled:opacity-40 transition-all cursor-pointer uppercase text-xs"
            >
              Complete Swap
            </button>
            <button type="button" onClick={() => setSpySwapStep('opponent')} className="rounded-xl border border-slate-700 px-3 py-1.5 font-bold text-slate-300 hover:bg-slate-800 cursor-pointer">
              Back
            </button>
          </>
        )}
        <button type="button" onClick={cancelSpySwap} className="rounded-xl border border-slate-700 px-3 py-1.5 font-bold text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
          Cancel
        </button>
      </div>
    );
  }

  if (pickingTargetFor) {
    const meta = CARD_META[pickingTargetFor];
    return (
      <div className="flex flex-wrap items-center justify-between sm:justify-center gap-2 sm:gap-4 rounded-2xl border border-purple-400/80 bg-gradient-to-r from-purple-950/95 via-slate-900/95 to-slate-950/95 px-4 py-2 text-xs text-purple-100 shadow-[0_8px_30px_rgba(168,85,247,0.35)] ring-1 ring-purple-500/40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/60 shadow-[0_0_12px_rgba(168,85,247,0.5)]">
            {meta?.icon}
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-purple-400">Target Selection</span>
            <p className="font-bold text-slate-100">Cast {meta?.label} on player:</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {opponents.map(opponent => (
            <button
              key={opponent.id}
              disabled={busy}
              onClick={() => { onUseTargeted(pickingTargetFor, opponent.id); setPickingTargetFor(null); }}
              className="rounded-xl border border-purple-400/50 bg-purple-950/70 hover:bg-purple-800/90 px-3.5 py-1.5 font-bold text-purple-200 hover:text-white shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              {opponent.display_name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPickingTargetFor(null)}
            className="rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (pickingLetter) {
    return (
      <div className="flex flex-wrap items-center justify-between sm:justify-center gap-2 sm:gap-4 rounded-2xl border border-fuchsia-400/80 bg-gradient-to-r from-fuchsia-950/95 via-slate-900/95 to-slate-950/95 px-4 py-2 text-xs text-fuchsia-100 shadow-[0_8px_30px_rgba(217,70,239,0.35)] ring-1 ring-fuchsia-500/40 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/60 shadow-[0_0_12px_rgba(217,70,239,0.5)] text-sm">
            🚫
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-fuchsia-400">Runic Curse</span>
            <p className="font-bold text-slate-100">Choose letter to ban:</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            className="w-10 h-9 rounded-xl border border-fuchsia-400/80 bg-fuchsia-950/90 text-center uppercase text-lg font-black text-white outline-none focus:ring-2 focus:ring-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.4)]"
          />
          <button
            type="button"
            disabled={busy || !/^[A-Za-z]$/.test(letterDraft.trim())}
            onClick={() => { onUseBanLetter(letterDraft.trim()); setPickingLetter(false); setLetterDraft(''); }}
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 py-1.5 font-black text-white hover:brightness-110 shadow-[0_0_14px_rgba(217,70,239,0.6)] disabled:opacity-40 transition-all cursor-pointer uppercase text-xs"
          >
            Confirm Ban
          </button>
          <button
            type="button"
            onClick={() => { setPickingLetter(false); setLetterDraft(''); }}
            className="rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 font-bold text-slate-400 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (confirmingCard) {
    const meta = CARD_META[confirmingCard];
    return (
      <div className={`flex items-center justify-between sm:justify-center gap-2.5 sm:gap-4 w-full max-w-lg sm:w-auto rounded-2xl border bg-gradient-to-r ${meta?.bgGradient ?? 'from-cyan-950/95 via-slate-900/95 to-slate-950/95'} ${meta?.borderColor ?? 'border-cyan-400/80'} px-3.5 py-2 sm:px-5 sm:py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-white/20 backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-200 select-none`}>
        {/* Card Identity & Aura */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/90 border border-white/25 shadow-[0_0_14px_rgba(255,255,255,0.2)] shrink-0">
            <div className="drop-shadow-[0_0_6px_currentColor]">
              {meta?.icon}
            </div>
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="text-[9px] sm:text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
              Activate Power
            </span>
            <span className="text-xs sm:text-sm font-black text-white truncate drop-shadow">
              {meta?.label}
            </span>
          </div>
        </div>

        {/* High-Contrast Vibrant Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const card = confirmingCard;
              setConfirmingCard(null);
              if (card === 'DESTROY_TILE') onArmBoardCard(card as BoardCard);
              else if (card === 'DOUBLE_DAMAGE') setPickingTargetFor(card);
              else if (card === 'SPY_SWAP') { setSpySwapStep('own'); setSpyOwnTileIds([]); }
              else if (card === 'BAN_LETTER') setPickingLetter(true);
              else onUseSimple(card as SimpleCard);
            }}
            className="group relative flex items-center gap-1 sm:gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 px-3.5 py-1.5 sm:px-4 sm:py-2 text-slate-950 shadow-[0_0_18px_rgba(45,212,191,0.65),inset_0_1px_1px_rgba(255,255,255,0.8)] hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer font-black"
          >
            {/* Specular Top Shine */}
            <div className="pointer-events-none absolute inset-x-1.5 top-0.5 h-1/2 rounded-t-lg bg-gradient-to-b from-white/40 to-transparent" />
            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 stroke-[3]" />
            <span className="tracking-wide uppercase text-[11px] sm:text-xs">Use Card</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmingCard(null)}
            className="flex items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-600 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cancel</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1.5">
      {/* Sleek Header Badge */}
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-slate-400 uppercase select-none">
        <Sparkles className="w-3 h-3 text-cyan-400 drop-shadow-[0_0_4px_#22d3ee]" />
        <span>Power Cards Available</span>
      </div>

      {/* Card Items Dock */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 px-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-700/70 shadow-[0_4px_24px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] ring-1 ring-cyan-500/20">
        {[...counts.entries()].map(([card, count]) => {
          const meta = CARD_META[card];
          if (!meta) return null;
          const disabled = busy || (meta.ownTurnOnly && !isMyTurn) || (card === 'MOVE_HEAL' && !hasStagedMove);

          return (
            <button
              key={card}
              type="button"
              disabled={disabled}
              title={meta.ownTurnOnly && !isMyTurn ? 'Available only during your turn' : `Click to use ${meta.label}`}
              onClick={() => {
                if (card === 'FREEZE_TILE') onArmBoardCard(card as BoardCard);
                else setConfirmingCard(card);
              }}
              className={`group relative flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border bg-gradient-to-r transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                disabled
                  ? 'opacity-40 border-slate-800 bg-slate-900/60 text-slate-500 cursor-not-allowed'
                  : `${meta.bgGradient} ${meta.borderColor} ${meta.textColor} ${meta.glowClass} shadow-md hover:-translate-y-0.5`
              }`}
            >
              {/* Card Specular Top Highlight */}
              <div className="pointer-events-none absolute inset-x-2 top-0.5 h-1/3 rounded-t-lg bg-gradient-to-b from-white/15 to-transparent" />

              {/* Glowing Icon */}
              <div className="relative z-10 flex items-center shrink-0 drop-shadow-[0_0_6px_currentColor]">
                {meta.icon}
              </div>

              {/* Card Label */}
              <span className="relative z-10 text-xs sm:text-sm font-bold tracking-wide">
                {meta.label}
              </span>

              {/* Quantity Count Pill */}
              {count > 1 && (
                <span className={`relative z-10 px-1.5 py-0.2 rounded-full text-[10px] font-black font-mono shadow-sm ${meta.badgeBg}`}>
                  ×{count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
