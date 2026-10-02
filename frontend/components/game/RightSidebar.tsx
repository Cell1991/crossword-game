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
 * WordX Clean Tactical Scoreboard & Match Information Sidebar.
 * Features:
 * - Letter bag tile status summary card
 * - Compact high-contrast player scoreboard with active-player cyan highlight & health bar
 * - Collapsible Recent Moves history panel with dictionary lookup accordion
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
      className={`flex h-full flex-col select-none ${
        mobile
          ? 'w-full p-2.5 gap-2.5 bg-transparent'
          : 'w-full p-2.5 gap-2.5'
      }`}
    >
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
