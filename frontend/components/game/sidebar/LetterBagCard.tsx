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
        className="group relative flex w-full items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-[#122238]/90 via-[#0d1a2d]/95 to-[#081220]/95 hover:from-[#193050]/95 hover:to-[#0f1f35] border border-amber-400/40 hover:border-amber-300 shadow-[0_4px_20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_0_24px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-xl transition-all duration-200 cursor-pointer text-left select-none overflow-hidden active:scale-[0.98]"
        aria-label={`Show letter bag breakdown, ${tileBagCount} tiles remaining`}
      >
        {/* Top Gloss Specular Layer */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

        {/* Ambient warm gold glow in background */}
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/15 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/25 transition-all" />

        {/* Left: 3D Tile Stack Icon & Title */}
        <div className="flex items-center gap-2.5 min-w-0 relative z-10">
          <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-b from-amber-400/30 via-amber-600/20 to-amber-950/40 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.3)] group-hover:scale-105 transition-transform">
            <Layers className="w-4.5 h-4.5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm font-black tracking-wider text-slate-100 uppercase font-mono group-hover:text-amber-300 transition-colors">
                TILE BAG
              </span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wide">
              Tap for breakdown
            </span>
          </div>
        </div>

        {/* Right: Giant Golden Tile Count & Chevron */}
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <span className="text-2xl sm:text-3xl font-black font-maple bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(245,158,11,0.7)] tabular-nums leading-none">
            {tileBagCount}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </button>
    </section>
  );
};
