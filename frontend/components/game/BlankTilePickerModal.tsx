'use client';

import React from 'react';
import { X } from 'lucide-react';
import { ConstellationGraphic } from '@/components/effects/ConstellationGraphic';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface BlankTilePickerModalProps {
  isOpen: boolean;
  onSelect: (letter: string) => void;
  onClose: () => void;
}

export const BlankTilePickerModal: React.FC<BlankTilePickerModalProps> = ({
  isOpen,
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center px-3 pb-24 sm:items-center sm:pb-0"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="เลือกตัวอักษรสำหรับแผ่น Blank"
        className="pointer-events-auto relative w-full max-w-[31rem] overflow-hidden rounded-[1.35rem] border border-cyan-400/45 bg-[#071326]/[.98] p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.7),0_0_34px_rgba(14,165,233,0.2)] animate-fadeIn"
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-80" />
        <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-cyan-400/15 pb-3">
          <div className="tile-face flex h-9 w-9 items-center justify-center rounded-xl border border-amber-100/70 shadow-[0_0_18px_rgba(34,211,238,0.2)]">
            <svg viewBox="0 0 24 24" className="tile-blank-star h-5 w-5" fill="currentColor">
              <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
            </svg>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-300/55 bg-gradient-to-br from-cyan-400/20 via-blue-500/15 to-slate-900/70 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_16px_rgba(34,211,238,0.2)] transition-all hover:border-cyan-200 hover:bg-cyan-300/25 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_0_22px_rgba(34,211,238,0.55)] active:scale-95"
            aria-label="Close"
          >
            <span className="absolute inset-1 rounded-lg border border-white/10 transition-colors group-hover:border-cyan-100/35" />
            <X className="relative h-6 w-6 stroke-[1.7] drop-shadow-[0_0_5px_rgba(165,243,252,0.7)]" />
          </button>
        </div>

        {/* Letters A-Z Grid */}
        <div className="relative grid max-h-[42vh] grid-cols-6 justify-center gap-2 overflow-x-hidden overflow-y-auto py-4 sm:grid-cols-7">
          {LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => onSelect(letter)}
              className="tile-face group relative flex h-12 w-11 flex-col items-center justify-center overflow-hidden rounded-xl border border-amber-100/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_10px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-0.5 hover:scale-[1.03] hover:border-amber-300 hover:brightness-110 hover:shadow-[0_0_14px_rgba(251,191,36,0.18)] active:translate-y-0 active:scale-95 sm:h-14 sm:w-13"
            >
              {/* Glass Top Bevel Highlight */}
              <div className="absolute inset-x-1 top-0.5 h-[35%] rounded-t-lg bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
              <ConstellationGraphic
                letter={letter}
                className="opacity-80 transition-opacity group-hover:opacity-100"
              />

              <span className="tile-letter tile-letter-orange relative z-10 text-2xl font-maple sm:text-[1.7rem]">
                {letter}
              </span>
              <span className="tile-score-blue absolute bottom-0.5 right-1 text-[9px] font-mono font-black opacity-75 group-hover:opacity-100">
                0
              </span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};
