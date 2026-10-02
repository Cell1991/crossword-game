'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Layers, X } from 'lucide-react';
import { TILE_THEME_STYLE } from '@/lib/tileTheme';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const subscribeToNothing = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;

interface TileBagDialogProps {
  tileBagCount: number;
  tileBagCounts: Record<string, number>;
  onClose: () => void;
}

/** How many of each letter are still in the bag. Portal mounted to document.body to avoid CSS transform clipping. */
export const TileBagDialog: React.FC<TileBagDialogProps> = ({ tileBagCount, tileBagCounts, onClose }) => {
  const mounted = useSyncExternalStore(subscribeToNothing, getClientMounted, getServerMounted);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mounted) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      style={TILE_THEME_STYLE}
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md select-none"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        initial={{ opacity: 0, scale: 0.93, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 26, stiffness: 380 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remaining-letters-title"
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }
        }}
        className="flex max-h-[88vh] sm:max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-500/40 bg-slate-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(251,191,36,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-amber-400/20"
      >
        {/* Top Atmospheric Aura */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />

        {/* Dialog Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/70 px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/60 bg-gradient-to-br from-amber-500/30 via-yellow-600/40 to-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.4)]">
              <Layers className="h-5 w-5 text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="remaining-letters-title" className="text-sm sm:text-base font-black tracking-wide text-white uppercase">
                Remaining Tiles
              </h2>
              <p className="text-xs font-mono font-bold text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
                {tileBagCount} <span className="text-[11px] font-normal text-slate-400">tiles left in bag</span>
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/90 text-slate-400 hover:border-slate-500 hover:bg-slate-800 hover:text-white transition-all cursor-pointer active:scale-90 shadow-sm"
            aria-label="Close remaining letters"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tiles Grid List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {LETTERS.map((letter) => {
              const count = tileBagCounts[letter] ?? 0;
              return (
                <div
                  key={letter}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-2 sm:p-2.5 transition-all ${
                    count === 0
                      ? 'border-slate-800/60 bg-slate-950/60 opacity-35'
                      : 'border-slate-700/80 bg-slate-900/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] hover:border-amber-400/50 hover:bg-slate-850'
                  }`}
                  aria-label={`${letter}, ${count} remaining`}
                >
                  <span className="tile-face tile-letter tile-letter-orange flex h-9 w-9 items-center justify-center rounded-lg border border-amber-100/80 font-maple text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_8px_rgba(0,0,0,0.35)] shrink-0">
                    {letter}
                  </span>
                  <span className={`min-w-5 text-right font-mono text-sm font-black ${count === 0 ? 'text-slate-600' : 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]'}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Blank Wildcard Tiles Row */}
          <div className={`flex items-center justify-between rounded-xl border p-2.5 sm:p-3 transition-all ${
            (tileBagCounts.BLANK ?? 0) === 0
              ? 'border-slate-800/60 bg-slate-950/60 opacity-35'
              : 'border-amber-500/30 bg-slate-900/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]'
          }`}>
            <div className="flex items-center gap-3">
              <span className="tile-face flex h-9 w-9 items-center justify-center rounded-lg border border-amber-100/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] shrink-0">
                <svg viewBox="0 0 24 24" className="tile-blank-star h-5 w-5 text-amber-300" fill="currentColor" aria-hidden="true">
                  <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
                </svg>
              </span>
              <span className="text-sm font-bold text-slate-200">Wildcard Blank Tiles</span>
            </div>
            <span className="font-mono text-sm font-black text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]">
              {tileBagCounts.BLANK ?? 0}
            </span>
          </div>
        </div>
      </motion.section>
    </motion.div>,
    document.body
  );
};
