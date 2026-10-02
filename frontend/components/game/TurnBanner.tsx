'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Player } from '@/lib/types';
import { Hourglass, Bot } from 'lucide-react';

interface TurnBannerProps {
  isMyTurn: boolean;
  isEliminated?: boolean;
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
  currentPlayer,
  nextPlayer,
  turnNumber,
  maxTurns,
  mobile = false,
  isBotPlacing = false,
}) => {
  const isBot = Boolean(
    currentPlayer &&
      (currentPlayer.display_name.toLowerCase().includes('bot') ||
        currentPlayer.display_name.toLowerCase().includes('[ai]'))
  );

  // Tactile haptic feedback when it becomes the player's turn (supported on mobile/tablets)
  useEffect(() => {
    if (isMyTurn && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate([25, 40, 25]); } catch {}
    }
  }, [isMyTurn]);

  if (isEliminated) {
    return (
      <div className="flex items-center gap-2 select-none min-w-0">
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/50 bg-gradient-to-r from-rose-950/90 via-slate-900/90 to-rose-950/90 px-3 py-1.5 text-xs text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/30 min-w-0">
          <span className="text-base shrink-0">☠️</span>
          <div className="flex flex-col min-w-0">
            <span className="font-black tracking-widest text-rose-300 uppercase text-[11px] sm:text-xs leading-none">
              SPECTATING
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 truncate">
              {currentPlayer ? `${currentPlayer.display_name}'s turn` : 'Waiting for move'}
            </span>
          </div>
          <span className="font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md bg-rose-950/80 border border-rose-700/60 text-rose-300 shrink-0 ml-1">
            T{turnNumber}{maxTurns ? `/${maxTurns}` : ''}
          </span>
        </div>
      </div>
    );
  }

  if (isMyTurn) {
    return (
      <div className="flex items-center gap-2 select-none min-w-0">
        <motion.div
          initial={{ scale: 0.92, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="flex shrink-0 items-center gap-2.5 rounded-xl border border-emerald-300/60 bg-emerald-300/[0.08] px-3 py-1.5 text-xs font-bold text-emerald-100 shadow-[0_3px_12px_rgba(16,185,129,0.12)]"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <span className="absolute h-2 w-2 rounded-full bg-emerald-300/30 motion-safe:animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-wider text-emerald-200 uppercase text-[12px] sm:text-[13px] leading-tight">
              YOUR TURN
            </span>
            <span className="text-[9.5px] font-semibold text-emerald-400/80 hidden sm:inline leading-none mt-0.5">
              Draft tiles & confirm move
            </span>
          </div>
          <span className="font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md bg-emerald-900/70 border border-emerald-500/50 text-emerald-200 shrink-0 ml-1">
            T{turnNumber}{maxTurns ? `/${maxTurns}` : ''}
          </span>
        </motion.div>
      </div>
    );
  }

  if (isBot) {
    return (
      <div className="flex items-center gap-2 select-none min-w-0">
        <div className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
          isBotPlacing
            ? 'border-amber-300/50 bg-amber-300/[0.07] text-amber-100'
            : 'border-cyan-300/40 bg-cyan-300/[0.06] text-cyan-100'
        }`}>
          <Bot className={`h-4 w-4 shrink-0 motion-safe:animate-pulse ${isBotPlacing ? 'text-amber-300' : 'text-cyan-300'}`} />
          <div className="flex flex-col min-w-0">
            <span className="truncate text-[11px] sm:text-xs font-bold leading-tight">
              <strong className={isBotPlacing ? 'text-amber-300 font-black' : 'text-cyan-300 font-black'}>{currentPlayer?.display_name}</strong>
            </span>
            <span className={`text-[9.5px] font-medium leading-none mt-0.5 truncate ${isBotPlacing ? 'text-amber-400/90' : 'text-cyan-400/90'}`}>
              {isBotPlacing ? 'Placing tiles on board...' : 'Analyzing board & tiles...'}
            </span>
          </div>
          <span className={`font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md border shrink-0 ml-1 ${
            isBotPlacing ? 'bg-amber-950/90 border-amber-600/70 text-amber-200' : 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300'
          }`}>
            T{turnNumber}{maxTurns ? `/${maxTurns}` : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 select-none min-w-0">
      <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-indigo-300/30 bg-indigo-300/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200">
        <Hourglass className="h-4 w-4 shrink-0 text-indigo-300 motion-safe:animate-spin" style={{ animationDuration: '4s' }} />
        <div className="flex flex-col min-w-0">
          <span className="truncate text-[11px] sm:text-xs font-bold leading-tight">
            <strong className="text-amber-300 font-black">{currentPlayer?.display_name || 'Opponent'}</strong>&apos;s Turn
          </span>
          <span className="text-[9.5px] text-slate-400 leading-none mt-0.5 truncate">
            {nextPlayer && !mobile ? `Next: ${nextPlayer.display_name}` : 'Waiting for opponent move'}
          </span>
        </div>
        <span className="font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/60 text-slate-300 shrink-0 ml-1">
          T{turnNumber}{maxTurns ? `/${maxTurns}` : ''}
        </span>
      </div>
    </div>
  );
};
