'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Player } from '@/lib/types';
import { Bot, Eye, Hourglass, WifiOff } from 'lucide-react';

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
      try { navigator.vibrate([25, 40, 25]); } catch {}
    }
  }, [isConnected, isMyTurn]);

  let icon = <Hourglass className="h-4 w-4 shrink-0 text-amber-400/80" />;
  let title = `${currentPlayer?.display_name || 'Opponent'}’s turn`;
  let detail = nextPlayer && !mobile ? `Next · ${nextPlayer.display_name}` : 'Waiting for move';
  let tone = 'border-amber-500/30 bg-gradient-to-r from-[#1f170b]/90 to-[#120d04]/95 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.15)]';

  if (!isConnected) {
    icon = <WifiOff className="h-4 w-4 shrink-0 text-rose-300" />;
    title = 'Reconnecting';
    detail = 'Restoring live match';
    tone = 'border-rose-400/35 bg-rose-950/40 text-rose-100 shadow-[0_0_12px_rgba(239,68,68,0.2)]';
  } else if (spectating) {
    icon = <Eye className="h-4 w-4 shrink-0 text-sky-300" />;
    title = 'Spectating';
    detail = currentPlayer ? `${currentPlayer.display_name} to play` : 'Watching live match';
    tone = 'border-sky-400/35 bg-sky-950/40 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.2)]';
  } else if (isMyTurn) {
    title = 'Your turn';
    detail = 'Place tiles · play move';
    icon = <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />;
    tone = 'border-emerald-400/60 bg-gradient-to-r from-emerald-950/80 to-[#121c0e]/90 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/30';
  } else if (isBot) {
    icon = <Bot className={`h-4 w-4 shrink-0 ${isBotPlacing ? 'text-amber-300' : 'text-cyan-300'}`} />;
    title = currentPlayer?.display_name || 'Game bot';
    detail = isBotPlacing ? 'Playing move' : 'Thinking';
    tone = isBotPlacing ? 'border-amber-400/50 bg-gradient-to-r from-amber-950/80 to-[#1e1405]/90 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.25)]' : 'border-cyan-400/40 bg-gradient-to-r from-cyan-950/60 to-[#09151c]/90 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.2)]';
  }

  return (
    <motion.div
      initial={isMyTurn && isConnected ? { opacity: 0.7, y: 2 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      aria-live="polite"
      className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-1.5 ${tone}`}
    >
      {icon}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.1em] leading-tight sm:text-xs">{title}</span>
        <span className="mt-0.5 hidden truncate text-[10px] font-medium text-amber-300/70 leading-none sm:inline">{detail}</span>
      </div>
      <span className="ml-1 shrink-0 rounded-md border border-amber-500/30 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amber-200">{turnLabel}</span>
    </motion.div>
  );
};
