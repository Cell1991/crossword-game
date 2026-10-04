'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, X, BookMarked, HelpCircle } from 'lucide-react';
import { getGrimoireWords } from '@/lib/api';
import { GrimoireResponse } from '@/lib/types';

interface GrimoireModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  sessionToken?: string;
  playerId?: string;
  isGrimoireEnabled?: boolean;
  turnNumber: number;
}

interface GrimoireWordRowProps {
  word: string;
  isRightCol: boolean;
}

const GrimoireWordRow = React.memo(function GrimoireWordRow({
  word,
  isRightCol,
}: GrimoireWordRowProps) {
  return (
    <div
      className={`flex items-center justify-start px-4 sm:px-6 py-2.5 sm:py-3 border-b border-indigo-500/15 ${
        isRightCol ? '' : 'border-r border-indigo-500/15'
      } hover:bg-amber-400/[0.04] transition-colors select-text`}
    >
      <span className="font-serif font-bold text-base sm:text-[17px] tracking-[0.14em] text-[#fff6e0] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {word}
      </span>
    </div>
  );
});

export const GrimoireModal = React.memo(function GrimoireModal({
  isOpen,
  onClose,
  gameId,
  sessionToken,
  playerId,
  isGrimoireEnabled = false,
  turnNumber,
}: GrimoireModalProps) {
  const [loading, setLoading] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [selectedLengthFilter, setSelectedLengthFilter] = useState<number | 'ALL'>('ALL');
  const wordCacheRef = useRef<Map<number, string[]>>(new Map());

  const fetchWords = useCallback(async (force = false) => {
    if (!isGrimoireEnabled) return;

    if (!force && wordCacheRef.current.has(turnNumber)) {
      setWords(wordCacheRef.current.get(turnNumber) || []);
      return;
    }

    setLoading(true);
    try {
      const res: GrimoireResponse = await getGrimoireWords(gameId, sessionToken, playerId);
      const list = res && res.enabled ? res.words || [] : [];
      wordCacheRef.current.set(turnNumber, list);
      setWords(list);
    } catch (err) {
      console.error('Failed to fetch grimoire words:', err);
    } finally {
      setLoading(false);
    }
  }, [gameId, isGrimoireEnabled, playerId, sessionToken, turnNumber]);

  useEffect(() => {
    if (isOpen && isGrimoireEnabled) {
      fetchWords(false);
    }
  }, [isOpen, isGrimoireEnabled, fetchWords]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const availableLengths = useMemo(() => {
    const lengths = new Set<number>();
    for (const w of words) {
      lengths.add(w.length);
    }
    return Array.from(lengths).sort((a, b) => a - b);
  }, [words]);

  const filteredWords = useMemo(() => {
    if (selectedLengthFilter === 'ALL') return words;
    if (selectedLengthFilter === 6) return words.filter(w => w.length >= 6);
    return words.filter(w => w.length === selectedLengthFilter);
  }, [words, selectedLengthFilter]);

  return (
    <AnimatePresence>
      {isOpen && isGrimoireEnabled && (
        <motion.div
          key="grimoire-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 select-none"
        >
          {/* Unlocked Grimoire Modal (GPU Accelerated, Containment Optimized) */}
          <motion.div
            key="grimoire-dialog"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="grimoire-dialog relative z-10 flex flex-col w-full max-w-2xl h-[560px] max-h-[85vh] overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#12142e] via-[#0b0d1e] to-[#060710] shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.2)]"
          >
            {/* Top Celestial Highlight */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 via-cyan-300/60 to-transparent pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-indigo-500/20 px-4 py-3 sm:px-6 bg-[#090b1c]">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-500/20 to-indigo-900/40 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.35)]">
                  <BookMarked className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    Grimoire
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={() => fetchWords(true)}
                  disabled={loading}
                  title="Recalculate playable words"
                  className="group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-indigo-400/30 bg-gradient-to-b from-[#181a42] to-[#0d0f28] text-slate-300 hover:text-amber-300 hover:border-amber-400/60 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-300' : ''}`} />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-indigo-400/30 bg-gradient-to-b from-[#181a42] to-[#0d0f28] text-slate-300 hover:text-white hover:border-rose-400/60 active:scale-95 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Pills Toolbar */}
            <div className="flex items-center justify-start border-b border-indigo-900/40 px-4 py-2 sm:px-6 bg-[#070814] overflow-x-auto hide-scrollbar gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedLengthFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    selectedLengthFilter === 'ALL'
                      ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                      : 'bg-indigo-950/60 text-slate-400 hover:text-slate-200 border border-indigo-800/40'
                  }`}
                >
                  All
                </button>
                {availableLengths.map(len => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setSelectedLengthFilter(len)}
                    className={`min-w-[32px] px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer text-center ${
                      selectedLengthFilter === len
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                        : 'bg-indigo-950/60 text-slate-400 hover:text-slate-200 border border-indigo-800/40'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            {/* Words Grid Container with Native Momentum Scroll */}
            <div className="grimoire-scroll-container flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
                  <span className="text-xs sm:text-sm font-bold tracking-wide text-slate-300">
                    Calculating playable words...
                  </span>
                </div>
              ) : filteredWords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-4">
                  <div className="h-12 w-12 rounded-2xl border border-indigo-800/60 bg-indigo-950/40 flex items-center justify-center text-slate-500 mb-3">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <p className="text-sm sm:text-base font-bold text-slate-200">
                    No playable words found
                  </p>
                </div>
              ) : (
                <div className="rounded-xl sm:rounded-2xl border border-indigo-500/30 bg-[#080a1c] overflow-hidden shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
                  <div className="grid grid-cols-2">
                    {filteredWords.map((word, index) => {
                      const isRightCol = index % 2 === 1;
                      return (
                        <GrimoireWordRow
                          key={`${word}-${index}`}
                          word={word}
                          isRightCol={isRightCol}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Clean Footer */}
            <div className="border-t border-indigo-500/20 px-4 py-2.5 sm:px-6 bg-[#080a18] flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-b from-[#1e224e] to-[#121430] hover:from-[#2a306c] hover:to-[#181c44] text-slate-200 hover:text-white border border-indigo-400/30 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
