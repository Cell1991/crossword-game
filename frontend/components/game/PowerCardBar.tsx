'use client';

import React, { memo, useState } from 'react';
import { BoardCard, Player } from '@/lib/types';
import { cardIcon } from './cardIcons';

type SimpleCard = 'HINT' | 'HEAL' | 'SHIELD';
type TargetedCard = 'DOUBLE_DAMAGE' | 'SPY_SWAP';

const cardMeta = (card: string, label: string, ownTurnOnly: boolean) => ({ icon: cardIcon(card, 'h-4 w-4', '×2'), label, ownTurnOnly });

const CARD_META: Record<string, { icon: React.ReactNode; label: string; ownTurnOnly: boolean }> = {
  HINT: cardMeta('HINT', 'Spell Word', true),
  SPY_SWAP: cardMeta('SPY_SWAP', 'Swap Word', false),
  DESTROY_TILE: cardMeta('DESTROY_TILE', 'Clear Word', false),
  HEAL: cardMeta('HEAL', 'Heal', false),
  DOUBLE_DAMAGE: cardMeta('DOUBLE_DAMAGE', 'Word x2', true),
  SHIELD: cardMeta('SHIELD', 'Shield', false),
  FREEZE_TILE: cardMeta('FREEZE_TILE', 'Freeze Word', true),
};

interface PowerCardBarProps {
  cards: string[];
  opponents: Player[];
  isMyTurn: boolean;
  hasStagedMove: boolean;
  armedCard: BoardCard | null;
  busy: boolean;
  onUseSimple: (card: SimpleCard) => void;
  onUseTargeted: (card: TargetedCard, targetPlayerId: string) => void;
  onUseBanLetter: (letter: string) => void;
  onArmBoardCard: (card: BoardCard) => void;
  onCancelArm: () => void;
}

export const PowerCardBar = memo(function PowerCardBar({
  cards,
  opponents,
  isMyTurn,
  hasStagedMove,
  armedCard,
  busy,
  onUseSimple,
  onUseTargeted,
  onUseBanLetter,
  onArmBoardCard,
  onCancelArm,
}: PowerCardBarProps) {
  const [pickingTargetFor, setPickingTargetFor] = useState<TargetedCard | null>(null);
  const [pickingLetter, setPickingLetter] = useState(false);
  const [letterDraft, setLetterDraft] = useState('');
  const [confirmingCard, setConfirmingCard] = useState<string | null>(null);

  const counts = new Map<string, number>();
  for (const card of cards) {
    if (CARD_META[card]) counts.set(card, (counts.get(card) ?? 0) + 1);
  }
  if (counts.size === 0 && armedCard === null) return null;

  if (armedCard) {
    const meta = CARD_META[armedCard];
    return (
      <div className="flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-950/60 px-3 py-1.5 text-xs text-cyan-200">
        <span className="flex items-center gap-1.5">{meta.icon} Pick a board tile{armedCard === 'DESTROY_TILE' ? ' to destroy' : ' to freeze'}</span>
        <button
          onClick={onCancelArm}
          className="rounded-full border border-cyan-300/40 px-2 py-0.5 text-[11px] hover:bg-cyan-900"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (pickingTargetFor) {
    const meta = CARD_META[pickingTargetFor];
    return (
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-950/60 px-3 py-1.5 text-xs text-amber-200">
        <span className="flex items-center gap-1.5">{meta.icon} Target:</span>
        {opponents.map(opponent => (
          <button
            key={opponent.id}
            disabled={busy}
            onClick={() => { onUseTargeted(pickingTargetFor, opponent.id); setPickingTargetFor(null); }}
            className="rounded-full border border-amber-300/40 px-2 py-0.5 hover:bg-amber-900 disabled:opacity-50"
          >
            {opponent.display_name}
          </button>
        ))}
        <button
          onClick={() => setPickingTargetFor(null)}
          className="rounded-full border border-amber-300/20 px-2 py-0.5 text-amber-300/70 hover:bg-amber-900"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (pickingLetter) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-fuchsia-400/50 bg-fuchsia-950/60 px-3 py-1.5 text-xs text-fuchsia-200">
        <span>🚫 Letter to ban:</span>
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
          className="w-8 rounded border border-fuchsia-300/40 bg-fuchsia-900/60 px-1 py-0.5 text-center uppercase text-white outline-none"
        />
        <button
          disabled={busy || !/^[A-Za-z]$/.test(letterDraft.trim())}
          onClick={() => { onUseBanLetter(letterDraft.trim()); setPickingLetter(false); setLetterDraft(''); }}
          className="rounded-full border border-fuchsia-300/40 px-2 py-0.5 hover:bg-fuchsia-900 disabled:opacity-40"
        >
          Ban
        </button>
        <button
          onClick={() => { setPickingLetter(false); setLetterDraft(''); }}
          className="rounded-full border border-fuchsia-300/20 px-2 py-0.5 text-fuchsia-300/70 hover:bg-fuchsia-900"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (confirmingCard) {
    const meta = CARD_META[confirmingCard];
    return (
      <div className="flex items-center gap-2 rounded-xl border border-cyan-400/60 bg-slate-950/90 px-3 py-1.5 text-xs text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.2)]">
        <span className="flex items-center">{meta.icon}</span>
        <span>Use {meta.label}?</span>
        <button
          disabled={busy}
          onClick={() => {
            const card = confirmingCard;
            setConfirmingCard(null);
            if (card === 'FREEZE_TILE' || card === 'DESTROY_TILE') onArmBoardCard(card as BoardCard);
              else if (card === 'DOUBLE_DAMAGE' || card === 'SPY_SWAP') setPickingTargetFor(card as TargetedCard);
            else if (card === 'BAN_LETTER') setPickingLetter(true);
            else onUseSimple(card as SimpleCard);
          }}
          className="rounded-full bg-cyan-500 px-3 py-1 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
        >
          Use
        </button>
        <button
          onClick={() => setConfirmingCard(null)}
          className="rounded-full border border-slate-500/60 px-3 py-1 text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...counts.entries()].map(([card, count]) => {
        const meta = CARD_META[card];
        const disabled = busy || (meta.ownTurnOnly && !isMyTurn) || (card === 'MOVE_HEAL' && !hasStagedMove);
        return (
          <button
            key={card}
            disabled={disabled}
            title={meta.ownTurnOnly ? 'Use on your turn' : undefined}
            onClick={() => {
              setConfirmingCard(card);
            }}
            className="flex items-center gap-1 rounded-full border border-indigo-400/40 bg-indigo-950/60 px-2.5 py-1 text-xs font-semibold text-indigo-100 hover:bg-indigo-900 disabled:opacity-40 disabled:hover:bg-indigo-950/60"
          >
            <span className="flex items-center">{meta.icon}</span>
            <span>{meta.label}</span>
            {count > 1 && <span className="text-indigo-300/70">×{count}</span>}
          </button>
        );
      })}
    </div>
  );
});
