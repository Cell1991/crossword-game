'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Player } from '@/lib/types';
import { Bot, Eye, Hourglass, WifiOff, Sparkles } from 'lucide-react';

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

  let icon = <Hourglass className="h-4 w-4 shrink-0 text-amber-400/80 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />;
  let title = `${currentPlayer?.display_name || 'Opponent'}’s turn`;
  let detail = nextPlayer && !mobile ? `Next: ${nextPlayer.display_name}` : 'Waiting for move';
  let tone = 'border-white/12 bg-gradient-to-r from-[#141535]/90 via-[#0e102b]/95 to-[#090a1f]/90 text-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]';

  if (!isConnected) {
    icon = <WifiOff className="h-4 w-4 shrink-0 text-rose-300 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]" />;
    title = 'Reconnecting';
    detail = 'Restoring live match';
    tone = 'border-rose-500/50 bg-rose-950/85 text-rose-100 shadow-[0_2px_12px_rgba(239,68,68,0.4)]';
  } else if (spectating) {
    icon = <Eye className="h-4 w-4 shrink-0 text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.6)]" />;
    title = 'Spectating';
    detail = currentPlayer ? `${currentPlayer.display_name} to play` : 'Watching live match';
    tone = 'border-indigo-500/40 bg-indigo-950/85 text-indigo-100 shadow-[0_2px_12px_rgba(99,102,241,0.25)]';
  } else if (isMyTurn) {
    title = 'Your Turn';
    detail = 'Place tiles · play move';
    icon = <Sparkles className="h-4 w-4 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.85)] animate-pulse" />;
    tone = 'border-amber-400/75 bg-gradient-to-r from-[#2a220e]/95 via-[#1c1a3e]/95 to-[#12102e]/95 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.3),inset_0_0_12px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/40';
  } else if (isBot) {
    icon = <Bot className={`h-4 w-4 shrink-0 ${isBotPlacing ? 'text-amber-300' : 'text-indigo-300'}`} />;
    title = currentPlayer?.display_name || 'Game bot';
    detail = isBotPlacing ? 'Playing move' : 'Thinking';
    tone = isBotPlacing
      ? 'border-amber-400/60 bg-amber-950/85 text-amber-100 shadow-[0_2px_12px_rgba(245,158,11,0.35)]'
      : 'border-indigo-400/50 bg-indigo-950/85 text-indigo-100 shadow-[0_2px_12px_rgba(99,102,241,0.25)]';
  }

  return (
    <motion.div
      initial={isMyTurn && isConnected ? { opacity: 0.7, y: 2 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      aria-live="polite"
      className={`flex min-w-0 w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 ${tone}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px] font-black uppercase tracking-[0.1em] leading-tight text-white sm:text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {title}
          </span>
          <span className="mt-0.5 hidden truncate text-[10px] font-semibold text-slate-300 leading-none sm:inline">
            {detail}
          </span>
        </div>
      </div>
      <span className="shrink-0 rounded-lg border border-amber-400/25 bg-black/60 px-2 py-0.5 text-[10px] font-black tabular-nums text-amber-200 shadow-inner">
        {turnLabel}
      </span>
    </motion.div>
  );
};
