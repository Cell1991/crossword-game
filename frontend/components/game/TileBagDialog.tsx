'use client';

import React, { useEffect, useRef } from 'react';
import { Layers, X } from 'lucide-react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface TileBagDialogProps {
  tileBagCount: number;
  tileBagCounts: Record<string, number>;
  onClose: () => void;
}

/** How many of each letter are still in the bag. Escape, the close button or a backdrop click closes it. */
export const TileBagDialog: React.FC<TileBagDialogProps> = ({ tileBagCount, tileBagCounts, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="remaining-letters-title"
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }
        }}
        className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-cyan-500/40 bg-slate-950/95 shadow-[0_0_35px_rgba(6,182,212,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)]"
      >
        <div className="flex items-start justify-between border-b border-slate-800/80 bg-slate-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/50 bg-gradient-to-br from-cyan-500/30 via-blue-600/40 to-slate-900 shadow-[0_0_12px_rgba(6,182,212,0.35)]">
              <Layers className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            </div>
            <div>
              <h2 id="remaining-letters-title" className="text-sm font-bold tracking-wide text-white">Remaining Letters</h2>
              <p className="mt-0.5 text-xs font-mono text-cyan-300">{tileBagCount} tiles remaining</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700/80 p-1.5 text-slate-400 hover:border-cyan-400/50 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            aria-label="Close remaining letters"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {LETTERS.map((letter) => {
              const count = tileBagCounts[letter] ?? 0;
              return (
                <div
                  key={letter}
                  className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 ${
                    count === 0
                      ? 'border-slate-800/60 bg-slate-950/60 opacity-45'
                      : 'border-blue-500/30 bg-slate-900/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]'
                  }`}
                  aria-label={`${letter}, ${count} remaining`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/50 bg-gradient-to-b from-[#23407a] via-[#1a305e] to-[#122244] font-quakduck text-2xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_0_8px_rgba(56,189,248,0.16)]">
                    {letter}
                  </span>
                  <span className="min-w-5 text-right font-mono text-sm font-bold text-amber-400">{count}</span>
                </div>
              );
            })}
          </div>
          <div className={`mt-3 flex items-center justify-between rounded-xl border p-3 ${
            (tileBagCounts.BLANK ?? 0) === 0
              ? 'border-slate-800/60 bg-slate-950/60 opacity-45'
              : 'border-blue-500/30 bg-slate-900/80'
          }`}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/50 bg-gradient-to-b from-[#23407a] via-[#1a305e] to-[#122244] text-lg font-bold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">*</span>
              <span className="text-sm font-medium text-slate-200">Blank Tiles</span>
            </div>
            <span className="font-mono text-sm font-bold text-amber-400">{tileBagCounts.BLANK ?? 0}</span>
          </div>
        </div>
      </section>
    </div>
  );
};
