'use client';

import React from 'react';
import { CircleCheck, ShieldAlert, Zap } from 'lucide-react';
import { CardReveal, PendingEffect } from '@/lib/types';
import { cardIcon } from './cardIcons';

/** Pending DAMAGE/SWAP effect: a short SHIELD window before it lands. */
export const PendingEffectBanner: React.FC<{
  effect: PendingEffect;
  canShield: boolean;
  busy: boolean;
  onShield: () => void;
}> = ({ effect, canShield, busy, onShield }) => (
  <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gradient-to-r from-sky-950/95 via-slate-950/95 to-sky-950/95 border border-sky-400/60 text-sky-200 text-sm font-semibold px-5 py-2.5 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_24px_rgba(56,189,248,0.35)] backdrop-blur-md">
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
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-2 sm:top-4">
      {info && (
        <div role="status" aria-live="polite" className="pointer-events-auto relative block w-fit max-w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-950/90 via-slate-950/95 to-emerald-950/90 px-12 py-3.5 sm:px-14 sm:py-4 text-center text-sm font-semibold tracking-wide text-emerald-100 shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/20 backdrop-blur-md animate-fadeIn">
          <span className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-90" />
          <span className="absolute left-3.5 sm:left-4 top-1/2 flex h-8 w-8 sm:h-9 sm:w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.4)]">
            <CircleCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="block break-words leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{info}</span>
        </div>
      )}
      {error && (
        <div role="alert" aria-live="assertive" className="pointer-events-auto relative block w-fit max-w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-950/90 via-slate-950/95 to-rose-950/90 px-12 py-3.5 sm:px-14 sm:py-4 text-center text-sm font-semibold tracking-wide text-rose-100 shadow-[0_14px_40px_rgba(0,0,0,0.7),0_0_28px_rgba(244,63,94,0.4)] ring-1 ring-rose-400/30 backdrop-blur-md animate-fadeIn">
          <span className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-rose-400 to-transparent opacity-90 shadow-[0_0_8px_#fb7185]" />
          <span className="absolute left-3.5 sm:left-4 top-1/2 flex h-8 w-8 sm:h-9 sm:w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-rose-400/50 bg-rose-500/25 text-rose-300 shadow-[0_0_18px_rgba(251,113,133,0.5)]">
            <ShieldAlert className="h-5 w-5 fill-rose-400/20 stroke-[2] drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]" aria-hidden="true" />
          </span>
          <span className="block break-words leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{error}</span>
        </div>
      )}
    </div>
  );
};
