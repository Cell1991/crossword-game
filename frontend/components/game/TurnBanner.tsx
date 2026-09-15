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
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 shadow-md shadow-emerald-950/30 animate-pulse sm:text-sm">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>YOUR TURN</span>
          <span className="font-mono text-xs text-emerald-300/80">TURN {turnNumber}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-950/70 px-3 py-1 text-xs font-medium text-indigo-100 shadow-md shadow-indigo-950/20 sm:text-sm">
          <Hourglass className="w-3.5 h-3.5 text-slate-400 animate-spin" />
          <span>NEXT: {currentPlayer?.display_name || 'opponent'}</span>
          <span className="font-mono text-xs text-indigo-300/70">TURN {turnNumber}</span>
        </div>
      )}
    </div>
  );
};
