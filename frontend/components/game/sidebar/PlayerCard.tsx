'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Medal, Award, Shield, WifiOff, Sparkles, Crosshair, Heart, Star } from 'lucide-react';
import { Player } from '@/lib/types';
import { cardIcon } from '../cardIcons';

interface PlayerCardProps {
  player: Player;
  rankIndex: number;
  isCurrent: boolean;
  isMe: boolean;
  showHealth: boolean;
  maxHp: number;
  cardEffect?: string;
  isTargeted?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  rankIndex,
  isCurrent,
  isMe,
  showHealth,
  maxHp,
  cardEffect,
  isTargeted = false,
}) => {
  const isDead = player.hp <= 0;
  const hasLeft = player.connection_status === 'OFFLINE';
  const hasShield = Boolean(player.has_shield && !isDead);
  const playerMaxHp = player.max_hp || maxHp;
  const displayName = player.display_name.trim() || 'Player';

  const isActiveTurn = isCurrent && !isDead && !hasLeft;
  const isLeader = rankIndex === 0 && !isDead;
  const isSecond = rankIndex === 1 && !isDead;
  const isThird = rankIndex === 2 && !isDead;
  const healthPercent = Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100));

  // Rolling Slot-Machine Counter & Score Gain Delta Animation (Hardware-Accelerated 120 FPS)
  const [displayScore, setDisplayScore] = useState(player.score);
  const [scoreDelta, setScoreDelta] = useState<{ amount: number; id: number } | null>(null);
  const prevScoreRef = useRef(player.score);

  useEffect(() => {
    const prevScore = prevScoreRef.current;
    const newScore = player.score;
    prevScoreRef.current = newScore;

    if (newScore > prevScore) {
      const delta = newScore - prevScore;
      setScoreDelta({ amount: delta, id: Date.now() });

      const duration = 850;
      const startTime = performance.now();
      let animationFrameId: number;

      const updateScore = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentVal = Math.round(prevScore + delta * easeOut);
        setDisplayScore(currentVal);

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(updateScore);
        } else {
          setDisplayScore(newScore);
        }
      };

      animationFrameId = requestAnimationFrame(updateScore);
      const timer = setTimeout(() => {
        setScoreDelta(null);
      }, 2400);

      return () => {
        cancelAnimationFrame(animationFrameId);
        clearTimeout(timer);
      };
    } else {
      setDisplayScore(newScore);
    }
  }, [player.score]);

  // Celestial Vitality Bar Gradients & Glows
  const hpGradient = hasShield
    ? 'from-sky-400 via-indigo-300 to-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.75)]'
    : player.hp <= playerMaxHp * 0.25
    ? 'from-rose-500 via-red-500 to-amber-500 shadow-[0_0_14px_rgba(239,68,68,0.85)] animate-pulse'
    : player.hp <= playerMaxHp * 0.5
    ? 'from-amber-400 via-orange-400 to-yellow-500 shadow-[0_0_12px_rgba(245,158,11,0.65)]'
    : 'from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_0_12px_rgba(45,212,191,0.7)]';

  const hpTextColor = hasShield
    ? 'text-sky-300'
    : player.hp <= playerMaxHp * 0.25
    ? 'text-rose-400 font-black'
    : player.hp <= playerMaxHp * 0.5
    ? 'text-amber-400'
    : 'text-emerald-400';

  return (
    <div
      className={`relative flex flex-col p-3 rounded-2xl transition-all duration-200 select-none overflow-visible ${
        isDead || hasLeft
          ? 'bg-slate-950/40 border border-white/[0.04] opacity-40 grayscale-[50%]'
          : isActiveTurn
          ? 'bg-gradient-to-br from-[#241e54]/95 via-[#18163f]/95 to-[#0f0e2b]/95 border-2 border-amber-300/80 shadow-[0_0_24px_rgba(251,191,36,0.35),0_0_14px_rgba(168,85,247,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] ring-1 ring-amber-400/40'
          : isMe
          ? 'bg-gradient-to-br from-[#1c1a40]/90 via-[#12112d]/95 to-[#0a0a1c]/95 border border-amber-400/35 hover:border-amber-400/60 shadow-[0_6px_18px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.16)]'
          : 'bg-gradient-to-br from-[#151636]/85 via-[#0e1028]/90 to-[#08091a]/95 hover:from-[#1b1d44]/90 hover:to-[#101330] border border-white/10 hover:border-white/20 shadow-[0_6px_18px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)]'
      }`}
    >
      {/* Celestial Glass Specular Shimmer */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none rounded-t-2xl" />

      {/* Ambient Starlight / Aurora Halo */}
      {isActiveTurn ? (
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />
      ) : null}

      {/* Golden Starlight Energy Ripple on Score Gain */}
      <AnimatePresence>
        {scoreDelta && (
          <motion.div
            initial={{ opacity: 0.9, scale: 0.96 }}
            animate={{ opacity: 0, scale: 1.04 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute inset-0 rounded-2xl border-2 border-amber-400/80 shadow-[0_0_24px_rgba(245,158,11,0.5),inset_0_0_14px_rgba(245,158,11,0.3)] pointer-events-none z-20"
          />
        )}
      </AnimatePresence>

      {/* Top Row: Rank Crest + Identity + Score */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        {/* Left: Celestial Rank Crest + Player Name */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* Rank Insignia Crest */}
          <div
            className={`w-6.5 h-6.5 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-md transition-transform mt-0.5 ${
              isLeader
                ? 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 text-amber-950 font-black border border-yellow-200/90 shadow-[0_0_14px_rgba(245,158,11,0.65),inset_0_1px_1px_rgba(255,255,255,0.9)] scale-105'
                : isSecond
                ? 'bg-gradient-to-br from-white via-slate-200 to-indigo-300 text-indigo-950 font-black border border-white/90 shadow-[0_0_12px_rgba(226,232,240,0.55),inset_0_1px_1px_rgba(255,255,255,0.9)]'
                : isThird
                ? 'bg-gradient-to-br from-amber-300 via-orange-500 to-amber-800 text-amber-950 font-black border border-amber-300/80 shadow-[0_0_12px_rgba(217,119,6,0.5),inset_0_1px_1px_rgba(254,215,170,0.7)]'
                : isDead || hasLeft
                ? 'bg-slate-900/60 text-slate-500 font-bold border border-white/5'
                : 'bg-gradient-to-br from-indigo-800/80 via-slate-800 to-slate-900 text-slate-100 font-extrabold border border-indigo-400/30 shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]'
            }`}
            title={`Rank #${rankIndex + 1}`}
          >
            {isLeader ? (
              <Crown className="w-4 h-4 text-amber-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]" />
            ) : isSecond ? (
              <Medal className="w-3.5 h-3.5 text-indigo-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]" />
            ) : isThird ? (
              <Award className="w-3.5 h-3.5 text-amber-950 drop-shadow-[0_1px_1px_rgba(254,215,170,0.6)]" />
            ) : (
              <span className="font-sans font-bold">{rankIndex + 1}</span>
            )}
          </div>

          {/* Player Identity Column */}
          <div className="flex flex-col min-w-0 flex-1">
            {/* Player Name Line & Active Turn Badge */}
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span
                className={`text-xs sm:text-[13px] font-black truncate leading-tight ${
                  isMe
                    ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                    : isActiveTurn
                    ? 'text-white drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                    : 'text-slate-100'
                }`}
                title={displayName}
              >
                {displayName}
              </span>

              {/* Active Turn Pulsing Pill */}
              {isActiveTurn && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/25 border border-amber-300/70 text-[9px] font-black text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse shrink-0">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  <span>TURN</span>
                </span>
              )}

              {/* Offline / Eliminated Notice */}
              {(isDead || hasLeft) && (
                <span className="text-[10px] font-bold shrink-0">
                  {isDead ? (
                    <span className="text-rose-400 font-black">Eliminated</span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-0.5">
                      <WifiOff className="w-2.5 h-2.5" /> Off
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Status Badges Sub-row */}
            {(hasShield || (isTargeted && !isDead && !hasLeft) || cardEffect) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {/* Shield Active Badge */}
                {hasShield && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-400/20 border border-sky-400/60 text-[9.5px] font-black text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.4)] shrink-0">
                    <Shield className="w-3 h-3 text-sky-300 fill-sky-400/30" />
                    <span>Cosmic Shield</span>
                  </span>
                )}

                {/* Double Damage Targeted Badge */}
                {isTargeted && !isDead && !hasLeft && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/70 text-[9.5px] font-black text-rose-200 shadow-[0_0_8px_rgba(244,63,94,0.4)] shrink-0 animate-pulse"
                    title="Targeted for 2× Double Damage"
                  >
                    <Crosshair className="w-3 h-3 text-rose-300 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>Targeted ×2</span>
                  </span>
                )}

                {/* Card effect in play */}
                {cardEffect && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/50 text-[9.5px] font-black text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.3)] shrink-0"
                    title={`${cardEffect} active`}
                  >
                    <Sparkles className="w-3 h-3 text-purple-300" />
                    <span>{cardIcon(cardEffect, 'h-3 w-3') ?? cardEffect}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Celestial Score Counter & Floating Gain Badge */}
        <div className="relative flex items-baseline gap-1 shrink-0 pl-2">
          {/* Animated Floating Points Gain Badge (+Score) */}
          <AnimatePresence>
            {scoreDelta && (
              <motion.div
                key={`score-gain-${scoreDelta.id}`}
                initial={{ opacity: 0, y: 4, scale: 0.5, x: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0.9, 0],
                  y: [-2, -18, -28, -36],
                  scale: [0.5, 1.25, 1.15, 0.95],
                  x: [0, -6, -12, -16],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.2, times: [0, 0.15, 0.7, 1], ease: 'easeOut' }}
                className="pointer-events-none absolute -top-2 right-0 z-50 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-2.5 py-0.5 text-xs font-black font-maple text-slate-950 shadow-[0_0_20px_rgba(245,158,11,1),0_4px_12px_rgba(0,0,0,0.9)] border border-amber-100 ring-1 ring-amber-400/60"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                <span>+{scoreDelta.amount}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rolling Number Display */}
          <motion.span
            animate={scoreDelta ? { scale: [1, 1.25, 1], transition: { duration: 0.35 } } : { scale: 1 }}
            className={`inline-block pr-1.5 text-xl sm:text-2xl font-black font-maple tracking-tight tabular-nums transition-colors ${
              scoreDelta
                ? 'bg-gradient-to-b from-amber-100 via-yellow-300 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(251,191,36,0.95)]'
                : isLeader
                ? 'bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(245,158,11,0.7)]'
                : isActiveTurn
                ? 'bg-gradient-to-b from-amber-100 via-amber-300 to-yellow-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                : isSecond
                ? 'bg-gradient-to-b from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(226,232,240,0.4)]'
                : isThird
                ? 'bg-gradient-to-b from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(217,119,6,0.4)]'
                : 'text-slate-100'
            }`}
          >
            {displayScore}
          </motion.span>
          <span className="text-[10px] font-black text-slate-400 uppercase">
            PTS
          </span>
        </div>
      </div>

      {/* Bottom Row: Celestial Vitality Essence Meter */}
      {showHealth && !isDead && (
        <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center gap-2.5 relative z-10">
          {/* Health Bar Track */}
          <div className="flex-1 h-2 rounded-full bg-[#070716] border border-white/10 p-[1px] overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-300 ${hpGradient}`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>

          {/* Exact HP Number with Star Sparkle */}
          <div className={`text-[10.5px] font-black tracking-tight shrink-0 flex items-center gap-1 ${hpTextColor}`}>
            <Heart className="w-2.5 h-2.5 fill-current opacity-80" />
            <span>
              {player.hp}
              <span className="text-[9.5px] text-slate-500 font-semibold">/{playerMaxHp}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
