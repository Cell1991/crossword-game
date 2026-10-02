'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { Player } from '@/lib/types';
import { PlayerCard } from './PlayerCard';

interface PlayersPanelProps {
  players: Player[];
  showHealth: boolean;
  currentPlayerId: string | null;
  myPlayerId: string | null;
  cardUseEffects?: Record<string, string>;
}

export const PlayersPanel: React.FC<PlayersPanelProps> = ({
  players,
  showHealth,
  currentPlayerId,
  myPlayerId,
  cardUseEffects = {},
}) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const maxHp = 100 + Math.max(0, players.length - 2) * 20;

  return (
    <section aria-label="Players scoreboard" className="w-full shrink-0 flex flex-col">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#91A0B5] uppercase">
          <Users className="w-3.5 h-3.5 text-[#91A0B5]" />
          <span>PLAYERS</span>
        </div>
        <span className="text-[11px] font-medium text-[#66758A]">
          {players.length} {players.length === 1 ? 'player' : 'players'}
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
          />
        ))}
      </div>
    </section>
  );
};
