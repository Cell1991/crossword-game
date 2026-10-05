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
  Flame,
  Layers,
  Clock,
  SkipForward,
  Swords,
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
      className="guide-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 sm:backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl h-[86dvh] sm:h-[650px] max-h-[88vh] flex flex-col rounded-[28px] sm:rounded-[32px] border border-white/10 bg-[#0c101c]/98 text-left shadow-[0_24px_80px_rgba(0,0,0,0.85)] ring-1 ring-white/5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft Warm Champagne Accent Line */}
        <span className="absolute inset-x-16 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />

        {/* Modal Header - Spacious & Clean */}
        <div className="flex items-center justify-between px-6 py-4 sm:px-8 sm:py-5 border-b border-white/[0.07] bg-white/[0.01]">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300 shrink-0">
              <BookOpen className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h2 id="guide-modal-title" className="text-base sm:text-xl font-bold tracking-tight text-white">
                Game Guide
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Special cells, power cards & rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/15 hover:text-white hover:border-white/20 active:scale-95 cursor-pointer"
            aria-label="Close guide"
          >
            <X className="h-4.5 w-4.5 stroke-[2.2]" />
          </button>
        </div>

        {/* Navigation Tabs - Seamless Pill Bar */}
        <div className="px-5 sm:px-8 py-3 border-b border-white/[0.06] bg-black/25">
          <div className="flex rounded-2xl bg-white/[0.03] border border-white/[0.06] p-1 gap-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('board')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'board'
                  ? 'bg-slate-800 text-amber-200 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Zap className={`h-4 w-4 ${activeTab === 'board' ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>Board & Tiles</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cards')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'cards'
                  ? 'bg-slate-800 text-amber-200 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
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
                  ? 'bg-slate-800 text-amber-200 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Layers className={`h-4 w-4 ${activeTab === 'rules' ? 'text-amber-300' : 'text-slate-400'}`} />
              <span>Rules & Modes</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body - Open, Luxurious & Breathing */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 sm:px-8 sm:py-6 space-y-3">
          {/* TAB 1: BOARD & TILES */}
          {activeTab === 'board' && (
            <div className="space-y-3">
              {/* 1. Lightning Power Cell */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
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
                    <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
                      Card Drop
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Awards <span className="text-amber-200/95 font-medium">1 random Power Card</span> when you place a tile here. (Holds up to 3 cards)
                  </p>
                </div>
              </div>

              {/* 2. 3L Triple Letter Cell */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-red-300/60 bg-red-950/40 shadow-[0_0_14px_rgba(239,68,68,0.4)] board-triple-aura overflow-hidden">
                  <span className="board-fire-core absolute inset-[18%] rounded-full bg-red-400/40" />
                  <span className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white font-black text-xl font-maple drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    3<span className="board-premium-letter">L</span>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">3L Cell</h3>
                    <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-rose-300">
                      Letter Score ×3
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Triples the point value of any letter tile placed on this cell (<span className="text-amber-200/95 font-medium">Letter Score × 3</span>).
                  </p>
                </div>
              </div>

              {/* 3. 2L Double Letter Cell */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
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
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Letter Score ×2
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Doubles the point value of any letter tile placed on this cell (<span className="text-amber-200/95 font-medium">Letter Score × 2</span>).
                  </p>
                </div>
              </div>

              {/* 4. Center Star Cell */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-300/70 bg-[#1e1b4b] shadow-[0_0_16px_rgba(251,191,36,0.35)] board-center-pulse overflow-hidden">
                  <span className="text-[39px] leading-none font-sans text-[#fbbf24] drop-shadow-[0_0_10px_rgba(251,191,36,0.85)] select-none">
                    ★
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Center Star</h3>
                    <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      Board Center
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    The origin center of the board. The <span className="text-amber-200/95 font-medium">very first word of the match</span> must cover this star.
                  </p>
                </div>
              </div>

              {/* 5. Blank Wildcard Tile */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
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
                    <h3 className="text-sm sm:text-base font-semibold text-white">Blank Tile</h3>
                    <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      Wildcard (0 Pts)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Worth 0 points, but represents <span className="text-amber-200/95 font-medium">any letter (A–Z)</span>. Pick your desired letter when placing it.
                  </p>
                </div>
              </div>

              {/* 6. Opponent Live Placement Tile */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-sky-400 bg-gradient-to-b from-[#0284c7] via-[#0369a1] to-[#082f49] shadow-[0_0_14px_rgba(56,189,248,0.45)] overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 via-sky-300/10 to-transparent pointer-events-none" />
                  <div className="absolute inset-1 rounded-lg border border-sky-300/30 pointer-events-none" />
                  <div className="relative z-10 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#e0f2fe] drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]" fill="currentColor">
                      <polygon points="12,2.5 14.2,9.8 21.5,12 14.2,14.2 12,21.5 9.8,14.2 2.5,12 9.8,9.8" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Opponent Placement</h3>
                    <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
                      Live Move
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Shows where an opponent is placing tiles in real time. Letters stay hidden under this <span className="text-amber-200/95 font-medium">blue star</span> until confirmed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THE 7 POWER CARDS */}
          {activeTab === 'cards' && (
            <div className="space-y-3">
              {/* 1. HINT */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
                  <Eye className="h-6 w-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Hint</h3>
                    <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      Your Turn
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Highlights the <span className="text-amber-200/95 font-medium">top 3 highest-scoring word placements</span> and point values.
                  </p>
                </div>
              </div>

              {/* 2. SHIELD */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-400/10 text-blue-300">
                  <Shield className="h-6 w-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Shield</h3>
                    <span className="rounded-full border border-blue-400/25 bg-blue-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300">
                      Passive
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    <span className="text-amber-200/95 font-medium">Fully blocks</span> the next incoming attack damage or tile swap - no points math, usable anytime including an opponent's turn.
                  </p>
                </div>
              </div>

              {/* 3. HEAL */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300">
                  <Heart className="h-6 w-6 fill-rose-400/30 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Heal</h3>
                    <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-rose-300">
                      HP Mode
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    <span className="text-amber-200/95 font-medium">Restores HP</span> equal to 100% of your points scored on this move.
                  </p>
                </div>
              </div>

              {/* 4. DOUBLE_DAMAGE */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-purple-400/25 bg-purple-400/10 text-purple-300">
                  <Swords className="h-6 w-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Double Damage</h3>
                    <span className="rounded-full border border-purple-400/25 bg-purple-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300">
                      HP Mode
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Your next confirmed word deals <span className="text-amber-200/95 font-medium">double (2×) attack damage</span> to a targeted rival.
                  </p>
                </div>
              </div>

              {/* 5. SPY_SWAP */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                  <Repeat2 className="h-6 w-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Spy Swap</h3>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Your Turn
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Swap 1 to 7 rack tiles with <span className="text-amber-200/95 font-medium">random tiles stolen directly from an opponent</span>. Can only be activated on your turn.
                  </p>
                </div>
              </div>

              {/* 6. FREEZE_TILE */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                  <Snowflake className="h-6 w-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Freeze Tile</h3>
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                      Your Turn
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Locks 1 to 3 board tiles in ice. <span className="text-amber-200/95 font-medium">Opponents cannot connect words to them</span> until your next turn.
                  </p>
                </div>
              </div>

              {/* 7. DESTROY_TILE */}
              <div className="flex items-center sm:items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] p-3.5 sm:p-4 transition-all">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-orange-400/25 bg-orange-400/10 text-orange-300">
                  <Flame className="h-6 w-6 stroke-[2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-semibold text-white">Destroy Tile</h3>
                    <span className="rounded-full border border-orange-400/25 bg-orange-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-orange-300">
                      Your Turn
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                    Permanently <span className="text-amber-200/95 font-medium">removes 1 tile from the board</span> to break enemy words or reopen multiplier cells. Can only be activated on your turn.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RULES & GAME MODES */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* Game Modes - Instant Structured Contrast */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* HP Battle */}
                <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-b from-rose-500/[0.08] to-transparent p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
                          <Heart className="h-4 w-4 fill-rose-400/40" />
                        </span>
                        <span className="text-sm sm:text-base font-bold text-white">HP Battle</span>
                      </div>
                      <span className="rounded-full bg-rose-500/15 border border-rose-500/25 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 uppercase tracking-wider">
                        Survival
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 w-16 shrink-0">Goal</span>
                        <span className="font-semibold text-white">Last survivor wins</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 w-16 shrink-0">Scoring</span>
                        <span className="text-rose-200">Word points deal HP damage to all rivals</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Round Count */}
                <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-b from-indigo-500/[0.08] to-transparent p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                          <Layers className="h-4 w-4" />
                        </span>
                        <span className="text-sm sm:text-base font-bold text-white">Round Count</span>
                      </div>
                      <span className="rounded-full bg-indigo-500/15 border border-indigo-500/25 px-2.5 py-0.5 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                        Classic
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 w-16 shrink-0">Goal</span>
                        <span className="font-semibold text-white">Highest total score wins</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 w-16 shrink-0">Rounds</span>
                        <span className="text-indigo-200">Equal turns per player (no damage)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Rules & Actions - 2x2 Grid of Micro Cards */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Match Rules & Actions
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Rule 1: Bingo Bonus */}
                  <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-3 sm:p-3.5 transition-all">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300 border border-amber-400/25">
                      <Sparkles className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-white">Bingo Bonus</span>
                        <span className="text-[10px] font-extrabold text-amber-300 bg-amber-400/15 px-1.5 py-0.2 rounded border border-amber-400/25">
                          +50 Pts
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-snug">
                        Place all 7 rack tiles in one turn
                      </p>
                    </div>
                  </div>

                  {/* Rule 2: Tile Exchange */}
                  <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-3 sm:p-3.5 transition-all">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300 border border-sky-400/25">
                      <Repeat2 className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold text-white">Tile Exchange</span>
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-snug">
                        Swap rack tiles with bag (uses turn)
                      </p>
                    </div>
                  </div>

                  {/* Rule 3: Pass Turn */}
                  <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-3 sm:p-3.5 transition-all">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-700/40 text-slate-300 border border-slate-600/40">
                      <SkipForward className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold text-white">Pass Turn</span>
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-snug">
                        Skip if no playable words can be formed
                      </p>
                    </div>
                  </div>

                  {/* Rule 4: Turn Timer */}
                  <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-3 sm:p-3.5 transition-all">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-400/15 text-purple-300 border border-purple-400/25">
                      <Clock className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-bold text-white">Turn Timer</span>
                      <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-snug">
                        Auto-passes when countdown hits 0
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer - Standout Prominent Close Button */}
        <div className="border-t border-white/[0.08] bg-black/35 px-6 py-3.5 sm:px-8 sm:py-4 flex items-center justify-between">
          <span className="text-xs text-slate-400 hidden sm:inline-flex items-center gap-1.5">
            <span className="rounded px-1.5 py-0.5 bg-white/5 border border-white/10 text-[10px] text-slate-400 font-mono">ESC</span>
            <span>to close</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto ml-auto rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-7 py-2.5 text-xs sm:text-sm shadow-[0_4px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.38)] transition-all active:scale-95 cursor-pointer"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
}
