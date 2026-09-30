'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  X,
  Zap,
  Sparkles,
  Eye,
  Shield,
  Heart,
  Repeat2,
  Snowflake,
  RotateCcw,
  Layers,
} from 'lucide-react';

interface GameGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'board' | 'cards' | 'rules';
}

export function GameGuideModal({
  isOpen,
  onClose,
  defaultTab = 'board',
}: GameGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'cards' | 'rules'>(defaultTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-slate-900/98 text-left shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft Warm Champagne Top Accent */}
        <span className="absolute inset-x-12 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/35 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.3)]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 sm:px-6 sm:py-5 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300 shadow-[0_2px_12px_rgba(245,158,11,0.15)] shrink-0">
              <BookOpen className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="guide-modal-title" className="text-base sm:text-lg font-bold tracking-tight text-white">
                  WordX Game Guide
                </h2>
                <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 tracking-wider uppercase">
                  Manual
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Board special squares, power cards & gameplay rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
            aria-label="Close guide"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Navigation Tabs - Soft Segmented Pill Dock */}
        <div className="p-3 sm:px-6 sm:pt-3.5 border-b border-slate-800/70 bg-slate-950/40">
          <div className="flex rounded-2xl bg-slate-900/80 border border-slate-800/80 p-1 gap-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('board')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'board'
                  ? 'bg-slate-800 border border-slate-700 text-amber-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Zap className={`h-4 w-4 ${activeTab === 'board' ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>Board Symbols</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'cards'
                  ? 'bg-slate-800 border border-slate-700 text-amber-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Sparkles className={`h-4 w-4 ${activeTab === 'cards' ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>7 Power Cards</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'rules'
                  ? 'bg-slate-800 border border-slate-700 text-amber-200 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Layers className={`h-4 w-4 ${activeTab === 'rules' ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>Rules & Modes</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {/* TAB 1: BOARD SPECIAL SQUARES */}
          {activeTab === 'board' && (
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                The WordX board features animated special cells that award score multipliers, secret power card drops, and placement rules:
              </p>

              {/* 1. Lightning Power Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                {/* Exact Animated Lightning Cell from Board */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-cyan-200/75 bg-cyan-400/20 shadow-[inset_0_0_10px_rgba(165,243,252,0.18),0_0_20px_rgba(34,211,238,0.5)] board-power-pulse overflow-hidden">
                  <span className="board-lightning-halo absolute left-1/2 top-1/2 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/light.png"
                      alt="Lightning Cell"
                      className="board-lightning-logo h-[76%] w-[76%] object-contain"
                    />
                  </span>
                  <i className="board-lightning-spark absolute left-[20%] top-[24%] h-1 w-1 rounded-full bg-yellow-100 shadow-[0_0_8px_2px_rgba(253,224,71,0.9)]" />
                  <i className="board-lightning-spark absolute bottom-[20%] right-[20%] h-1 w-1 rounded-full bg-cyan-100 shadow-[0_0_8px_2px_rgba(165,243,252,0.9)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Lightning Cell</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-cyan-300">
                      Card Drop
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Placing a tile on any glowing Lightning Cell instantly awards you <span className="text-amber-200/95 font-medium">1 random Secret Power Card</span> directly into your hand (holds up to 3 cards).
                  </p>
                </div>
              </div>

              {/* 2. 3L Triple Letter Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                {/* Exact Animated 3L Fire Cell from Board */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-red-300/60 bg-red-950/40 shadow-[0_0_14px_rgba(239,68,68,0.4)] board-triple-aura overflow-hidden">
                  <span className="board-fire-core absolute inset-[18%] rounded-full bg-red-400/40" />
                  <span className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white font-black text-xl font-maple drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    3<span className="board-premium-letter">L</span>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">3L Cell</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-rose-300">
                      Letter Score ×3
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Triples the point value of any letter tile placed on this cell (<span className="text-amber-200/95 font-medium">Letter Score × 3</span>) for that turn.
                  </p>
                </div>
              </div>

              {/* 3. 2L Double Letter Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                {/* Exact Animated 2L Earth Cell from Board */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-emerald-300/45 bg-emerald-950/40 shadow-[0_0_14px_rgba(34,197,94,0.35)] board-double-aura overflow-hidden">
                  <span className="board-earth-glow absolute inset-[12%] rounded-full" />
                  <span className="board-earth-mountain board-earth-mountain-back absolute inset-x-0 bottom-0 h-[70%]" />
                  <span className="board-earth-mountain board-earth-mountain-front absolute inset-x-0 bottom-0 h-[62%]" />
                  <i className="board-earth-speck absolute left-[22%] top-[27%] h-1 w-1 rounded-full" />
                  <i className="board-earth-speck absolute right-[20%] top-[38%] h-1 w-1 rounded-full [animation-delay:0.7s]" />
                  <span className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white font-black text-xl font-maple drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    2<span className="board-premium-letter">L</span>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">2L Cell</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      Letter Score ×2
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Doubles the point value of any letter tile placed on this cell (<span className="text-amber-200/95 font-medium">Letter Score × 2</span>) for that turn.
                  </p>
                </div>
              </div>

              {/* 4. Center Star Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                {/* Exact Center Star from Board */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-amber-300/60 bg-[#1e1b4b] shadow-[0_0_16px_rgba(251,191,36,0.3)] board-center-pulse overflow-hidden">
                  <span className="text-2xl font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] select-none">
                    ★
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Center Star Cell</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-amber-300">
                      Starting Square
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    The origin center of the board. The <span className="text-amber-200/95 font-medium">very first word of the game</span> must be placed across this star cell.
                  </p>
                </div>
              </div>

              {/* 5. Blank Wildcard Tile */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                {/* Exact Blank Tile from Rack */}
                <div className="tile-face relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-amber-100/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_4px_8px_rgba(74,34,8,0.48)] overflow-hidden">
                  <div className="absolute inset-x-1 top-0.5 h-[36%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10" />
                  <div className="relative z-20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="tile-blank-star w-7 h-7 animate-pulse" fill="#ffffff" stroke="#000000" strokeWidth="1.5" strokeLinejoin="round">
                      <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
                    </svg>
                  </div>
                  <span className="tile-score-blue absolute bottom-0.5 right-1.5 z-20 text-[14px] font-maple leading-none italic font-bold">
                    0
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Blank Wildcard Tile</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-amber-300">
                      Wildcard (0 Pts)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Carries 0 points, but can represent <span className="text-amber-200/95 font-medium">any English letter (A–Z)</span> of your choice. When placed on the board, a letter picker appears to designate your desired character.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THE 7 POWER CARDS */}
          {activeTab === 'cards' && (
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Awarded by placing tiles onto Lightning Cells. Hold up to 3 cards in your hand to deploy tactical advantages:
              </p>

              {/* 1. HINT */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
                  <Eye className="h-5 w-5 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Hint</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-amber-300">
                      Own Turn Only
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Scans the current board and your rack to calculate and highlight the <span className="text-amber-200/95 font-medium">top 3 highest-scoring word placements</span>, showing tile previews and estimated scores.
                  </p>
                </div>
              </div>

              {/* 2. SHIELD */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-400/10 text-blue-300">
                  <Shield className="h-5 w-5 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Shield</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-blue-300">
                      Anytime / Reactive
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Erects a protective barrier that <span className="text-amber-200/95 font-medium">blocks incoming opponent attacks or tile swaps</span>. Can be activated in advance or triggered when you are targeted.
                  </p>
                </div>
              </div>

              {/* 3. HEAL */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300">
                  <Heart className="h-5 w-5 fill-rose-400/30 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Heal</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-rose-300">
                      Anytime (HP Mode)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    <span className="text-amber-200/95 font-medium">Restores your HP</span> by the sum of point values of all letter tiles currently on your rack. Hold high-value letters to maximize healing!
                  </p>
                </div>
              </div>

              {/* 4. DOUBLE_DAMAGE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-400/25 bg-purple-400/10 text-purple-300">
                  <span className="text-base font-black tracking-tight">×2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Word ×2 (Double Damage)</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-purple-300">
                      Own Turn (HP Mode)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Target an opponent before confirming your move. Your word deals <span className="text-amber-200/95 font-medium">double (2×) attack damage</span> directly to the chosen player&apos;s HP.
                  </p>
                </div>
              </div>

              {/* 5. SPY_SWAP */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                  <Repeat2 className="h-5 w-5 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Swap Word (Spy Swap)</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
                      Anytime
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Choose 1 to 3 tiles from your rack to <span className="text-amber-200/95 font-medium">swap with random tiles from a targeted opponent</span>. Offload awkward consonants while taking their useful vowels.
                  </p>
                </div>
              </div>

              {/* 6. FREEZE_TILE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                  <Snowflake className="h-5 w-5 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Freeze Word (Freeze Tile)</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-cyan-300">
                      Own Turn Only
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Freeze a placed tile on the board in crystal ice. <span className="text-amber-200/95 font-medium">Opponents cannot attach or connect any words to this tile</span> until the turn rotation returns to you.
                  </p>
                </div>
              </div>

              {/* 7. DESTROY_TILE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/70 p-3.5 sm:p-4 transition-colors">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-400/25 bg-orange-400/10 text-orange-300">
                  <RotateCcw className="h-5 w-5 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Clear Word (Destroy Tile)</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-medium text-orange-300">
                      Anytime
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Permanently <span className="text-amber-200/95 font-medium">removes 1 tile from the board</span> (excluding center square). Disrupt opponent word combinations or reopen high-scoring multiplier paths.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RULES & GAME MODES */}
          {activeTab === 'rules' && (
            <div className="space-y-3.5">
              {/* Game Modes */}
              <div className="rounded-2xl border border-slate-800/90 bg-slate-900/50 p-4 space-y-3">
                <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-300" />
                  <span>Game Modes</span>
                </h3>

                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <h4 className="text-xs sm:text-sm font-semibold text-rose-300 flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 fill-rose-400/30" />
                      <span>HP Battle Mode</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed font-normal">
                      All players start with 100 HP. Every valid word placed deals its scored points as <span className="text-rose-300 font-medium">damage to all opponents</span>! Players whose HP drops to 0 are eliminated. Last survivor wins!
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <h4 className="text-xs sm:text-sm font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      <span>Turn Count Mode</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed font-normal">
                      Compete over a set number of rounds (e.g. 7 turns). No damage is dealt. Focus on building high-scoring words. <span className="text-indigo-300 font-medium">The highest total score at the end wins!</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Special Rules & Mechanics */}
              <div className="rounded-2xl border border-slate-800/90 bg-slate-900/50 p-4 space-y-2.5">
                <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <span>Key Rules & Scoring</span>
                </h3>

                <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400/80 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-slate-200">Bingo Bonus (+50 Points):</strong> Play all 7 tiles from your rack in a single turn to earn an extra +50 Bingo bonus points!
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400/80 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-slate-200">Tile Exchange:</strong> Exchange any number of tiles from your rack with the bag if you have no playable words (uses your turn).
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400/80 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-slate-200">Pass Turn:</strong> You may pass your turn if you cannot or choose not to place tiles.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400/80 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-slate-200">Turn Timer:</strong> When the turn countdown reaches 0, your turn automatically expires and passes to the next player.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800/80 bg-slate-900/40 px-5 py-3.5 sm:px-6 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            WordX Multiplayer Crossword
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-4 py-2 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
          >
            Got it (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
