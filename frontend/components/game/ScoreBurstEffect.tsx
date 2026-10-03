'use client';

import React from 'react';
import { Sparkles, Zap, Flame, Crown } from 'lucide-react';

export interface ScoreBurstData {
  score: number;
  isBingo?: boolean;
  key: number;
}

interface ScoreBurstEffectProps {
  burst: ScoreBurstData | null;
}

/**
 * WordX Celestial 3D Score Burst Animation
 * Delivers arcade/RPG tactile game juice with 3D golden typography, starlight aura, and tier banners.
 */
export const ScoreBurstEffect: React.FC<ScoreBurstEffectProps> = ({ burst }) => {
  if (!burst) return null;

  const score = burst.score;
  const isBingo = Boolean(burst.isBingo);
  const isMega = score >= 30 || isBingo;
  const isGreat = score >= 15 && !isMega;

  return (
    <div
      key={burst.key}
      className="pointer-events-none fixed inset-x-0 bottom-44 sm:bottom-48 z-50 flex flex-col items-center justify-center select-none"
    >
      {/* Radiant Ambient Starlight Flare (Pure CSS Radial Gradient, 0ms CPU Cost) */}
      <div
        className="animate-score-flare-burst absolute h-20 w-20 sm:h-24 sm:w-24 rounded-full pointer-events-none"
        style={{
          background: isBingo
            ? 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(168,85,247,0.25) 45%, transparent 75%)'
            : 'radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(245,158,11,0.2) 50%, transparent 75%)',
        }}
      />

      {/* Main Floating Score Container with 120 FPS GPU Compositor Keyframe Animation */}
      <div className="animate-score-burst-pop relative flex flex-col items-center justify-center">
        {/* Tier Banner: BINGO / EXCELLENT / GREAT */}
        {isBingo ? (
          <div className="mb-1 flex items-center gap-1 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-500/95 via-purple-600/95 to-amber-500/95 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black text-white shadow-[0_0_12px_rgba(245,158,11,0.6)] uppercase tracking-wider drop-shadow-sm">
            <Crown className="h-3 w-3 text-amber-200" />
            <span className="bg-gradient-to-r from-white via-amber-100 to-yellow-200 bg-clip-text text-transparent">
              BINGO! +50
            </span>
            <Sparkles className="h-3 w-3 text-yellow-300" />
          </div>
        ) : isMega ? (
          <div className="mb-1 flex items-center gap-1 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-500/90 to-yellow-600/90 px-2 py-0.5 text-[9.5px] sm:text-[10px] font-black text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)] uppercase tracking-wider">
            <Flame className="h-3 w-3 text-amber-950 fill-amber-300" />
            <span>EXCELLENT!</span>
          </div>
        ) : isGreat ? (
          <div className="mb-1 flex items-center gap-1 rounded-full border border-cyan-400/60 bg-gradient-to-r from-cyan-500/90 to-blue-600/90 px-2 py-0.5 text-[9.5px] sm:text-[10px] font-black text-white shadow-[0_0_10px_rgba(34,211,238,0.4)] uppercase tracking-wider">
            <Zap className="h-3 w-3 text-yellow-300 fill-yellow-300" />
            <span>GREAT!</span>
          </div>
        ) : null}

        {/* 3D Golden Score Numbers Cluster (Compact & Sleek) */}
        <div className="relative flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-[#09081a]/90 border border-amber-400/40 shadow-[0_4px_12px_rgba(0,0,0,0.8),0_0_10px_rgba(245,158,11,0.25)]">
          {/* Plus Symbol & Score Number */}
          <div className="flex items-center tracking-tight">
            <span className="score-burst-gold-text font-maple text-lg sm:text-xl font-black select-none leading-none mr-0.5">
              +
            </span>
            <span className="score-burst-gold-text font-maple text-xl sm:text-2xl font-black select-none leading-none tabular-nums">
              {score}
            </span>
          </div>

          {/* PTS Pill Badge */}
          <div className="flex items-center rounded-md border border-amber-300/40 bg-gradient-to-b from-[#2e1d08]/95 to-[#0d0802]/95 px-1.5 py-0.5 shadow-sm">
            <span className="font-black text-[9px] sm:text-[10px] tracking-wider text-amber-300 uppercase">
              PTS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
