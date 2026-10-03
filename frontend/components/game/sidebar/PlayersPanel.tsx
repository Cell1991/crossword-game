'use client';

import React from 'react';
import { Trophy, Users, Sparkles } from 'lucide-react';
import { Player } from '@/lib/types';
import { PlayerCard } from './PlayerCard';

interface PlayersPanelProps {
  players: Player[];
  showHealth: boolean;
  currentPlayerId: string | null;
  myPlayerId: string | null;
  cardUseEffects?: Record<string, string>;
  pendingDoubleTargetId?: string | null;
}

export const PlayersPanel: React.FC<PlayersPanelProps> = ({
  players,
  showHealth,
  currentPlayerId,
  myPlayerId,
  cardUseEffects = {},
  pendingDoubleTargetId,
}) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const maxHp = 100 + Math.max(0, players.length - 2) * 20;

  return (
    <section aria-label="Players scoreboard" className="w-full shrink-0 flex flex-col gap-2">
      {/* Celestial Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-black tracking-wider uppercase text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
          <Trophy className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
          <span>SCOREBOARD</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-200 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-400/35 shadow-[0_0_8px_rgba(99,102,241,0.25)]">
          <Users className="w-2.5 h-2.5 text-indigo-300" />
          <span>
            {players.length} {players.length === 1 ? 'PLAYER' : 'PLAYERS'}
          </span>
        </span>
      </div>

      {/* Players Card List */}
      <div className="flex flex-col gap-2">
        {sortedPlayers.map((player, idx) => (
          <PlayerCard
            key={player.id}
            player={player}
            rankIndex={idx}
            isCurrent={player.id === currentPlayerId}
            isMe={player.id === myPlayerId}
            showHealth={showHealth}
            maxHp={maxHp}
            cardEffect={cardUseEffects[player.id]}
            isTargeted={Boolean(pendingDoubleTargetId && player.id === pendingDoubleTargetId)}
          />
        ))}
      </div>
    </section>
  );
};
