'use client';

import React from 'react';
import { CircleCheck, ShieldAlert, Zap, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CardReveal, PendingEffect } from '@/lib/types';
import { cardIcon } from './cardIcons';

/** Pending DAMAGE/SWAP effect: a short SHIELD window before it lands. */
export const PendingEffectBanner: React.FC<{
  effect: PendingEffect;
  canShield: boolean;
  busy: boolean;
  onShield: () => void;
}> = ({ effect, canShield, busy, onShield }) => (
  <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-gradient-to-r from-sky-950/95 via-slate-950/95 to-sky-950/95 border border-sky-400/60 text-sky-200 text-sm font-semibold px-5 py-2.5 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_24px_rgba(56,189,248,0.35)] sm:backdrop-blur-md">
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

import { EpicCardRevealOverlay, CardActivationOverlay } from './CardEffectsOverlay';

/** Re-export the epic 3D holographic card reveal overlay */
export const CardRevealOverlay = EpicCardRevealOverlay;
export { CardActivationOverlay };

/** Toasts stack with smooth spring animations, status glow, and interactive dismissal button. */
export const ToastStack: React.FC<{
  info: string | null;
  error: string;
  onDismissInfo?: () => void;
  onDismissError?: () => void;
  inline?: boolean;
  className?: string;
}> = ({ info, error, onDismissInfo, onDismissError, inline = false, className = '' }) => {
  return (
    <div className={inline ? `pointer-events-none flex flex-col items-center gap-2 w-full max-w-[calc(100%-2rem)] ${className}` : `pointer-events-none absolute left-1/2 top-3 z-30 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col items-center gap-2 sm:top-4 ${className}`}>
      <AnimatePresence>
        {info && (
          <motion.div
            key="toast-info"
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            role="status"
            aria-live="polite"
            className="pointer-events-auto relative flex items-center justify-between gap-3 w-fit max-w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-950/95 via-slate-950/95 to-emerald-950/95 pl-3.5 pr-2.5 py-2.5 sm:py-3 text-sm font-semibold tracking-wide text-emerald-100 shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/25 sm:backdrop-blur-md select-none"
          >
            <span className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-90" />
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.4)]">
                <CircleCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="break-words text-xs sm:text-sm leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-medium">
                {info}
              </span>
            </div>
            {onDismissInfo && (
              <button
                type="button"
                onClick={onDismissInfo}
                className="shrink-0 p-1 rounded-lg text-emerald-400/60 hover:text-emerald-200 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                title="Dismiss"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            key="toast-error"
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            role="alert"
            aria-live="assertive"
            className="pointer-events-auto relative flex items-center justify-between gap-3 w-fit max-w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-950/95 via-slate-950/95 to-rose-950/95 pl-3.5 pr-2.5 py-2.5 sm:py-3 text-sm font-semibold tracking-wide text-rose-100 shadow-[0_14px_40px_rgba(0,0,0,0.7),0_0_28px_rgba(244,63,94,0.4)] ring-1 ring-rose-400/30 sm:backdrop-blur-md select-none"
          >
            <span className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-rose-400 to-transparent opacity-90 shadow-[0_0_8px_#fb7185]" />
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl border border-rose-400/50 bg-rose-500/25 text-rose-300 shadow-[0_0_16px_rgba(251,113,133,0.5)]">
                <ShieldAlert className="h-4 w-4 fill-rose-400/20 stroke-[2] drop-shadow-[0_0_8px_rgba(251,113,133,0.8)]" aria-hidden="true" />
              </span>
              <span className="break-words text-xs sm:text-sm leading-snug drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] font-medium text-rose-200">
                {error}
              </span>
            </div>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="shrink-0 p-1 rounded-lg text-rose-400/60 hover:text-rose-200 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
                title="Dismiss"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
