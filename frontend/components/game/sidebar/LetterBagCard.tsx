'use client';

import React from 'react';
import { Layers } from 'lucide-react';

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
        className="group relative flex w-full items-center justify-between gap-2 p-2.5 rounded-xl bg-gradient-to-br from-[rgba(24,42,68,0.85)] via-[rgba(18,32,52,0.8)] to-[rgba(14,24,40,0.88)] hover:from-[rgba(30,54,88,0.9)] hover:to-[rgba(20,36,60,0.92)] border border-[rgba(120,160,200,0.22)] hover:border-[#F6C453]/50 shadow-[0_2px_12px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.35),0_0_16px_rgba(246,196,83,0.2)] transition-all duration-300 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C453]/60 select-none overflow-hidden"
        aria-label={`Show letter bag breakdown, ${tileBagCount} tiles remaining`}
      >
        {/* Subtle decorative glow orb */}
        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-[#F6C453]/10 rounded-full blur-lg pointer-events-none group-hover:bg-[#F6C453]/20 transition-all duration-300" />

        {/* Left: Section eyebrow & label with Layers icon */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#F6C453]/10 border border-[#F6C453]/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Layers className="w-3.5 h-3.5 text-[#F6C453]" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-bold tracking-wider text-[#91A0B5] uppercase">
              LETTER BAG
            </span>
            <span className="text-xs font-bold text-[#F2F6FC] group-hover:text-white transition-colors leading-tight">
              Tiles left
            </span>
          </div>
        </div>

        {/* Right: Large prominent gold number */}
        <div className="flex items-baseline shrink-0 z-10">
          <span className="font-mono text-2xl sm:text-3xl font-black bg-gradient-to-b from-[#FFF0C2] via-[#F6C453] to-[#E5A720] bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(246,196,83,0.5)] tabular-nums leading-none">
            {tileBagCount}
          </span>
        </div>
      </button>
    </section>
  );
};
