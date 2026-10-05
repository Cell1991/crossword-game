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
    subtitle: 'TOP 3 MOVES',
    description: 'Reveals the 3 highest-scoring word placements and point values available on the board.',
    element: 'YOUR TURN',
    icon: <Eye className="w-14 h-14 sm:w-16 sm:h-16 text-amber-300 drop-shadow-[0_0_16px_#fbbf24]" />,
    bgGradient: 'from-amber-950/95 via-[#2a1a06]/98 to-[#0d091a]/95',
    borderGlow: 'border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.65),inset_0_0_24px_rgba(245,158,11,0.35)] ring-1 ring-amber-300/40',
    badgeColor: 'bg-amber-400/25 border-amber-300/60 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.4)]',
  },
  SHIELD: {
    title: 'Shield',
    subtitle: 'FULL BLOCK',
    description: 'Fully blocks the next incoming attack damage or tile swap. Usable anytime, including an opponent\'s turn.',
    element: 'PASSIVE',
    icon: <Shield className="w-14 h-14 sm:w-16 sm:h-16 text-sky-200 fill-sky-400/20 drop-shadow-[0_0_16px_#38bdf8]" />,
    bgGradient: 'from-sky-950/95 via-[#081830]/98 to-[#060a1a]/95',
    borderGlow: 'border-sky-400 shadow-[0_0_50px_rgba(14,165,233,0.65),inset_0_0_24px_rgba(14,165,233,0.35)] ring-1 ring-sky-300/40',
    badgeColor: 'bg-sky-400/25 border-sky-300/60 text-sky-200 shadow-[0_0_10px_rgba(14,165,233,0.4)]',
  },
  HEAL: {
    title: 'Heal',
    subtitle: '100% SCORE HEAL',
    description: 'Restores HP equal to 100% of your points scored on this move.',
    element: 'HP MODE',
    icon: <Heart className="w-14 h-14 sm:w-16 sm:h-16 fill-rose-400 text-rose-200 drop-shadow-[0_0_16px_#fb7185]" />,
    bgGradient: 'from-rose-950/95 via-[#2a0c18]/98 to-[#0d0718]/95',
    borderGlow: 'border-rose-400 shadow-[0_0_50px_rgba(244,63,94,0.65),inset_0_0_24px_rgba(244,63,94,0.35)] ring-1 ring-rose-300/40',
    badgeColor: 'bg-rose-400/25 border-rose-300/60 text-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.4)]',
  },
  DOUBLE_DAMAGE: {
    title: 'Double Damage',
    subtitle: '2× WORD ATTACK',
    description: 'Your next confirmed word deals double (2×) HP damage to a targeted opponent.',
    element: 'HP MODE',
    icon: <Swords className="w-14 h-14 sm:w-16 sm:h-16 text-purple-200 drop-shadow-[0_0_16px_#c084fc]" />,
    bgGradient: 'from-purple-950/95 via-[#200e38]/98 to-[#0a0718]/95',
    borderGlow: 'border-purple-400 shadow-[0_0_50px_rgba(168,85,247,0.65),inset_0_0_24px_rgba(168,85,247,0.35)] ring-1 ring-purple-300/40',
    badgeColor: 'bg-purple-400/25 border-purple-300/60 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.4)]',
  },
  SPY_SWAP: {
    title: 'Spy Swap',
    subtitle: 'STEAL 1–7 TILES',
    description: 'Swap 1 to 7 rack tiles with random secret tiles stolen directly from an opponent. (Your turn only)',
    element: 'YOUR TURN',
    icon: <Repeat2 className="w-14 h-14 sm:w-16 sm:h-16 text-emerald-200 drop-shadow-[0_0_16px_#34d399]" />,
    bgGradient: 'from-emerald-950/95 via-[#062418]/98 to-[#050e18]/95',
    borderGlow: 'border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.65),inset_0_0_24px_rgba(16,185,129,0.35)] ring-1 ring-emerald-300/40',
    badgeColor: 'bg-emerald-400/25 border-emerald-300/60 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
  },
  FREEZE_TILE: {
    title: 'Freeze Tile',
    subtitle: 'LOCK UP TO 3 TILES',
    description: 'Encases 1 to 3 board tiles in ice. Opponents cannot attach words to them until your next turn.',
    element: 'YOUR TURN',
    icon: <Snowflake className="w-14 h-14 sm:w-16 sm:h-16 text-cyan-200 drop-shadow-[0_0_16px_#22d3ee]" />,
    bgGradient: 'from-cyan-950/95 via-[#08202c]/98 to-[#050d1a]/95',
    borderGlow: 'border-cyan-400 shadow-[0_0_50px_rgba(6,182,212,0.65),inset_0_0_24px_rgba(6,182,212,0.35)] ring-1 ring-cyan-300/40',
    badgeColor: 'bg-cyan-400/25 border-cyan-300/60 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.4)]',
  },
  DESTROY_TILE: {
    title: 'Destroy Tile',
    subtitle: 'BREAK 1 BOARD TILE',
    description: 'Target and remove 1 tile from the board to break enemy words and reopen bonus cells. (Your turn only)',
    element: 'YOUR TURN',
    icon: <Flame className="w-14 h-14 sm:w-16 sm:h-16 text-amber-300 fill-orange-500/30 drop-shadow-[0_0_16px_#f97316]" />,
    bgGradient: 'from-orange-950/95 via-[#2a1006]/98 to-[#0e0718]/95',
    borderGlow: 'border-orange-400 shadow-[0_0_50px_rgba(249,115,22,0.65),inset_0_0_24px_rgba(249,115,22,0.35)] ring-1 ring-orange-300/40',
    badgeColor: 'bg-orange-400/25 border-orange-300/60 text-orange-200 shadow-[0_0_10px_rgba(249,115,22,0.4)]',
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
    borderGlow: 'border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.6)]',
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
      className="pointer-events-auto fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden bg-slate-950/92 cursor-pointer p-4 backdrop-blur-md"
    >
      {/* Static GPU-friendly Ambient Radiance Glow (No JS continuous loop) */}
      <div
        className="absolute w-[500px] h-[500px] sm:w-[700px] sm:h-[700px] pointer-events-none opacity-60 transform-gpu"
        style={{
          background:
            'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(168, 85, 247, 0.18) 45%, transparent 70%)',
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
        className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/20 bg-gradient-to-b from-[#1c1a3e]/90 to-[#0e1026]/95 hover:border-amber-400/60 text-slate-200 hover:text-white transition-all shadow-xl cursor-pointer z-30 active:scale-95"
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
            className="relative flex h-[360px] w-[240px] sm:h-[400px] sm:w-[270px] flex-col items-center justify-between rounded-3xl border-2 border-amber-400/90 bg-gradient-to-br from-[#1e1338] via-[#0f0926] to-[#04020a] p-5 sm:p-6 shadow-2xl shadow-amber-500/30 pointer-events-auto transform-gpu"
          >
            {/* Card Header Top */}
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-1 font-mono text-[10px] sm:text-[11px] font-black tracking-widest text-amber-300">
                <Zap className="h-3.5 w-3.5 fill-amber-300" />
                POWER CORE
              </span>
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9.5px] font-black text-amber-200 border border-amber-400/40 tracking-wider">
                SURGE
              </span>
            </div>

            {/* Centered Crackling Lightning Emblem */}
            <div className="relative flex flex-col items-center justify-center my-auto">
              <div className="relative flex items-center justify-center">
                <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl border-2 border-amber-300 bg-amber-500/20 shadow-lg shadow-amber-500/50">
                  <Zap className="h-12 w-12 sm:h-14 sm:w-14 fill-amber-300 text-yellow-100 drop-shadow-[0_0_12px_#fef08a]" />
                </div>
              </div>
              <span className="mt-4 text-xs font-black uppercase tracking-[0.3em] text-amber-300 animate-pulse">
                Unlocking Card…
              </span>
            </div>

            {/* Card Bottom Filigree */}
            <div className="flex w-full items-center justify-center border-t border-amber-400/20 pt-2 text-[10.5px] font-mono font-bold text-amber-400/80 tracking-wider">
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
              className={`relative flex h-[390px] w-[260px] sm:h-[430px] sm:w-[290px] flex-col items-center justify-between rounded-3xl border-2 ${cardInfo.borderGlow} bg-gradient-to-br ${cardInfo.bgGradient} p-5 sm:p-6 shadow-2xl shadow-black/90 overflow-hidden transform-gpu backdrop-blur-xl`}
            >
              {/* Holographic specular light sheen overlay */}
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent rounded-t-3xl pointer-events-none z-20" />
              <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none z-20" />

              {/* Top Bar: Rarity + Timing Element */}
              <div className="flex w-full items-center justify-between relative z-10">
                <span className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[11px] font-black tracking-widest text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  POWER CARD
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-black tracking-widest uppercase border ${cardInfo.badgeColor}`}>
                  {cardInfo.element}
                </span>
              </div>

              {/* Central Card Art Emblem */}
              <div className="relative flex flex-col items-center justify-center my-auto z-10 w-full">
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl border border-white/20 bg-gradient-to-b from-white/15 to-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] mb-3">
                  {cardInfo.icon}
                </div>

                {/* Title & Subtitle */}
                <h3 className="text-xl sm:text-2xl font-black font-maple tracking-wide text-white text-center px-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
                  {cardInfo.title}
                </h3>
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300 mt-1">
                  {cardInfo.subtitle}
                </span>
              </div>

              {/* Bottom Card Description Box - High Legibility & Polish */}
              <div className="w-full rounded-2xl border border-white/15 bg-black/60 p-3 sm:p-3.5 text-center relative z-10 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.6)] backdrop-blur-md">
                <p className="text-xs sm:text-[13px] font-semibold leading-relaxed tracking-wide text-slate-100 drop-shadow-sm">
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
                className="group relative flex items-center gap-2 px-6 sm:px-7 py-2.5 rounded-full border border-amber-400/50 bg-gradient-to-r from-[#1b1736]/95 via-[#29200e]/98 to-[#1b1736]/95 hover:border-amber-300 hover:from-[#251f4a] hover:to-[#251f4a] text-amber-200 hover:text-white text-xs sm:text-sm font-black shadow-[0_6px_20px_rgba(0,0,0,0.7),0_0_16px_rgba(245,158,11,0.25),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:shadow-[0_0_24px_rgba(245,158,11,0.45)] transition-all active:scale-95 cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                <span className="relative z-10">✕ Tap anywhere to close</span>
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
