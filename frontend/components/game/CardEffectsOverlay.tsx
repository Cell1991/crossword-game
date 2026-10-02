'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
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
  confettiColors: string[];
}

export const CARD_DETAILS: Record<string, CardStyleData> = {
  DOUBLE_DAMAGE: {
    title: 'Word ×2',
    subtitle: 'CRITICAL STRIKE',
    description: 'Your next word deals double (2×) damage to a targeted opponent.',
    element: 'THUNDER',
    icon: <Swords className="w-16 h-16 text-purple-200 drop-shadow-[0_0_20px_#c084fc]" />,
    bgGradient: 'from-purple-950 via-indigo-950 to-slate-950',
    borderGlow: 'border-purple-400 shadow-[0_0_50px_rgba(168,85,247,0.7),inset_0_0_30px_rgba(168,85,247,0.4)]',
    badgeColor: 'bg-purple-500/30 border-purple-400/70 text-purple-200',
    confettiColors: ['#c084fc', '#a855f7', '#e879f9', '#fbbf24', '#ffffff'],
  },
  SHIELD: {
    title: 'Shield',
    subtitle: 'AEGIS BARRIER',
    description: 'Creates an impenetrable shield that blocks incoming attacks & swaps.',
    element: 'DEFENSE',
    icon: <Shield className="w-16 h-16 text-sky-200 fill-sky-400/20 drop-shadow-[0_0_20px_#38bdf8]" />,
    bgGradient: 'from-sky-950 via-blue-950 to-slate-950',
    borderGlow: 'border-sky-400 shadow-[0_0_50px_rgba(14,165,233,0.7),inset_0_0_30px_rgba(14,165,233,0.4)]',
    badgeColor: 'bg-sky-500/30 border-sky-400/70 text-sky-200',
    confettiColors: ['#38bdf8', '#0ea5e9', '#60a5fa', '#93c5fd', '#ffffff'],
  },
  FREEZE_TILE: {
    title: 'Freeze Word',
    subtitle: 'GLACIAL PERMAFROST',
    description: 'Encases a board tile in deep ice, preventing opponents from using it.',
    element: 'FROST',
    icon: <Snowflake className="w-16 h-16 text-cyan-200 drop-shadow-[0_0_20px_#22d3ee]" />,
    bgGradient: 'from-cyan-950 via-teal-950 to-slate-950',
    borderGlow: 'border-cyan-400 shadow-[0_0_50px_rgba(6,182,212,0.7),inset_0_0_30px_rgba(6,182,212,0.4)]',
    badgeColor: 'bg-cyan-500/30 border-cyan-400/70 text-cyan-200',
    confettiColors: ['#22d3ee', '#06b6d4', '#67e8f9', '#ffffff', '#38bdf8'],
  },
  DESTROY_TILE: {
    title: 'Clear Word',
    subtitle: 'INFERNAL BLAZE',
    description: 'Unleashes intense fire to permanently incinerate and clear 1 tile.',
    element: 'FIRE',
    icon: <Flame className="w-16 h-16 text-amber-300 fill-orange-500/30 drop-shadow-[0_0_20px_#f97316]" />,
    bgGradient: 'from-orange-950 via-red-950 to-slate-950',
    borderGlow: 'border-orange-400 shadow-[0_0_50px_rgba(249,115,22,0.7),inset_0_0_30px_rgba(249,115,22,0.4)]',
    badgeColor: 'bg-orange-500/30 border-orange-400/70 text-orange-200',
    confettiColors: ['#fb923c', '#f97316', '#ef4444', '#facc15', '#ffffff'],
  },
  HEAL: {
    title: 'Heal',
    subtitle: 'VITAL RESTORATION',
    description: 'Channels vitality to restore HP equal to the sum of your rack tile points.',
    element: 'LIFE',
    icon: <Heart className="w-16 h-16 fill-rose-400 text-rose-200 drop-shadow-[0_0_20px_#fb7185]" />,
    bgGradient: 'from-rose-950 via-pink-950 to-slate-950',
    borderGlow: 'border-rose-400 shadow-[0_0_50px_rgba(244,63,94,0.7),inset_0_0_30px_rgba(244,63,94,0.4)]',
    badgeColor: 'bg-rose-500/30 border-rose-400/70 text-rose-200',
    confettiColors: ['#fb7185', '#f43f5e', '#34d399', '#10b981', '#ffffff'],
  },
  HINT: {
    title: 'Hint',
    subtitle: 'SOLAR CLAIRVOYANCE',
    description: 'Illuminates the board with the top 3 highest scoring word placements.',
    element: 'LIGHT',
    icon: <Eye className="w-16 h-16 text-amber-200 drop-shadow-[0_0_20px_#fbbf24]" />,
    bgGradient: 'from-amber-950 via-yellow-950 to-slate-950',
    borderGlow: 'border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.7),inset_0_0_30px_rgba(245,158,11,0.4)]',
    badgeColor: 'bg-amber-500/30 border-amber-400/70 text-amber-200',
    confettiColors: ['#fde047', '#f59e0b', '#fbbf24', '#ffffff', '#fb7185'],
  },
  SPY_SWAP: {
    title: 'Swap Word',
    subtitle: 'QUANTUM SHIFT',
    description: 'Selects and secretly swaps 1-3 tiles directly with an opponent.',
    element: 'QUANTUM',
    icon: <Repeat2 className="w-16 h-16 text-emerald-200 drop-shadow-[0_0_20px_#34d399]" />,
    bgGradient: 'from-emerald-950 via-teal-950 to-slate-950',
    borderGlow: 'border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.7),inset_0_0_30px_rgba(16,185,129,0.4)]',
    badgeColor: 'bg-emerald-500/30 border-emerald-400/70 text-emerald-200',
    confettiColors: ['#34d399', '#10b981', '#2dd4bf', '#a7f3d0', '#ffffff'],
  },
};

