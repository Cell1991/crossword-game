'use client';

import React from 'react';
import { Layers, ChevronRight, Sparkles } from 'lucide-react';

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
        className="group relative flex w-full items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-[#181636]/90 via-[#100f26]/95 to-[#090818]/95 hover:from-[#221f4a]/95 hover:to-[#12102e] border border-amber-400/35 hover:border-amber-300 shadow-[0_6px_24px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.18)] hover:shadow-[0_0_26px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl transition-all duration-200 cursor-pointer text-left select-none overflow-hidden active:scale-[0.98]"
        aria-label={`Show letter bag breakdown, ${tileBagCount} tiles remaining`}
      >
        {/* Celestial Glass Starlight Specular Shimmer */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />

        {/* Ambient Warm Stardust Nebula Glow */}
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/15 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/25 transition-all" />
        <div className="absolute -left-6 -top-6 w-20 h-20 bg-indigo-500/15 rounded-full blur-lg pointer-events-none" />

        {/* Left: Celestial Tile Bag Icon & Title */}
        <div className="flex items-center gap-2.5 min-w-0 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/35 via-amber-600/25 to-indigo-950/50 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-[0_0_14px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.35)] group-hover:scale-105 transition-transform">
            <Layers className="w-4.5 h-4.5 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-[13px] font-black tracking-wider text-slate-100 uppercase group-hover:text-amber-200 transition-colors flex items-center gap-1">
                TILE BAG
                <Sparkles className="w-2.5 h-2.5 text-amber-400/70" />
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wide">
              Tap for breakdown
            </span>
          </div>
        </div>

        {/* Right: Giant Golden Starlight Tile Count & Chevron */}
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <span className="inline-block pr-1 text-2xl sm:text-3xl font-black font-maple bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(245,158,11,0.7)] tabular-nums leading-none">
            {tileBagCount}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </button>
    </section>
  );
};
