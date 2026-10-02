'use client';

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, X } from 'lucide-react';

interface ConfirmExitModalProps {
  isOpen: boolean;
  isSpectator?: boolean;
  isLeaving?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmExitModal({
  isOpen,
  isSpectator = false,
  isLeaving = false,
  onConfirm,
  onClose,
}: ConfirmExitModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLeaving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLeaving, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="confirm-exit-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 sm:backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            key="confirm-exit-card"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="relative w-full max-w-[22rem] sm:max-w-sm rounded-[1.75rem] border border-rose-500/40 bg-gradient-to-b from-[#141d30] via-[#0b1220] to-[#060a14] p-6 text-center shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(244,63,94,0.2)] ring-1 ring-white/10 select-none"
            onClick={e => e.stopPropagation()}
          >
        {/* Top luminous accent beam */}
        <span className="absolute inset-x-10 top-0 h-0.5 bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_10px_#fb7185]" />

        {/* Close corner button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/15 shadow-[0_0_24px_rgba(244,63,94,0.35)]">
          <LogOut className="h-6 w-6 text-rose-400 stroke-[2.2]" />
        </div>

        {/* Text */}
        <h3 id="exit-modal-title" className="text-xl font-black tracking-tight text-white">
          {isSpectator ? 'Stop Watching?' : 'Leave Game?'}
        </h3>
        <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400">
          {isSpectator
            ? 'Are you sure you want to stop watching and return to the main menu?'
            : 'Are you sure you want to leave this game? If you leave now, you will forfeit this match.'}
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLeaving}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-700/80 hover:text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLeaving}
            className="flex-1 rounded-xl border border-rose-500/50 bg-gradient-to-r from-rose-600 to-red-600 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] transition hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLeaving ? 'Leaving...' : 'Leave Game'}
          </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
}
