'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Player } from '@/lib/types';
import { Sparkles, Hourglass, Bot } from 'lucide-react';

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
          className="flex items-center gap-2.5 rounded-xl border border-emerald-400/80 bg-gradient-to-r from-emerald-950/90 via-slate-900/90 to-teal-950/90 px-3 py-1.5 text-xs font-bold text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-1 ring-emerald-400/40 shrink-0"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-wider text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)] uppercase text-[12px] sm:text-[13px] leading-tight">
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
        <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-xs font-medium min-w-0 transition-all duration-300 ${
          isBotPlacing
            ? 'border-amber-400/80 bg-gradient-to-r from-amber-950/90 via-slate-900/90 to-amber-950/90 text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.4)] ring-1 ring-amber-400/50'
            : 'border-cyan-500/60 bg-gradient-to-r from-cyan-950/90 via-slate-900/90 to-cyan-950/90 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.3)] ring-1 ring-cyan-500/40'
        }`}>
          <Bot className={`w-4 h-4 shrink-0 ${isBotPlacing ? 'text-amber-300 animate-bounce' : 'text-cyan-400 animate-pulse'}`} />
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
      <div className="flex items-center gap-2.5 rounded-xl border border-indigo-500/50 bg-gradient-to-r from-indigo-950/90 via-slate-900/90 to-slate-950/90 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-[0_0_14px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/30 min-w-0">
        <Hourglass className="w-4 h-4 text-indigo-400 animate-spin shrink-0" style={{ animationDuration: '4s' }} />
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
