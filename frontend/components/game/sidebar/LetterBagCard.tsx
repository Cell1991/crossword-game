'use client';

import React from 'react';
import { Layers, ChevronRight } from 'lucide-react';

interface LetterBagCardProps {
  tileBagCount: number;
  onClick: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

export const LetterBagCard: React.FC<LetterBagCardProps> = ({
  tileBagCount,
  onClick,
  buttonRef,
}) => {
  return (
    <section aria-label="Letter bag summary" className="w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        className="group relative flex w-full items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-[#172b47]/80 via-[#0f1d32]/90 to-[#091322]/95 hover:from-[#1e385c]/90 hover:to-[#12223b] border border-amber-400/30 hover:border-amber-400/60 shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] backdrop-blur-xl transition-all duration-200 cursor-pointer text-left select-none overflow-hidden"
        aria-label={`Show letter bag breakdown, ${tileBagCount} tiles remaining`}
      >
        {/* Decorative ambient amber warmth */}
        <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

        {/* Left: Icon & Label */}
        <div className="flex items-center gap-2.5 min-w-0 relative z-10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-amber-400/25 to-amber-950/40 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.3)] group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4 text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-[10px] font-black tracking-widest text-amber-300/80 uppercase font-mono">
              TILE BAG
            </span>
            <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
              Remaining Tiles
            </span>
          </div>
        </div>

        {/* Right: Big Crisp Gold Count + Arrow */}
        <div className="flex items-center gap-1.5 shrink-0 relative z-10">
          <span className="text-2xl sm:text-3xl font-black font-maple bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(245,158,11,0.6)] tabular-nums leading-none">
            {tileBagCount}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </button>
    </section>
  );
};
