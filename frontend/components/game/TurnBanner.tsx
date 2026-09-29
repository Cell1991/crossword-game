'use client';

import React from 'react';
import { Player } from '@/lib/types';
import { Sparkles, Hourglass } from 'lucide-react';

interface TurnBannerProps {
  isMyTurn: boolean;
  currentPlayer: Player | undefined;
  nextPlayer?: Player | undefined;
  turnNumber: number;
  maxTurns: number | null;
  mobile?: boolean;
}

export const TurnBanner: React.FC<TurnBannerProps> = ({
  isMyTurn,
  currentPlayer,
  nextPlayer,
  turnNumber,
  maxTurns,
  mobile = false,
}) => {
  if (isMyTurn) {
    return (
      <div className="flex items-center gap-2 select-none min-w-0">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/60 bg-gradient-to-r from-emerald-950/80 via-teal-950/60 to-slate-900/80 px-2.5 py-1 text-xs font-bold text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/30">
          <div className="relative flex items-center justify-center shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping absolute" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
          </div>
          <span className="font-black tracking-wider text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)] uppercase text-[11px] sm:text-xs">
            YOUR TURN
          </span>
          <span className="font-mono text-[10px] sm:text-xs font-semibold px-1.5 py-0.2 rounded-md bg-emerald-900/60 border border-emerald-500/40 text-emerald-200">
            T{turnNumber}{maxTurns ? `/${maxTurns}` : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 select-none min-w-0">
      <div className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/80 via-slate-900/70 to-slate-950/80 px-2.5 py-1 text-xs font-medium text-slate-200 shadow-[0_0_12px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/20 truncate">
        <Hourglass className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" style={{ animationDuration: '4s' }} />
        <span className="truncate text-[11px] sm:text-xs">
          <strong className="text-amber-300 font-bold">{currentPlayer?.display_name || 'Opponent'}</strong>&apos;s Turn
        </span>
        {nextPlayer && !mobile && (
          <>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline truncate">
              Next: <span className="text-slate-300 font-semibold">{nextPlayer.display_name}</span>
            </span>
          </>
        )}
        <span className="font-mono text-[10px] sm:text-xs font-semibold px-1.5 py-0.2 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-400 shrink-0">
          T{turnNumber}{maxTurns ? `/${maxTurns}` : ''}
        </span>
      </div>
    </div>
  );
};
