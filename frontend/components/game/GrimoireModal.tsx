'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, X, Copy, Check, BookMarked, HelpCircle } from 'lucide-react';
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

export const GrimoireModal: React.FC<GrimoireModalProps> = ({
  isOpen,
  onClose,
  gameId,
  sessionToken,
  playerId,
  isGrimoireEnabled = false,
  turnNumber,
}) => {
  const [loading, setLoading] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [selectedLengthFilter, setSelectedLengthFilter] = useState<number | 'ALL'>('ALL');
  const [copiedWord, setCopiedWord] = useState<string | null>(null);
  const [lastFetchedTurn, setLastFetchedTurn] = useState<number | null>(null);

  const fetchWords = async () => {
    if (!isGrimoireEnabled || !isOpen) return;
    setLoading(true);
    try {
      const res: GrimoireResponse = await getGrimoireWords(gameId, sessionToken, playerId);
      if (res && res.enabled) {
        setWords(res.words || []);
      } else {
        setWords([]);
      }
      setLastFetchedTurn(turnNumber);
    } catch (err) {
      console.error('Failed to fetch grimoire words:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isGrimoireEnabled) {
      if (lastFetchedTurn !== turnNumber || words.length === 0) {
        fetchWords();
      }
    }
  }, [isOpen, isGrimoireEnabled, turnNumber]);

  const handleCopyWord = (word: string) => {
    void navigator.clipboard?.writeText(word).catch(() => undefined);
    setCopiedWord(word);
    setTimeout(() => setCopiedWord(null), 1800);
  };

  const availableLengths = useMemo(() => {
    const lengths = new Set<number>();
    words.forEach(w => lengths.add(w.length));
    return Array.from(lengths).sort((a, b) => a - b);
  }, [words]);

  const filteredWords = useMemo(() => {
    if (selectedLengthFilter === 'ALL') return words;
    if (selectedLengthFilter === 6) return words.filter(w => w.length >= 6);
    return words.filter(w => w.length === selectedLengthFilter);
  }, [words, selectedLengthFilter]);

  if (!isOpen || !isGrimoireEnabled) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 select-none">
        {/* Dark Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        />

        {/* Unlocked Grimoire Modal (0-20 words list >= 3 letters) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative z-10 flex flex-col w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#12142e]/98 via-[#0b0d1e]/98 to-[#060710]/98 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_45px_rgba(245,158,11,0.25)]"
        >
          {/* Top Celestial Highlight */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 via-cyan-300/60 to-transparent pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-indigo-500/20 px-4 py-3 sm:px-6 bg-[#090b1c]/80 backdrop-blur-md">
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
                onClick={fetchWords}
                disabled={loading}
                title="Recalculate playable words"
                className="group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-indigo-400/30 bg-gradient-to-b from-[#181a42]/90 to-[#0d0f28]/95 text-slate-300 hover:text-amber-300 hover:border-amber-400/60 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-300' : ''}`} />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-indigo-400/30 bg-gradient-to-b from-[#181a42]/90 to-[#0d0f28]/95 text-slate-300 hover:text-white hover:border-rose-400/60 active:scale-95 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills Toolbar */}
          <div className="flex items-center justify-between border-b border-indigo-900/40 px-4 py-2 sm:px-6 bg-[#070814]/70 overflow-x-auto hide-scrollbar gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLengthFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedLengthFilter === 'ALL'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                    : 'bg-indigo-950/60 text-slate-400 hover:text-slate-200 border border-indigo-800/40'
                }`}
              >
                All ({words.length})
              </button>
              {availableLengths.map(len => (
                <button
                  key={len}
                  type="button"
                  onClick={() => setSelectedLengthFilter(len)}
                  className={`px-2 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    selectedLengthFilter === len
                      ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                      : 'bg-indigo-950/60 text-slate-400 hover:text-slate-200 border border-indigo-800/40'
                  }`}
                >
                  {len}L ({words.filter(w => w.length === len).length})
                </button>
              ))}
            </div>

            {copiedWord && (
              <div className="flex items-center gap-1 text-[11px] font-black text-emerald-300 bg-emerald-950/60 border border-emerald-400/40 px-2 py-0.5 rounded-md animate-fade-in shrink-0">
                <Check className="h-3 w-3" />
                <span>Copied {copiedWord}!</span>
              </div>
            )}
          </div>

          {/* Words Grid Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar min-h-[220px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
                <span className="text-xs sm:text-sm font-bold tracking-wide text-slate-300">
                  Calculating playable words...
                </span>
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                <div className="h-12 w-12 rounded-2xl border border-indigo-800/60 bg-indigo-950/40 flex items-center justify-center text-slate-500 mb-3">
                  <HelpCircle className="h-6 w-6" />
                </div>
                <p className="text-sm sm:text-base font-bold text-slate-200">
                  No playable words found
                </p>
              </div>
            ) : (
              <div className="rounded-xl sm:rounded-2xl border border-indigo-500/30 bg-[#080a1c]/70 overflow-hidden shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  {filteredWords.map((word, index) => {
                    const isRightCol = index % 2 === 1;
                    return (
                      <motion.div
                        key={`${word}-${index}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.015, duration: 0.12 }}
                        onClick={() => handleCopyWord(word)}
                        className={`group relative flex items-center justify-center p-2.5 sm:p-3.5 border-b border-indigo-500/20 ${
                          isRightCol ? '' : 'sm:border-r sm:border-indigo-500/20'
                        } hover:bg-indigo-950/50 active:bg-indigo-900/60 transition-colors cursor-pointer select-none`}
                      >
                        {/* Word Letter Tiles */}
                        <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
                          {word.split('').map((ch, i) => (
                            <div
                              key={i}
                              className="tile-face flex h-7 w-6 sm:h-8 sm:w-7 items-center justify-center rounded-md sm:rounded-lg border border-amber-100/90 shadow-sm"
                            >
                              <span className="tile-letter tile-letter-orange text-sm sm:text-base font-maple leading-none">
                                {ch}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Clean Footer */}
          <div className="border-t border-indigo-500/20 px-4 py-2.5 sm:px-6 bg-[#080a18]/90 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-b from-[#1e224e] to-[#121430] hover:from-[#2a306c] hover:to-[#181c44] text-slate-200 hover:text-white border border-indigo-400/30 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
