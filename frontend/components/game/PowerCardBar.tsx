'use client';

import React, { useState } from 'react';
import { Player } from '../../lib/types';

type SimpleCard = 'HINT' | 'FREE_EXCHANGE' | 'MOVE_HEAL' | 'DRAW_TILE' | 'HEAL';
type TargetedCard = 'DOUBLE_DAMAGE' | 'STEAL_TILE';
type BoardCard = 'FREEZE_TILE' | 'DESTROY_TILE';

const CARD_META: Record<string, { icon: string; label: string; ownTurnOnly: boolean }> = {
  HINT: { icon: '💡', label: 'Hint', ownTurnOnly: true },
  FREE_EXCHANGE: { icon: '♻️', label: 'Free Exchange', ownTurnOnly: false },
  MOVE_HEAL: { icon: '❤️‍🩹', label: 'Heal', ownTurnOnly: true },
  DOUBLE_DAMAGE: { icon: '⚔️', label: 'Double Damage', ownTurnOnly: true },
  FREEZE_TILE: { icon: '❄️', label: 'Freeze', ownTurnOnly: true },
  DRAW_TILE: { icon: '🎴', label: 'Draw Tile', ownTurnOnly: false },
  HEAL: { icon: '💗', label: 'Heal (Rack)', ownTurnOnly: false },
  STEAL_TILE: { icon: '🕵️', label: 'Steal Tile', ownTurnOnly: false },
  DESTROY_TILE: { icon: '💥', label: 'Destroy Tile', ownTurnOnly: false },
  BAN_LETTER: { icon: '🚫', label: 'Ban Letter', ownTurnOnly: false },
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

export const PowerCardBar: React.FC<PowerCardBarProps> = ({
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
}) => {
  const [pickingTargetFor, setPickingTargetFor] = useState<TargetedCard | null>(null);
  const [pickingLetter, setPickingLetter] = useState(false);
  const [letterDraft, setLetterDraft] = useState('');

  const counts = new Map<string, number>();
  for (const card of cards) {
    if (CARD_META[card]) counts.set(card, (counts.get(card) ?? 0) + 1);
  }
  if (counts.size === 0 && armedCard === null) return null;

  if (armedCard) {
    const meta = CARD_META[armedCard];
    return (
      <div className="flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-950/60 px-3 py-1.5 text-xs text-cyan-200">
        <span>{meta.icon} Pick a board tile{armedCard === 'DESTROY_TILE' ? ' to destroy' : ' to freeze'}</span>
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
        <span>{meta.icon} Target:</span>
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
              if (card === 'FREEZE_TILE' || card === 'DESTROY_TILE') onArmBoardCard(card);
              else if (card === 'DOUBLE_DAMAGE' || card === 'STEAL_TILE') setPickingTargetFor(card);
              else if (card === 'BAN_LETTER') setPickingLetter(true);
              else onUseSimple(card as SimpleCard);
            }}
            className="flex items-center gap-1 rounded-full border border-indigo-400/40 bg-indigo-950/60 px-2.5 py-1 text-xs font-semibold text-indigo-100 hover:bg-indigo-900 disabled:opacity-40 disabled:hover:bg-indigo-950/60"
          >
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
            {count > 1 && <span className="text-indigo-300/70">×{count}</span>}
          </button>
        );
      })}
    </div>
  );
};
