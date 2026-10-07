'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, X, Sparkles, Trophy, Users } from 'lucide-react';
import { MoveHistoryEntry, Player } from '@/lib/types';
import { RecentMovesPanel } from './sidebar/RecentMovesPanel';

const subscribeToNothing = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;

interface MatchLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  moveHistory?: MoveHistoryEntry[];
  myPlayerId: string | null;
  turnNumber?: number;
  players?: Player[];
}

/**
 * WordX Dedicated Match Log & Celestial Lexicon Modal.
 * Guaranteed 100% responsive and touch-friendly for iPad, Mobile, and Spectators.
 */
export const MatchLogModal: React.FC<MatchLogModalProps> = ({
  isOpen,
  onClose,
  moveHistory = [],
  myPlayerId,
  turnNumber,
  players = [],
}) => {
  const mounted = useSyncExternalStore(subscribeToNothing, getClientMounted, getServerMounted);

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

  if (!mounted) return null;

  const totalMoves = moveHistory.filter(m => m.type === 'move').length;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="match-log-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-5"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Match Log and Word Definitions"
        >
          <motion.div
            key="match-log-card"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            className="transform-gpu relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-400/35 bg-gradient-to-b from-[#121430] via-[#0d0f26] to-[#070817] shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Atmospheric Starlight Highlight */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-white/10 bg-[#16183c]/90 select-none">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400/30 via-yellow-500/20 to-slate-900 border border-amber-400/50 shadow-[0_0_14px_rgba(251,191,36,0.4)] flex items-center justify-center shrink-0">
                  <BookOpen className="w-4.5 h-4.5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black tracking-wider text-white flex items-center gap-1.5 uppercase font-maple">
                    <span>Match Log & Lexicon</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h2>
                  <p className="text-[10.5px] sm:text-xs font-semibold text-slate-300 flex items-center gap-2">
                    <span>{moveHistory.length} Chronicles ({totalMoves} Words Formed)</span>
                    {turnNumber ? <span>• Turn <strong className="text-amber-300 font-bold">{turnNumber}</strong></span> : null}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-900/90 border border-white/15 hover:border-amber-400/60 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-sm"
                aria-label="Close match log"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2">
              <RecentMovesPanel
                moveHistory={moveHistory}
                myPlayerId={myPlayerId}
                isOpen={true}
                onToggleOpen={() => {}}
                hideHeaderTrigger={true}
                maxItems={50}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
