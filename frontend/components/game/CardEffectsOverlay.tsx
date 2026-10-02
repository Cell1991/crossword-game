'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  Sparkles,
  Shield,
  Heart,
  Snowflake,
  Flame,
  Eye,
  Repeat2,
  Swords,
  Crosshair,
  X,
} from 'lucide-react';
import { CardReveal } from '@/lib/types';
import { soundFx } from '@/lib/soundFx';

export interface CardStyleData {
  title: string;
  subtitle: string;
  description: string;
  element: string;
  icon: React.ReactNode;
  bgGradient: string;
  borderGlow: string;
  badgeColor: string;
}

/**
 * Authoritative 7 Power Cards strictly matching the Game Guide manual.
 */
export const CARD_DETAILS: Record<string, CardStyleData> = {
  HINT: {
    title: 'Hint',
    subtitle: 'Top 3 Placements',
    description: 'Highlights the top 3 highest-scoring word placements and point values.',
    element: 'YOUR TURN',
    icon: <Eye className="w-14 h-14 sm:w-16 sm:h-16 text-amber-300 drop-shadow-[0_0_16px_#fbbf24]" />,
    bgGradient: 'from-amber-950 via-yellow-950 to-slate-950',
    borderGlow: 'border-amber-400 shadow-[0_0_40px_rgba(245,158,11,0.6),inset_0_0_20px_rgba(245,158,11,0.3)]',
    badgeColor: 'bg-amber-400/20 border-amber-400/50 text-amber-300',
  },
  SHIELD: {
    title: 'Shield',
    subtitle: 'Full Protection',
    description: 'Blocks the next incoming attack damage or hostile tile swap completely.',
    element: 'PASSIVE',
    icon: <Shield className="w-14 h-14 sm:w-16 sm:h-16 text-sky-200 fill-sky-400/20 drop-shadow-[0_0_16px_#38bdf8]" />,
    bgGradient: 'from-sky-950 via-blue-950 to-slate-950',
    borderGlow: 'border-sky-400 shadow-[0_0_40px_rgba(14,165,233,0.6),inset_0_0_20px_rgba(14,165,233,0.3)]',
    badgeColor: 'bg-blue-400/20 border-blue-400/50 text-blue-300',
  },
  HEAL: {
    title: 'Heal',
    subtitle: 'Rack to HP',
    description: 'Restores HP equal to the total point value of all tiles in your rack.',
    element: 'HP MODE',
    icon: <Heart className="w-14 h-14 sm:w-16 sm:h-16 fill-rose-400 text-rose-200 drop-shadow-[0_0_16px_#fb7185]" />,
    bgGradient: 'from-rose-950 via-pink-950 to-slate-950',
    borderGlow: 'border-rose-400 shadow-[0_0_40px_rgba(244,63,94,0.6),inset_0_0_20px_rgba(244,63,94,0.3)]',
    badgeColor: 'bg-rose-400/20 border-rose-400/50 text-rose-300',
  },
  DOUBLE_DAMAGE: {
    title: 'Double Damage',
    subtitle: '2× Word Damage',
    description: 'Your next confirmed word deals double (2×) damage to a targeted rival.',
    element: 'HP MODE',
    icon: <Swords className="w-14 h-14 sm:w-16 sm:h-16 text-purple-200 drop-shadow-[0_0_16px_#c084fc]" />,
    bgGradient: 'from-purple-950 via-indigo-950 to-slate-950',
    borderGlow: 'border-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.6),inset_0_0_20px_rgba(168,85,247,0.3)]',
    badgeColor: 'bg-purple-400/20 border-purple-400/50 text-purple-300',
  },
  SPY_SWAP: {
    title: 'Spy Swap',
    subtitle: 'Steal 1–3 Tiles',
    description: 'Swap 1 to 3 rack tiles with random tiles stolen directly from an opponent.',
    element: 'ANYTIME',
    icon: <Repeat2 className="w-14 h-14 sm:w-16 sm:h-16 text-emerald-200 drop-shadow-[0_0_16px_#34d399]" />,
    bgGradient: 'from-emerald-950 via-teal-950 to-slate-950',
    borderGlow: 'border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.6),inset_0_0_20px_rgba(16,185,129,0.3)]',
    badgeColor: 'bg-emerald-400/20 border-emerald-400/50 text-emerald-300',
  },
  FREEZE_TILE: {
    title: 'Freeze Tile',
    subtitle: 'Lock 1 Board Tile',
    description: 'Locks a board tile in ice. Opponents cannot connect words to it until your next turn.',
    element: 'YOUR TURN',
    icon: <Snowflake className="w-14 h-14 sm:w-16 sm:h-16 text-cyan-200 drop-shadow-[0_0_16px_#22d3ee]" />,
    bgGradient: 'from-cyan-950 via-teal-950 to-slate-950',
    borderGlow: 'border-cyan-400 shadow-[0_0_40px_rgba(6,182,212,0.6),inset_0_0_20px_rgba(6,182,212,0.3)]',
    badgeColor: 'bg-cyan-400/20 border-cyan-400/50 text-cyan-300',
  },
  DESTROY_TILE: {
    title: 'Destroy Tile',
    subtitle: 'Break 1 Board Tile',
    description: 'Removes 1 tile from the board to break enemy words and reopen multiplier cells.',
    element: 'ANYTIME',
    icon: <Flame className="w-14 h-14 sm:w-16 sm:h-16 text-amber-300 fill-orange-500/30 drop-shadow-[0_0_16px_#f97316]" />,
    bgGradient: 'from-orange-950 via-red-950 to-slate-950',
    borderGlow: 'border-orange-400 shadow-[0_0_40px_rgba(249,115,22,0.6),inset_0_0_20px_rgba(249,115,22,0.3)]',
    badgeColor: 'bg-orange-400/20 border-orange-400/50 text-orange-300',
  },
};

