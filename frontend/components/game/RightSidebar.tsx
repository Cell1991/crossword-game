'use client';

import React, { memo, useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { MoveHistoryEntry, Player } from '@/lib/types';
import { LetterBagCard } from './sidebar/LetterBagCard';
import { PlayersPanel } from './sidebar/PlayersPanel';
import { RecentMovesPanel } from './sidebar/RecentMovesPanel';
import { TileBagDialog } from './TileBagDialog';

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
 * Features:
 * - Starlight Tile Bag status summary card
 * - Celestial Astral Scoreboard with dynamic turn aura, rank crests & vitality essence bar
 * - Star Chronicle Recent Moves history panel with dictionary lookup accordion
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isTileBagOpen, setIsTileBagOpen] = useState(false);
  const tileBagButtonRef = useRef<HTMLButtonElement>(null);

  const closeTileBag = useCallback(() => {
    setIsTileBagOpen(false);
    tileBagButtonRef.current?.focus();
  }, []);

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

      {/* 2. Players Scoreboard Panel */}
      <PlayersPanel
        players={players}
        showHealth={showHealth}
        currentPlayerId={currentPlayerId}
        myPlayerId={myPlayerId}
        cardUseEffects={cardUseEffects}
        pendingDoubleTargetId={pendingDoubleTargetId}
      />

      {/* 3. Recent Moves History Panel */}
      <RecentMovesPanel
        moveHistory={moveHistory}
        myPlayerId={myPlayerId}
        isOpen={isHistoryOpen}
        onToggleOpen={() => setIsHistoryOpen(prev => !prev)}
      />

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
