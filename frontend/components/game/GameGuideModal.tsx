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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-slate-900/98 text-left shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(6,182,212,0.2)] ring-1 ring-white/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top luminous accent beam */}
        <span className="absolute inset-x-8 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 sm:px-6 sm:py-5 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.35)] shrink-0">
              <BookOpen className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="guide-modal-title" className="text-lg sm:text-xl font-black tracking-tight text-white">
                  WordX Game Guide
                </h2>
                <span className="rounded-full border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                  Manual
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Board special squares, magic power cards & gameplay mechanics
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white active:scale-95 cursor-pointer"
            aria-label="Close guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('board')}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'board'
                ? 'border-cyan-400 text-cyan-300 shadow-[0_4px_12px_-2px_rgba(6,182,212,0.5)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-4 w-4 text-cyan-400" />
            <span>Board Symbols</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cards'
                ? 'border-purple-400 text-purple-300 shadow-[0_4px_12px_-2px_rgba(168,85,247,0.5)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span>7 Power Cards</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'rules'
                ? 'border-amber-400 text-amber-300 shadow-[0_4px_12px_-2px_rgba(245,158,11,0.5)]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4 text-amber-400" />
            <span>Rules & Modes</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: BOARD SPECIAL SQUARES */}
          {activeTab === 'board' && (
            <div className="space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                The WordX board features animated special cells that grant multipliers, power card drops, and starting rules:
              </p>

              {/* 1. Lightning Power Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(6,182,212,0.15)]">
                {/* Exact Animated Lightning Cell from Board */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-cyan-200/75 bg-cyan-400/20 shadow-[inset_0_0_10px_rgba(165,243,252,0.18),0_0_22px_rgba(34,211,238,0.55)] board-power-pulse overflow-hidden">
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
                    <h3 className="text-sm sm:text-base font-bold text-white">Lightning Cell (Power Card Drop)</h3>
                    <span className="rounded-md border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                      Card Drop
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Placing a tile on any glowing Lightning Cell instantly awards you <strong className="text-cyan-300">1 random Secret Power Card</strong> directly into your hand! You can hold up to 3 power cards at a time.
                  </p>
                </div>
              </div>

              {/* 2. 3L Triple Letter Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-rose-500/35 bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(244,63,94,0.15)]">
                {/* Exact Animated 3L Fire Cell from Board */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-red-300/60 bg-red-950/40 shadow-[0_0_16px_rgba(239,68,68,0.4)] board-triple-aura overflow-hidden">
                  <span className="board-fire-core absolute inset-[18%] rounded-full bg-red-400/40" />
                  <span className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white font-black text-xl font-maple drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    3<span className="board-premium-letter">L</span>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">3L Cell (Triple Letter Score)</h3>
                    <span className="rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                      Letter Score ×3
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Triples the point value of any letter tile placed on this cell (<strong className="text-rose-300">Letter Score × 3</strong>) for that turn.
                  </p>
                </div>
              </div>

              {/* 3. 2L Double Letter Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-500/35 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(34,197,94,0.15)]">
                {/* Exact Animated 2L Earth Cell from Board */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-emerald-300/45 bg-emerald-950/40 shadow-[0_0_16px_rgba(34,197,94,0.35)] board-double-aura overflow-hidden">
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
                    <h3 className="text-sm sm:text-base font-bold text-white">2L Cell (Double Letter Score)</h3>
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                      Letter Score ×2
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Doubles the point value of any letter tile placed on this cell (<strong className="text-emerald-300">Letter Score × 2</strong>) for that turn.
                  </p>
                </div>
              </div>

              {/* 4. Center Star Cell */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4">
                {/* Exact Center Star from Board */}
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-amber-300/60 bg-[#1e1b4b] shadow-[0_0_18px_rgba(251,191,36,0.35)] board-center-pulse overflow-hidden">
                  <span className="text-2xl font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] select-none">
                    ★
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Center Star Cell (Board Origin)</h3>
                    <span className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                      Starting Square
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    The exact center of the board. The <strong className="text-amber-200">very first word of the match</strong> must be placed across this star cell.
                  </p>
                </div>
              </div>

              {/* 5. Blank Wildcard Tile */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4">
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
                    <h3 className="text-sm sm:text-base font-bold text-white">Blank Wildcard Tile (0 Pts)</h3>
                    <span className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                      Wildcard (A–Z)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Carries 0 points, but can represent <strong className="text-amber-200">any English letter (A–Z)</strong> of your choice. When placed on the board, an interactive picker modal lets you choose the designated letter.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THE 7 POWER CARDS */}
          {activeTab === 'cards' && (
            <div className="space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Awarded by placing tiles onto Lightning Cells. You can hold up to 3 cards simultaneously to turn the tide of battle:
              </p>

              {/* 1. HINT */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(245,158,11,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/20 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.35)]">
                  <Eye className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Hint</h3>
                    <span className="rounded-md border border-amber-400/40 bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                      Own Turn Only
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Scans the current board and your rack to calculate and highlight the <strong className="text-amber-300">top 3 highest-scoring word placements</strong>, showing preview positions and estimated points.
                  </p>
                </div>
              </div>

              {/* 2. SHIELD */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-blue-500/40 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(59,130,246,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-400/50 bg-blue-500/20 text-blue-300 shadow-[0_0_16px_rgba(59,130,246,0.35)]">
                  <Shield className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Shield</h3>
                    <span className="rounded-md border border-blue-400/40 bg-blue-500/25 px-2 py-0.5 text-[10px] font-bold text-blue-200">
                      Anytime / Reactive
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Erects an impenetrable defensive shield that <strong className="text-blue-300">completely blocks incoming Damage or tile Swaps</strong> from opponents. Can be deployed proactively or as an instant counter.
                  </p>
                </div>
              </div>

              {/* 3. HEAL */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(244,63,94,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-400/50 bg-rose-500/20 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.35)]">
                  <Heart className="h-6 w-6 fill-rose-400/50 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Heal</h3>
                    <span className="rounded-md border border-rose-400/40 bg-rose-500/25 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                      Anytime (HP Mode)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    <strong className="text-rose-300">Instantly restores your HP</strong> by the sum of all point values of letter tiles currently sitting on your rack. Hold high-value tiles to maximize your recovery!
                  </p>
                </div>
              </div>

              {/* 4. DOUBLE_DAMAGE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(168,85,247,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-purple-400/50 bg-purple-500/20 text-purple-300 shadow-[0_0_16px_rgba(168,85,247,0.35)]">
                  <span className="text-lg font-black tracking-tighter">×2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Word ×2 (Double Damage)</h3>
                    <span className="rounded-md border border-purple-400/40 bg-purple-500/25 px-2 py-0.5 text-[10px] font-bold text-purple-200">
                      Own Turn Only (HP Mode)
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Target an opponent before confirming your move. Your word deals <strong className="text-purple-300">double (2×) attack damage</strong> directly lowering their HP for devastating knockouts!
                  </p>
                </div>
              </div>

              {/* 5. SPY_SWAP */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(16,185,129,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.35)]">
                  <Repeat2 className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Swap Word (Spy Swap)</h3>
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                      Anytime
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Choose 1 to 3 tiles from your rack to <strong className="text-emerald-300">swap with random tiles from a targeted opponent</strong>. Offload awkward letters while snatching valuable tiles from their hand!
                  </p>
                </div>
              </div>

              {/* 6. FREEZE_TILE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(6,182,212,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.35)]">
                  <Snowflake className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Freeze Word (Freeze Tile)</h3>
                    <span className="rounded-md border border-cyan-400/40 bg-cyan-500/25 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                      Own Turn Only
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Freeze a placed tile on the board in crystal ice. <strong className="text-cyan-300">Opponents cannot attach or connect any letters to this tile</strong> until the turn rotation returns to you!
                  </p>
                </div>
              </div>

              {/* 7. DESTROY_TILE */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-orange-500/40 bg-gradient-to-r from-orange-950/40 via-slate-900/60 to-slate-900/40 p-3.5 sm:p-4 shadow-[0_4px_18px_rgba(249,115,22,0.12)]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-orange-400/50 bg-orange-500/20 text-orange-300 shadow-[0_0_16px_rgba(249,115,22,0.35)]">
                  <RotateCcw className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-white">Clear Word (Destroy Tile)</h3>
                    <span className="rounded-md border border-orange-400/40 bg-orange-500/25 px-2 py-0.5 text-[10px] font-bold text-orange-200">
                      Anytime
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Permanently <strong className="text-orange-300">vaporize and remove 1 tile from the board</strong> (excluding center square). Disrupt opponent word combinations or reopen high-scoring multiplier paths!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RULES & GAME MODES */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* Game Modes */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-amber-400" />
                  <span>Game Modes</span>
                </h3>

                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <h4 className="text-sm font-bold text-rose-300 flex items-center gap-1.5">
                      <Heart className="h-4 w-4 fill-rose-400/40" />
                      <span>HP Battle Mode</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                      All players start with 100 HP (or custom lobby setting). Every valid word placed deals its scored points as <strong className="text-rose-300">damage to all opponents</strong>! Players whose HP reaches 0 are eliminated. The last survivor wins!
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                      <Layers className="h-4 w-4" />
                      <span>Turn Count Mode</span>
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                      Compete over a set number of rounds (e.g. 7 turns). No damage is dealt. Focus on building high-scoring words and leveraging multipliers. <strong className="text-indigo-300">The highest total score at the end wins!</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Special Rules & Mechanics */}
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-2.5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>Key Rules & Scoring</span>
                </h3>

                <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-amber-300">Bingo Bonus (+50 Points):</strong> Play all 7 tiles from your rack in a single turn to receive an instant +50 Bingo point bonus!
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-cyan-300">Tile Exchange:</strong> Exchange any number of tiles from your rack with the bag if you have no playable words (uses your turn).
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-slate-200">Pass Turn:</strong> You may pass your turn if you cannot or choose not to place tiles.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">✦</span>
                    <div>
                      <strong className="text-purple-300">Turn Timer:</strong> When the turn countdown reaches 0, your turn automatically expires and passes to the next player.
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-900/60 px-5 py-3.5 sm:px-6 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            WordX Multiplayer Crossword Game
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2 text-xs sm:text-sm font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white active:scale-95 cursor-pointer"
          >
            Got it (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