/** Epic High-Performance Card Reward Discovery Modal */
export const EpicCardRevealOverlay: React.FC<{
  reveal: CardReveal;
  onDismiss?: () => void;
}> = ({ reveal, onDismiss }) => {
  const cardKey = reveal.card.toUpperCase();
  const cardInfo = CARD_DETAILS[cardKey] || {
    title: reveal.card.replace(/_/g, ' '),
    subtitle: 'POWER CARD',
    description: 'Special power card acquired from cell surge.',
    element: 'SPECIAL',
    icon: <Sparkles className="w-14 h-14 text-amber-300" />,
    bgGradient: 'from-purple-950 via-slate-950 to-indigo-950',
    borderGlow: 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)]',
    badgeColor: 'bg-amber-500/30 border-amber-400/70 text-amber-200',
  };

  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (reveal.phase === 'reveal') {
      // Allow instant dismissal on reveal without lag
      setCanDismiss(true);
    } else {
      setCanDismiss(false);
    }
  }, [reveal.phase]);

  useEffect(() => {
    if (reveal.phase === 'lightning') {
      soundFx.playCardCharge();
    } else if (reveal.phase === 'reveal') {
      soundFx.playCardReveal();
    }
  }, [reveal.phase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onDismiss?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const handleContainerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDismiss?.();
  };

  return (
    <div
      onClick={handleContainerClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden bg-slate-950/90 cursor-pointer p-4"
    >
      {/* Static GPU-friendly Ambient Radiance Glow (No JS continuous loop) */}
      <div
        className="absolute w-[500px] h-[500px] sm:w-[700px] sm:h-[700px] pointer-events-none opacity-50 transform-gpu"
        style={{
          background:
            'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(168, 85, 247, 0.15) 45%, transparent 70%)',
        }}
      />

      {/* Top right quick close button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss?.();
        }}
        aria-label="Close"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/25 bg-slate-900/95 hover:bg-slate-800 text-slate-200 hover:text-white transition-all shadow-xl cursor-pointer z-30 active:scale-95"
      >
        <X className="w-4 h-4" />
        <span className="text-xs font-bold">Close</span>
      </button>

      <AnimatePresence mode="wait">
        {reveal.phase === 'lightning' ? (
          /* PHASE 1: CHARGING MYSTERY CARD BACK */
          <motion.div
            key="charging-card"
            initial={{ scale: 0.7, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative flex h-[340px] w-[230px] sm:h-[380px] sm:w-[260px] flex-col items-center justify-between rounded-3xl border-2 border-amber-400/90 bg-gradient-to-br from-[#1e1338] via-[#0f0926] to-[#04020a] p-5 shadow-2xl shadow-amber-500/30 pointer-events-auto transform-gpu"
          >
            {/* Card Header Top */}
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-1 font-mono text-[10px] font-black tracking-widest text-amber-300">
                <Zap className="h-3 w-3 fill-amber-300" />
                POWER CORE
              </span>
              <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-200 border border-amber-400/40">
                ???
              </span>
            </div>

            {/* Centered Crackling Lightning Emblem */}
            <div className="relative flex flex-col items-center justify-center my-auto">
              <div className="relative flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-300 bg-amber-500/20 shadow-lg shadow-amber-500/50">
                  <Zap className="h-12 w-12 fill-amber-300 text-yellow-100 drop-shadow-[0_0_8px_#fef08a]" />
                </div>
              </div>
              <span className="mt-4 text-xs font-black uppercase tracking-[0.3em] text-amber-300 animate-pulse">
                Unlocking Card…
              </span>
            </div>

            {/* Card Bottom Filigree */}
            <div className="flex w-full items-center justify-center border-t border-amber-400/20 pt-2 text-[10px] font-mono font-bold text-amber-400/70">
              CELL SURGE ACQUIRED
            </div>
          </motion.div>
        ) : (
          /* PHASE 2: GLORIOUS 3D CARD REVEAL (GPU-ACCELERATED 180° FLIP) */
          <motion.div
            key="revealed-phase-wrapper"
            initial={{ opacity: 0, scale: 0.8, rotateY: 180 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              rotateY: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: 0.35, ease: 'easeOut' },
              opacity: { duration: 0.2 },
            }}
            style={{ perspective: 1000, transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            className="flex flex-col items-center pointer-events-auto transform-gpu will-change-transform"
          >
            <div
              className={`relative flex h-[370px] w-[250px] sm:h-[410px] sm:w-[280px] flex-col items-center justify-between rounded-3xl border-2 ${cardInfo.borderGlow} bg-gradient-to-br ${cardInfo.bgGradient} p-5 shadow-2xl shadow-black/80 overflow-hidden transform-gpu`}
            >
              {/* Holographic light sheen overlay */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/10 via-transparent to-black/30 pointer-events-none z-20" />

              {/* Top Bar: Rarity + Timing Element */}
              <div className="flex w-full items-center justify-between relative z-10">
                <span className="flex items-center gap-1 font-mono text-[10px] font-black tracking-wider text-amber-300">
                  <Sparkles className="h-3 w-3" />
                  POWER CARD
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase border ${cardInfo.badgeColor}`}>
                  {cardInfo.element}
                </span>
              </div>

              {/* Central Card Art Emblem */}
              <div className="relative flex flex-col items-center justify-center my-auto z-10">
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl border border-white/20 bg-white/10 shadow-lg mb-3">
                  {cardInfo.icon}
                </div>

                {/* Title & Subtitle */}
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white text-center px-1 drop-shadow-md">
                  {cardInfo.title}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 mt-0.5">
                  {cardInfo.subtitle}
                </span>
              </div>

              {/* Bottom Card Description Box */}
              <div className="w-full rounded-xl border border-white/10 bg-black/60 p-2.5 text-center relative z-10">
                <p className="text-[11px] sm:text-[11.5px] font-medium leading-snug text-slate-200">
                  {cardInfo.description}
                </p>
              </div>
            </div>

            {/* Tap or click anywhere to close pill */}
            <div className="mt-5 flex flex-col items-center justify-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDismiss?.();
                }}
                className="flex items-center gap-2 px-6 py-2 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-500/30 via-yellow-500/20 to-amber-500/30 hover:from-amber-500/50 hover:to-amber-500/50 text-amber-100 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <span>✕ Tap anywhere to close</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface CardCastEvent {
  playerName: string;
  card: string;
  targetPlayerName?: string | null;
}

/** Epic Broadcast Announcement when ANY player casts/uses a Power Card */
export const CardActivationOverlay: React.FC<{ event: CardCastEvent }> = ({ event }) => {
  const cardKey = event.card.toUpperCase();
  const cardInfo = CARD_DETAILS[cardKey] || {
    title: event.card.replace(/_/g, ' '),
    subtitle: 'POWER ACTIVATED',
    description: 'Unleashing power card abilities.',
    element: 'SPECIAL',
    icon: <Sparkles className="w-8 h-8 text-amber-300" />,
    bgGradient: 'from-purple-950 via-slate-900 to-indigo-950',
    borderGlow: 'border-amber-400 shadow-xl shadow-amber-500/30',
    badgeColor: 'bg-amber-500/30 border-amber-400/70 text-amber-200',
  };

  useEffect(() => {
    soundFx.playCardActivate(event.card);
  }, [event.card]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 sm:top-20 z-[95] flex items-center justify-center select-none px-4">
      <motion.div
        initial={{ y: -30, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -20, scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`relative flex max-w-md w-full items-center gap-3.5 rounded-2xl border-2 ${cardInfo.borderGlow} bg-gradient-to-r ${cardInfo.bgGradient} p-3 sm:p-4 shadow-2xl shadow-black/80 transform-gpu`}
      >
        {/* Animated Icon Avatar */}
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-md">
          {cardInfo.icon}
        </div>

        {/* Content Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-extrabold text-amber-300 truncate">
              {event.playerName}
            </span>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-300">
              ACTIVATED
            </span>
            <span className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase border ${cardInfo.badgeColor}`}>
              {cardInfo.title}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-slate-200 font-semibold truncate">
            {event.targetPlayerName ? (
              <span className="flex items-center gap-1 text-rose-300 font-bold">
                <Crosshair className="w-3 h-3 text-rose-400 shrink-0" />
                Targeted {event.targetPlayerName} for 2× Damage!
              </span>
            ) : (
              cardInfo.description
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
};
