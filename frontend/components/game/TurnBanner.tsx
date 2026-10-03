'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Player } from '@/lib/types';
import { Bot, Eye, Hourglass, WifiOff, Sparkles, Orbit, Radio } from 'lucide-react';

interface TurnBannerProps {
  isMyTurn: boolean;
  isEliminated?: boolean;
  isSpectator?: boolean;
  isConnected?: boolean;
  currentPlayer: Player | undefined;
  nextPlayer?: Player | undefined;
  turnNumber: number;
  maxTurns: number | null;
  mobile?: boolean;
  isBotPlacing?: boolean;
}

export const TurnBanner: React.FC<TurnBannerProps> = ({
  isMyTurn,
  isEliminated = false,
  isSpectator = false,
  isConnected = true,
  currentPlayer,
  nextPlayer,
  turnNumber,
  maxTurns,
  mobile = false,
  isBotPlacing = false,
}) => {
  const isBot = Boolean(currentPlayer && /bot|\[ai\]/i.test(currentPlayer.display_name));
  const spectating = isSpectator || isEliminated;
  const turnLabel = `T${turnNumber}${maxTurns ? `/${maxTurns}` : ''}`;

  useEffect(() => {
    if (isMyTurn && isConnected && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([25, 40, 25]);
      } catch {}
    }
  }, [isConnected, isMyTurn]);

  let icon = <Hourglass className="h-4 w-4 shrink-0 text-amber-300/90 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />;
  let title = `${currentPlayer?.display_name || 'Opponent'}’s turn`;
  let detail = nextPlayer && !mobile ? `Next: ${nextPlayer.display_name}` : 'Waiting for move';
  let bannerStyle = 'border-indigo-400/25 bg-gradient-to-r from-[#15163a]/92 via-[#0e102b]/95 to-[#090a1f]/92 text-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.12)] hover:border-indigo-400/40';
  let badgeStyle = 'border-indigo-400/30 bg-[#0a0c20]/80 text-indigo-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]';
  let titleGradient = 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]';

  if (!isConnected) {
    icon = <WifiOff className="h-4 w-4 shrink-0 text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />;
    title = 'Reconnecting';
    detail = 'Restoring live match';
    bannerStyle = 'border-rose-500/50 bg-gradient-to-r from-rose-950/90 via-[#2a0c14]/95 to-rose-950/90 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.35),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-rose-500/40';
    badgeStyle = 'border-rose-400/40 bg-black/60 text-rose-300';
    titleGradient = 'text-rose-200 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]';
  } else if (spectating) {
    icon = <Eye className="h-4 w-4 shrink-0 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]" />;
    title = 'Spectating';
    detail = currentPlayer ? `${currentPlayer.display_name} to play` : 'Observing match';
    bannerStyle = 'border-cyan-500/35 bg-gradient-to-r from-[#0c1a2e]/90 via-[#0a1224]/95 to-[#080d1a]/90 text-cyan-100 shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.14)]';
    badgeStyle = 'border-cyan-400/30 bg-black/60 text-cyan-200';
    titleGradient = 'text-cyan-100 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]';
  } else if (isMyTurn) {
    title = 'YOUR TURN';
    detail = 'Place tiles · play move';
    icon = <Sparkles className="h-4 w-4 shrink-0 text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.95)] animate-pulse" />;
    bannerStyle = 'border-amber-400/70 bg-gradient-to-r from-[#2c200c]/95 via-[#1b193d]/98 to-[#100f28]/95 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.35),0_4px_16px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.25)] ring-1 ring-amber-400/40';
    badgeStyle = 'border-amber-400/50 bg-[#0d0c1e]/90 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25),inset_0_1px_2px_rgba(0,0,0,0.6)]';
    titleGradient = 'bg-gradient-to-r from-amber-100 via-amber-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]';
  } else if (isBot) {
    icon = <Bot className={`h-4 w-4 shrink-0 ${isBotPlacing ? 'text-amber-300 animate-bounce' : 'text-indigo-300'}`} />;
    title = currentPlayer?.display_name || 'Cosmic Bot';
    detail = isBotPlacing ? 'Calculating placement' : 'Analyzing galaxy';
    bannerStyle = isBotPlacing
      ? 'border-amber-400/60 bg-gradient-to-r from-amber-950/90 via-[#201738]/95 to-amber-950/90 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/35'
      : 'border-indigo-400/40 bg-gradient-to-r from-[#18193f]/90 via-[#0e102c]/95 to-[#090b1e]/90 text-indigo-100 shadow-[0_4px_16px_rgba(0,0,0,0.6)]';
    badgeStyle = 'border-indigo-400/30 bg-black/60 text-indigo-200';
    titleGradient = isBotPlacing ? 'text-amber-200 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'text-indigo-100';
  }

  return (
    <motion.div
      initial={isMyTurn && isConnected ? { opacity: 0.7, scale: 0.98 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      aria-live="polite"
      className={`relative flex min-w-0 w-full items-center justify-between gap-2.5 rounded-2xl border px-3 sm:px-3.5 py-1.5 sm:py-2 overflow-hidden backdrop-blur-xl ${bannerStyle}`}
    >
      {/* Crystalline Specular Top Shimmer */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent rounded-t-2xl pointer-events-none" />

      {/* Ambient Starlight Glow Orb */}
      {isMyTurn && (
        <div className="absolute -left-4 -top-4 w-20 h-20 bg-amber-400/20 rounded-full blur-xl pointer-events-none" />
      )}

      {/* Left: Icon & Turn Title */}
      <div className="flex min-w-0 items-center gap-2 relative z-10">
        <div className="flex h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
          {icon}
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <span className={`truncate text-xs sm:text-[13px] font-black uppercase tracking-wider leading-tight ${titleGradient}`}>
            {title}
          </span>
          <span className="mt-0.5 hidden sm:inline truncate text-[10px] font-semibold text-slate-300/80 leading-none">
            {detail}
          </span>
        </div>
      </div>

      {/* Right: Crystalline Turn Badge */}
      <div className={`shrink-0 rounded-xl border px-2.5 py-1 text-[10px] sm:text-[11px] font-black tracking-wider uppercase font-mono relative z-10 ${badgeStyle}`}>
        {turnLabel}
      </div>
    </motion.div>
  );
};

