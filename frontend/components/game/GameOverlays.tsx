'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { CardReveal, PendingEffect } from '@/lib/types';
import { cardIcon } from './cardIcons';

/** Pending DAMAGE/SWAP effect: a short SHIELD window before it lands. */
export const PendingEffectBanner: React.FC<{
  effect: PendingEffect;
  canShield: boolean;
  busy: boolean;
  onShield: () => void;
}> = ({ effect, canShield, busy, onShield }) => (
  <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-sky-950/90 border border-sky-500/50 text-sky-200 text-sm px-4 py-2 rounded-xl shadow-xl">
    <span>{effect.type === 'SWAP' ? '🔄 A tile swap is pending…' : '⚔️ Damage is pending…'}</span>
    {canShield && (
      <button
        onClick={onShield}
        disabled={busy}
        title="Block this incoming effect"
        className="flex items-center gap-1.5 rounded-full border border-red-400/80 bg-red-950/80 px-3 py-1 text-xs font-bold text-red-100 shadow-[0_0_16px_rgba(248,113,113,0.65)] transition hover:bg-red-800 disabled:opacity-50"
      >
        <span className="text-base leading-none">🛡️</span>
        <span>Shield</span>
      </button>
    )}
  </div>
);

/** The card a player just earned: a lightning flash, then the card face. */
export const CardRevealOverlay: React.FC<{ reveal: CardReveal }> = ({ reveal }) => (
  <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
    <div className={`flex h-56 w-40 flex-col items-center justify-center rounded-2xl border-4 border-red-500/90 bg-slate-950/90 shadow-[0_0_35px_rgba(14,165,233,0.75),inset_0_0_28px_rgba(14,165,233,0.24)] transition-all duration-300 ${reveal.phase === 'lightning' ? 'scale-100' : 'scale-110'}`}>
      {reveal.phase === 'lightning' ? (
        <>
          <div className="flex items-center justify-center gap-1 text-yellow-300 drop-shadow-[0_0_16px_rgba(250,204,21,0.95)]">
            <Zap className="h-9 w-9 fill-yellow-300 text-yellow-100 animate-pulse" />
            <Zap className="h-24 w-24 fill-yellow-300 text-yellow-100 animate-pulse" />
            <Zap className="h-9 w-9 fill-yellow-300 text-yellow-100 animate-pulse" />
          </div>
          <span className="mt-3 text-xs font-bold uppercase tracking-[0.35em] text-cyan-200">Power</span>
        </>
      ) : (
        <>
          <span className="text-7xl leading-none drop-shadow-[0_0_20px_rgba(125,211,252,1)]">
            {cardIcon(reveal.card, 'h-20 w-20', <span className="text-6xl font-black text-amber-300">×2</span>) ?? '✨'}
          </span>
          <span className="mt-3 text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Card found</span>
        </>
      )}
    </div>
  </div>
);

/** Toasts stack instead of sitting on top of each other, and stay clear of the zoom controls. */
export const ToastStack: React.FC<{ info: string | null; error: string }> = ({ info, error }) => {
  if (!info && !error) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex w-max max-w-[calc(100%-9rem)] -translate-x-1/2 flex-col items-center gap-2">
      {info && (
        <div className="rounded-xl border border-emerald-600/50 bg-emerald-900/90 px-4 py-2 text-center text-sm text-emerald-200 shadow-xl">
          ✨ {info}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-600/50 bg-red-900/90 px-4 py-2 text-center text-sm text-red-200 shadow-xl">
          {error}
        </div>
      )}
    </div>
  );
};
