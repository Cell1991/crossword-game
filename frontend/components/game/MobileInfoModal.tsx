'use client';

import React, { useEffect } from 'react';
import { Trophy, X, Sparkles } from 'lucide-react';
import { Player, MoveHistoryEntry } from '@/lib/types';
import { RightSidebar } from './RightSidebar';

interface MobileInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  turnNumber: number;
  players: Player[];
  showHealth: boolean;
  currentPlayerId: string | null;
  myPlayerId: string | null;
  tileBagCount: number;
  tileBagCounts: Record<string, number>;
  moveHistory?: MoveHistoryEntry[];
  cardUseEffects?: Record<string, string>;
}

export const MobileInfoModal: React.FC<MobileInfoModalProps> = ({
  isOpen,
  onClose,
  turnNumber,
  players,
  showHealth,
  currentPlayerId,
  myPlayerId,
  tileBagCount,
  tileBagCounts,
  moveHistory = [],
  cardUseEffects = {},
}) => {
  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Match Status and Scoreboard"
    >
      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-3xl bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-slate-950 border border-slate-700/80 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(6,182,212,0.18),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-cyan-500/30 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Atmospheric Aura Highlight */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-800/80 bg-slate-950/60 select-none">
          <div className="flex items-center gap-2.5">
            {/* Glowing Trophy Icon Badge */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/30 via-yellow-600/20 to-slate-900 border border-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.35)] flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wide text-white flex items-center gap-1.5 uppercase">
                <span>Match Status</span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </h2>
              <p className="text-[10px] sm:text-[11px] font-mono font-semibold text-slate-400">
                Turn <strong className="text-cyan-300">{turnNumber}</strong> • {players.length} {players.length === 1 ? 'Player' : 'Players'}
              </p>
            </div>
          </div>

          {/* Clean Integrated Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-500 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-sm"
            aria-label="Close match status"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <RightSidebar
            mobile
            players={players}
            showHealth={showHealth}
            myPlayerId={myPlayerId}
            currentPlayerId={currentPlayerId}
            tileBagCount={tileBagCount}
            tileBagCounts={tileBagCounts}
            moveHistory={moveHistory}
            cardUseEffects={cardUseEffects}
          />
        </div>
      </div>
    </div>
  );
};
