'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ScrollText, X, Sparkles } from 'lucide-react';
import { Player, MoveHistoryEntry } from '@/lib/types';
import { RightSidebar } from './RightSidebar';

const subscribeToNothing = () => () => {};
const getClientMounted = () => true;
const getServerMounted = () => false;

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
  pendingDoubleTargetId?: string | null;
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
  pendingDoubleTargetId,
}) => {
  const mounted = useSyncExternalStore(subscribeToNothing, getClientMounted, getServerMounted);

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

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mobile-info-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/85 sm:backdrop-blur-sm p-0 sm:items-center sm:p-5"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Match Status and Scoreboard"
        >
          {/* Celestial Translucent Glassmorphism Modal Dialog Card */}
          <motion.div
            key="mobile-info-card"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
            className="transform-gpu relative flex max-h-[84dvh] w-full max-w-md flex-col overflow-hidden rounded-b-3xl border-b border-x border-amber-400/30 bg-[#0d0f24] shadow-[0_16px_50px_rgba(0,0,0,0.85)] sm:rounded-3xl sm:border-t sm:border-amber-400/35 sm:shadow-[0_16px_50px_rgba(0,0,0,0.65)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bottom Atmospheric Aura Highlight */}
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-indigo-400 to-purple-500 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 border-b border-white/10 bg-[#121430] select-none">
              <div className="flex items-center gap-2.5">
                {/* Glowing Scroll Icon Badge */}
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/30 via-indigo-600/20 to-slate-900 border border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.35)] flex items-center justify-center shrink-0">
                  <ScrollText className="w-4 h-4 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black tracking-wide text-white flex items-center gap-1.5 uppercase">
                    <span>Match status</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h2>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-300">
                    Turn <strong className="text-amber-300 font-black">{turnNumber}</strong> • {players.length} {players.length === 1 ? 'Player' : 'Players'}
                  </p>
                </div>
              </div>

              {/* Clean Integrated Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-900/90 border border-white/15 hover:border-amber-400/50 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-sm"
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
                pendingDoubleTargetId={pendingDoubleTargetId}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
