'use client';

import React from 'react';

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
        className="group relative flex w-full items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[rgba(20,35,55,0.72)] hover:bg-[rgba(25,44,68,0.85)] border border-[rgba(120,160,200,0.16)] hover:border-[rgba(120,160,200,0.32)] shadow-[0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.35),0_0_16px_rgba(246,196,83,0.15)] transition-all duration-200 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C453]/60 select-none"
        aria-label={`Show letter bag breakdown, ${tileBagCount} tiles remaining`}
      >
        {/* Left: Section eyebrow & label */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-bold tracking-wider text-[#91A0B5] uppercase">
            LETTER BAG
          </span>
          <span className="text-xs sm:text-sm font-semibold text-[#F2F6FC] group-hover:text-white transition-colors">
            Tiles left
          </span>
        </div>

        {/* Right: Large prominent gold number */}
        <div className="flex items-baseline shrink-0">
          <span className="font-mono text-2xl sm:text-3xl font-extrabold text-[#F6C453] drop-shadow-[0_0_12px_rgba(246,196,83,0.35)] tabular-nums leading-none">
            {tileBagCount}
          </span>
        </div>
      </button>
    </section>
  );
};
