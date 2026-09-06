'use client';

import React from 'react';
import { Player } from '../../lib/types';
import { Sparkles, Hourglass } from 'lucide-react';

interface TurnBannerProps {
  isMyTurn: boolean;
  currentPlayer: Player | undefined;
  turnNumber: number;
}

export const TurnBanner: React.FC<TurnBannerProps> = ({
  isMyTurn,
  currentPlayer,
  turnNumber,
}) => {
  return (
    <div className="flex items-center gap-2">
      {isMyTurn ? (
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 text-xs sm:text-sm font-semibold shadow-md animate-pulse">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>YOUR TURN</span>
          <span className="text-emerald-400/70 font-mono text-xs">#Turn {turnNumber}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/80 border border-slate-700/60 rounded-full text-slate-300 text-xs sm:text-sm font-medium">
          <Hourglass className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          <span>Waiting for {currentPlayer?.display_name || 'opponent'}</span>
          <span className="text-slate-500 font-mono text-xs">#Turn {turnNumber}</span>
        </div>
      )}
    </div>
  );
};
