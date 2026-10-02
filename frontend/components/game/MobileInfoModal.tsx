'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScrollText, X, Sparkles } from 'lucide-react';
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
  // Prevent body scroll when modal is open on mobile & handle Escape
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mobile-info-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 sm:items-center sm:p-5"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Match Status and Scoreboard"
        >
          {/* Translucent Glassmorphism Modal Dialog Card */}
          <motion.div
            key="mobile-info-card"
            initial={{ opacity: 0, scale: 0.93, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 380 }}
            className="relative flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-700/70 bg-slate-950 sm:rounded-3xl sm:border-cyan-500/25 sm:shadow-[0_16px_50px_rgba(0,0,0,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Top Atmospheric Aura Highlight */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-800/80 bg-slate-900 select-none">
          <div className="flex items-center gap-2.5">
            {/* Glowing Scroll Icon Badge */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/30 via-blue-600/20 to-slate-900 border border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.35)] flex items-center justify-center shrink-0">
              <ScrollText className="w-4 h-4 text-cyan-300 drop-shadow-[0_0_6px_#38bdf8]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-wide text-white flex items-center gap-1.5 uppercase">
                <span>Match status</span>
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
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
  );
};
