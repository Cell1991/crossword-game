'use client';

import React from 'react';
import { HintSuggestion } from '@/lib/types';
import { Lightbulb, ArrowRight, ArrowDown } from 'lucide-react';

interface HintSuggestionsOverlayProps {
  suggestions: HintSuggestion[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  onDismiss?: () => void;
}

export const HintSuggestionsOverlay: React.FC<HintSuggestionsOverlayProps> = ({
  suggestions,
  activeIndex,
  onSelectIndex,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="relative flex flex-col items-center max-w-[calc(100vw-1rem)] pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-200 select-none mx-auto">
      {/* Self-contained Capsule with permanent rounded corners & hidden scrollbars */}
      <div className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-neutral-950/95 backdrop-blur-2xl border border-amber-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(245,158,11,0.2)] text-white max-w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {/* Header Badge */}
        <div className="flex items-center gap-1 text-amber-400 font-extrabold text-xs shrink-0 tracking-wider pl-0.5">
          <div className="p-1 sm:p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.35)]">
            <Lightbulb className="w-3.5 h-3.5 animate-pulse text-amber-300" />
          </div>
          <span className="hidden md:inline uppercase text-[10px] font-black text-amber-300/90 tracking-widest">
            HINTS
          </span>
        </div>

        {/* 3 Suggestion Pills */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {suggestions.map((s, idx) => {
            const isActive = idx === activeIndex;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectIndex(idx)}
                className={`group relative shrink-0 flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl font-bold transition-all duration-150 border cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/35 via-yellow-500/25 to-amber-500/35 border-amber-400 text-amber-50 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                    : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10 hover:border-amber-400/40 hover:text-white'
                }`}
              >
                {/* Top specular sheen */}
                <div className="pointer-events-none absolute inset-x-1 top-0.5 h-1/3 rounded-t-lg bg-gradient-to-b from-white/15 to-transparent" />

                {/* Rank Badge */}
                <span className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0 ${
                  isActive
                    ? 'bg-amber-400 text-neutral-950 font-black shadow-[0_0_6px_#fde047]'
                    : 'bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700 group-hover:text-white'
                }`}>
                  {idx + 1}
                </span>

                {/* Full Word (Never truncated) */}
                <span className="tracking-tight sm:tracking-wider uppercase font-black text-[10px] xs:text-[11px] sm:text-xs text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] whitespace-nowrap">
                  {s.word}
                </span>

                {/* Direction indicator */}
                <span className="text-neutral-400 shrink-0">
                  {s.direction === 'across' ? (
                    <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline text-amber-300/70" />
                  ) : (
                    <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline text-amber-300/70" />
                  )}
                </span>

                {/* Score Badge */}
                <span className={`text-[9px] sm:text-[10px] font-mono font-black px-1.5 py-0.5 rounded shrink-0 ${
                  isActive
                    ? 'bg-amber-400/30 text-amber-200 border border-amber-400/60 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                    : 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                }`}>
                  +{s.score}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
