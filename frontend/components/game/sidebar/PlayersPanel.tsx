'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
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
    <section aria-label="Players scoreboard" className="w-full shrink-0 flex flex-col gap-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase font-mono text-cyan-300">
          <Trophy className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,197,0.5)]" />
          <span>SCOREBOARD</span>
        </div>
        <span className="text-[10px] font-black font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-400/30">
          {players.length} {players.length === 1 ? 'PLAYER' : 'PLAYERS'}
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
