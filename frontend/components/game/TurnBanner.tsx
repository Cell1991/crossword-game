'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Player } from '@/lib/types';
import { Bot, Eye, Hourglass, WifiOff, Zap } from 'lucide-react';

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

  let icon = <Hourglass className="h-4 w-4 shrink-0 text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]" />;
  let title = `${currentPlayer?.display_name || 'Opponent'}’s turn`;
  let detail = nextPlayer && !mobile ? `Next: ${nextPlayer.display_name}` : 'Waiting for move';
  let tone = 'border-cyan-500/30 bg-gradient-to-r from-[#091526]/90 via-[#0e1f38]/90 to-[#091526]/90 text-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]';

  if (!isConnected) {
    icon = <WifiOff className="h-4 w-4 shrink-0 text-rose-300 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]" />;
    title = 'Reconnecting';
    detail = 'Restoring live match';
    tone = 'border-rose-500/50 bg-rose-950/85 text-rose-100 shadow-[0_2px_12px_rgba(239,68,68,0.4)]';
  } else if (spectating) {
    icon = <Eye className="h-4 w-4 shrink-0 text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]" />;
    title = 'Spectating';
    detail = currentPlayer ? `${currentPlayer.display_name} to play` : 'Watching live match';
    tone = 'border-sky-500/50 bg-sky-950/85 text-sky-100 shadow-[0_2px_12px_rgba(56,189,248,0.3)]';
  } else if (isMyTurn) {
    title = 'Your Turn';
    detail = 'Place tiles · play move';
    icon = <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />;
    tone = 'border-emerald-400/80 bg-gradient-to-r from-emerald-950/90 via-[#062c1d]/90 to-emerald-950/90 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.35),inset_0_0_12px_rgba(16,185,129,0.2)] ring-1 ring-emerald-400/50';
  } else if (isBot) {
    icon = <Bot className={`h-4 w-4 shrink-0 ${isBotPlacing ? 'text-amber-300' : 'text-cyan-300'}`} />;
    title = currentPlayer?.display_name || 'Game bot';
    detail = isBotPlacing ? 'Playing move' : 'Thinking';
    tone = isBotPlacing
      ? 'border-amber-400/60 bg-amber-950/85 text-amber-100 shadow-[0_2px_12px_rgba(245,158,11,0.35)]'
      : 'border-cyan-400/60 bg-cyan-950/85 text-cyan-100 shadow-[0_2px_12px_rgba(34,211,238,0.35)]';
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
      <span className="shrink-0 rounded-lg border border-white/15 bg-black/60 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-slate-200 shadow-inner">
        {turnLabel}
      </span>
    </motion.div>
  );
};
