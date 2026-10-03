'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
    <AnimatePresence mode="wait">
      <div
        key={burst.key}
        className="pointer-events-none fixed inset-x-0 bottom-44 sm:bottom-52 z-50 flex flex-col items-center justify-center select-none"
      >
        {/* Radiant Ambient Starlight Flare */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.9, 0.6, 0], scale: [0.5, 1.4, 1.6, 1.8] }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          className="absolute h-56 w-56 sm:h-72 sm:w-72 rounded-full pointer-events-none"
          style={{
            background: isBingo
              ? 'radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(168,85,247,0.3) 40%, rgba(56,189,248,0.15) 70%, transparent 85%)'
              : 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(245,158,11,0.2) 50%, transparent 75%)',
            filter: 'blur(20px)',
          }}
        />

        {/* Main Floating Score Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3, y: 30, rotate: -4 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0.3, 1.28, 1.0, 0.92],
            y: [30, -10, -32, -65],
            rotate: [-4, 2, 0, 0],
          }}
          transition={{
            duration: 2.0,
            times: [0, 0.15, 0.7, 1],
            ease: ['backOut', 'easeOut', 'easeIn'],
          }}
          className="relative flex flex-col items-center justify-center"
        >
          {/* Tier Banner: BINGO / EXCELLENT / GREAT */}
          {isBingo ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 500, damping: 18 }}
              className="mb-1.5 flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-500/90 via-purple-600/90 to-amber-500/90 px-3.5 py-1 text-xs sm:text-sm font-black text-white shadow-[0_0_20px_rgba(245,158,11,0.8),inset_0_1px_1px_rgba(255,255,255,0.6)] uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            >
              <Crown className="h-4 w-4 text-amber-200 animate-bounce" />
              <span className="bg-gradient-to-r from-white via-amber-100 to-yellow-200 bg-clip-text text-transparent">
                BINGO! +50 BONUS
              </span>
              <Sparkles className="h-4 w-4 text-yellow-300" />
            </motion.div>
          ) : isMega ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 500, damping: 18 }}
              className="mb-1 flex items-center gap-1 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-500/80 to-yellow-600/80 px-3 py-0.5 text-[11px] sm:text-xs font-black text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.6),inset_0_1px_1px_rgba(255,255,255,0.5)] uppercase tracking-wider"
            >
              <Flame className="h-3.5 w-3.5 text-amber-950 fill-amber-300 animate-pulse" />
              <span>EXCELLENT MOVE!</span>
            </motion.div>
          ) : isGreat ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 500, damping: 18 }}
              className="mb-1 flex items-center gap-1 rounded-full border border-cyan-400/60 bg-gradient-to-r from-cyan-500/80 to-blue-600/80 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black text-white shadow-[0_0_12px_rgba(34,211,238,0.5),inset_0_1px_1px_rgba(255,255,255,0.5)] uppercase tracking-wider"
            >
              <Zap className="h-3 w-3 text-yellow-300 fill-yellow-300" />
              <span>GREAT!</span>
            </motion.div>
          ) : null}

          {/* 3D Golden Score Numbers Cluster */}
          <div className="relative flex items-baseline gap-2">
            {/* Ambient Sparkles */}
            <Sparkles className="absolute -top-3 -left-5 h-5 w-5 text-amber-300 animate-spin-slow drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] pointer-events-none" />
            <Sparkles className="absolute -bottom-2 -right-6 h-4 w-4 text-yellow-200 animate-pulse drop-shadow-[0_0_8px_rgba(254,240,138,0.9)] pointer-events-none" />

            {/* Plus Symbol & Score Number with 3D Arcade Styling */}
            <div className="flex items-center tracking-tight">
              <span
                className="font-maple text-4xl sm:text-6xl font-black select-none leading-none mr-0.5"
                style={{
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #FEF08A 25%, #F59E0B 70%, #B45309 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter:
                    'drop-shadow(0 2px 0 #78350f) drop-shadow(0 4px 10px rgba(0,0,0,0.9)) drop-shadow(0 0 20px rgba(245,158,11,0.85))',
                }}
              >
                +
              </span>
              <span
                className="font-maple text-5xl sm:text-7xl font-black select-none leading-none tabular-nums"
                style={{
                  background: 'linear-gradient(180deg, #FFFFFF 0%, #FEF08A 25%, #F59E0B 70%, #B45309 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter:
                    'drop-shadow(0 3px 0 #78350f) drop-shadow(0 6px 14px rgba(0,0,0,0.95)) drop-shadow(0 0 25px rgba(245,158,11,0.9))',
                }}
              >
                {score}
              </span>
            </div>

            {/* PTS Pill Badge */}
            <div className="flex items-center rounded-xl border border-amber-300/60 bg-gradient-to-b from-[#2e1d08]/95 via-[#1a1005]/95 to-[#0d0802]/95 px-2.5 py-1 shadow-[0_4px_12px_rgba(0,0,0,0.8),0_0_15px_rgba(245,158,11,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)]">
              <span className="font-black text-xs sm:text-sm tracking-widest text-amber-300 uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                PTS
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
