'use client';

import React, { memo, useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { MoveHistoryEntry, Player } from '@/lib/types';
import { LetterBagCard } from './sidebar/LetterBagCard';
import { PlayersPanel } from './sidebar/PlayersPanel';
import { RecentMovesPanel } from './sidebar/RecentMovesPanel';
import { TileBagDialog } from './TileBagDialog';
import { Trophy, ScrollText, Sparkles } from 'lucide-react';

export interface RightSidebarProps {
  players: Player[];
  showHealth: boolean;
  currentPlayerId: string | null;
  myPlayerId: string | null;
  tileBagCount: number;
  tileBagCounts: Record<string, number>;
  moveHistory?: MoveHistoryEntry[];
  cardUseEffects?: Record<string, string>;
  pendingDoubleTargetId?: string | null;
  mobile?: boolean;
}

/**
 * WordX Celestial Cosmic Scoreboard & Match Information Sidebar.
 * Enhanced with dual Tab views: [🏆 Scoreboard] & [📜 Match Log & Lexicon]
 * to guarantee complete visibility on screens with 2 to 8 players!
 */
export const RightSidebar = memo(function RightSidebar({
  players,
  showHealth,
  currentPlayerId,
  myPlayerId,
  tileBagCount,
  tileBagCounts,
  moveHistory = [],
  cardUseEffects = {},
  pendingDoubleTargetId,
  mobile = false,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'log'>('scoreboard');
  const [isHistoryAccordionOpen, setIsHistoryAccordionOpen] = useState(true);
  const [isTileBagOpen, setIsTileBagOpen] = useState(false);
  const tileBagButtonRef = useRef<HTMLButtonElement>(null);

  const closeTileBag = useCallback(() => {
    setIsTileBagOpen(false);
    tileBagButtonRef.current?.focus();
  }, []);

  const totalMoves = moveHistory.length;

  return (
    <aside
      className={`relative flex h-full flex-col select-none ${
        mobile
          ? 'w-full p-2.5 gap-2.5 bg-transparent'
          : 'w-full p-2.5 gap-2.5'
      }`}
    >
      {/* Subtle Celestial Nebula Ambient Backdrops */}
      {!mobile && (
        <>
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 left-0 w-36 h-36 bg-amber-500/8 rounded-full blur-2xl pointer-events-none" />
        </>
      )}

      {/* 1. Letter Bag Status Card */}
      <LetterBagCard
        tileBagCount={tileBagCount}
        onClick={() => setIsTileBagOpen(true)}
        buttonRef={tileBagButtonRef}
      />

      {/* 2. Dual Tab Selector (Allows instant toggle between Scoreboard and full Match Log) */}
      <div className="flex items-center p-1 rounded-2xl bg-black/40 border border-white/10 shadow-inner shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('scoreboard')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none whitespace-nowrap active:scale-95 ${
            activeTab === 'scoreboard'
              ? 'bg-gradient-to-r from-amber-400/25 via-yellow-500/20 to-amber-400/25 text-amber-200 border border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Scores</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[9.5px] font-mono font-bold text-slate-300">
            {players.length}P
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('log')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-black transition-all cursor-pointer select-none whitespace-nowrap active:scale-95 ${
            activeTab === 'log'
              ? 'bg-gradient-to-r from-purple-500/25 via-indigo-500/20 to-purple-500/25 text-purple-200 border border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <ScrollText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>Log</span>
          {totalMoves > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-purple-400/20 text-[9.5px] font-mono font-bold text-purple-200">
              {totalMoves}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content 1: Scoreboard View */}
      <div className={`flex flex-col gap-2.5 flex-1 min-h-0 ${activeTab === 'scoreboard' ? 'flex' : 'hidden'}`}>
        <PlayersPanel
          players={players}
          showHealth={showHealth}
          currentPlayerId={currentPlayerId}
          myPlayerId={myPlayerId}
          cardUseEffects={cardUseEffects}
          pendingDoubleTargetId={pendingDoubleTargetId}
        />

        {/* Collapsible Match Log at Bottom of Scoreboard */}
        <div className="pt-1 border-t border-white/10 mt-auto shrink-0">
          <RecentMovesPanel
            moveHistory={moveHistory}
            myPlayerId={myPlayerId}
            isOpen={isHistoryAccordionOpen}
            onToggleOpen={() => setIsHistoryAccordionOpen(prev => !prev)}
            maxItems={10}
          />
        </div>
      </div>

      {/* Tab Content 2: Full Match Log & Dictionary View */}
      <div className={`flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 ${activeTab === 'log' ? 'block' : 'hidden'}`}>
        <RecentMovesPanel
          moveHistory={moveHistory}
          myPlayerId={myPlayerId}
          isOpen={true}
          onToggleOpen={() => {}}
          hideHeaderTrigger={true}
          maxItems={50}
        />
      </div>

      {/* 4. Tile Bag Breakdown Dialog Modal */}
      <AnimatePresence>
        {isTileBagOpen && (
          <TileBagDialog
            tileBagCount={tileBagCount}
            tileBagCounts={tileBagCounts}
            onClose={closeTileBag}
          />
        )}
      </AnimatePresence>
    </aside>
  );
});