/** Epic 3D Holographic Card Reward Discovery Modal */
export const EpicCardRevealOverlay: React.FC<{
  reveal: CardReveal;
  onDismiss?: () => void;
}> = ({ reveal, onDismiss }) => {
  const cardInfo = CARD_DETAILS[reveal.card] || {
    title: reveal.card.replace(/_/g, ' '),
    subtitle: 'POWER CARD',
    description: 'A mystical artifact of immense word power.',
    element: 'MAGIC',
    icon: <Sparkles className="w-16 h-16 text-amber-300" />,
    bgGradient: 'from-purple-950 via-slate-950 to-indigo-950',
    borderGlow: 'border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.6)]',
    badgeColor: 'bg-amber-500/30 border-amber-400/70 text-amber-200',
    confettiColors: ['#fbbf24', '#38bdf8', '#c084fc', '#ffffff'],
  };

  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (reveal.phase === 'reveal') {
      const timer = window.setTimeout(() => {
        setCanDismiss(true);
      }, 400);
      return () => window.clearTimeout(timer);
    } else {
      setCanDismiss(false);
    }
  }, [reveal.phase]);

  useEffect(() => {
    if (reveal.phase === 'lightning') {
      soundFx.playCardCharge();
    } else if (reveal.phase === 'reveal') {
      soundFx.playCardReveal();
      confetti({
        particleCount: 55,
        spread: 70,
        origin: { y: 0.5 },
        colors: cardInfo.confettiColors,
      });
    }
  }, [reveal.phase, cardInfo.confettiColors]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (canDismiss && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onDismiss?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canDismiss, onDismiss]);

  const handleContainerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canDismiss) {
      onDismiss?.();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden backdrop-blur-md bg-slate-950/85 cursor-pointer p-4"
    >
      {/* Background Rotating Sunburst Rays */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.6, scale: 1.2, rotate: 360 }}
        transition={{ rotate: { duration: 25, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.5 } }}
        className="absolute w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(168, 85, 247, 0.15) 35%, transparent 70%)',
        }}
      />

      {/* Top right quick close button */}
      {reveal.phase === 'reveal' && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (canDismiss) onDismiss?.();
          }}
          aria-label="Close"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/25 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white transition-all shadow-2xl cursor-pointer z-30 active:scale-95"
        >
          <X className="w-4 h-4" />
          <span className="text-xs font-bold">ปิด (Close)</span>
        </button>
      )}

      <AnimatePresence mode="wait">
        {reveal.phase === 'lightning' ? (
          /* PHASE 1: CHARGING MYSTERY CARD BACK */
          <motion.div
            key="charging-card"
            initial={{ scale: 0.4, y: 40, opacity: 0, rotateY: -20 }}
            animate={{ scale: 1, y: 0, opacity: 1, rotateY: 0 }}
            exit={{ scale: 1.15, opacity: 0, rotateY: 90 }}
            transition={{ type: 'spring', damping: 14, stiffness: 180 }}
            className="relative flex h-[340px] w-[230px] sm:h-[380px] sm:w-[260px] flex-col items-center justify-between rounded-3xl border-2 border-amber-400/90 bg-gradient-to-br from-[#1e1338] via-[#0f0926] to-[#04020a] p-5 shadow-[0_0_60px_rgba(245,158,11,0.6),inset_0_0_30px_rgba(245,158,11,0.3)] pointer-events-auto"
          >
            {/* Pulsing Concentric Energy Rings */}
            <motion.div
              animate={{ scale: [1, 1.4, 1.8], opacity: [0.8, 0.4, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-3xl border border-amber-300 pointer-events-none"
            />

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
              <motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="relative flex items-center justify-center"
              >
                <div className="absolute h-28 w-28 rounded-full bg-amber-400/20 blur-xl animate-pulse" />
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-amber-300 bg-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.8)]">
                  <Zap className="h-12 w-12 fill-amber-300 text-yellow-100 drop-shadow-[0_0_12px_#fef08a]" />
                </div>
              </motion.div>
              <motion.span
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="mt-4 text-xs font-black uppercase tracking-[0.35em] text-amber-300"
              >
                Unlocking Card…
              </motion.span>
            </div>

            {/* Card Bottom Filigree */}
            <div className="flex w-full items-center justify-center border-t border-amber-400/20 pt-2 text-[10px] font-mono font-bold text-amber-400/70">
              CELL SURGE ACQUIRED
            </div>
          </motion.div>
        ) : (
          /* PHASE 2: GLORIOUS HOLOGRAPHIC 3D REVEALED CARD */
          <motion.div
            key="revealed-phase-wrapper"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 14, stiffness: 170 }}
            className="flex flex-col items-center pointer-events-auto"
          >
            <div
              className={`relative flex h-[360px] w-[245px] sm:h-[400px] sm:w-[275px] flex-col items-center justify-between rounded-3xl border-2 ${cardInfo.borderGlow} bg-gradient-to-br ${cardInfo.bgGradient} p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)]`}
              style={{ perspective: 1000 }}
            >
              {/* Holographic light sheen overlay */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 pointer-events-none"
              />

              {/* Top Bar: Rarity + Element */}
              <div className="flex w-full items-center justify-between relative z-10">
                <span className="flex items-center gap-1 font-mono text-[10px] font-black tracking-wider text-amber-300">
                  <Sparkles className="h-3 w-3" />
                  POWER CARD
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-black tracking-wider uppercase border ${cardInfo.badgeColor}`}>
                  {cardInfo.element}
                </span>
              </div>

              {/* Central Card Art Emblem */}
              <div className="relative flex flex-col items-center justify-center my-auto z-10">
                <motion.div
                  initial={{ scale: 0.5, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 220, delay: 0.1 }}
                  className="relative flex items-center justify-center mb-3"
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-white/10 shadow-[inset_0_2px_4px_rgba(255,255,255,0.2)] backdrop-blur-md">
                    {cardInfo.icon}
                  </div>
                </motion.div>

                {/* Title & Subtitle */}
                <motion.h3
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] text-center"
                >
                  {cardInfo.title}
                </motion.h3>
                <motion.span
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300 mt-0.5"
                >
                  {cardInfo.subtitle}
                </motion.span>
              </div>

              {/* Bottom Card Description Box */}
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-center relative z-10 backdrop-blur-sm"
              >
                <p className="text-[10.5px] sm:text-[11px] font-medium leading-tight text-slate-200">
                  {cardInfo.description}
                </p>
              </motion.div>
            </div>

            {/* Tap or click anywhere indicator */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="mt-6 flex flex-col items-center justify-center gap-2 pointer-events-auto"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (canDismiss) onDismiss?.();
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-amber-400/60 bg-gradient-to-r from-amber-500/30 via-yellow-500/20 to-amber-500/30 hover:from-amber-500/45 hover:to-amber-500/45 text-amber-100 text-xs sm:text-sm font-bold shadow-[0_0_24px_rgba(245,158,11,0.4)] backdrop-blur-md transition-all active:scale-95 cursor-pointer animate-pulse"
              >
                <span>✕ แตะที่ใดก็ได้เพื่อปิด (Tap anywhere to close)</span>
              </button>
            </motion.div>
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
  const cardInfo = CARD_DETAILS[event.card] || {
    title: event.card.replace(/_/g, ' '),
    subtitle: 'POWER ACTIVATED',
    description: 'Unleashing arcane word abilities.',
    element: 'MAGIC',
    icon: <Sparkles className="w-8 h-8 text-amber-300" />,
    bgGradient: 'from-purple-950 via-slate-900 to-indigo-950',
    borderGlow: 'border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.6)]',
    badgeColor: 'bg-amber-500/30 border-amber-400/70 text-amber-200',
    confettiColors: ['#fbbf24', '#38bdf8'],
  };

  useEffect(() => {
    soundFx.playCardActivate(event.card);
  }, [event.card]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 sm:top-20 z-[95] flex items-center justify-center select-none px-4">
      <motion.div
        initial={{ y: -40, scale: 0.85, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -30, scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 200 }}
        className={`relative flex max-w-md w-full items-center gap-3.5 rounded-2xl border-2 ${cardInfo.borderGlow} bg-gradient-to-r ${cardInfo.bgGradient} p-3 sm:p-4 shadow-[0_15px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl`}
      >
        {/* Animated Icon Avatar */}
        <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.15)]">
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
