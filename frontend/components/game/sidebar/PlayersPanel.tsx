'use client';

import React from 'react';
import { Trophy, Users } from 'lucide-react';
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
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[11.5px] font-black tracking-wider uppercase font-mono text-cyan-300">
          <Trophy className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,197,0.7)]" />
          <span>SCOREBOARD</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-black font-mono text-cyan-300 bg-cyan-950/70 px-2.5 py-0.5 rounded-full border border-cyan-400/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
          <Users className="w-2.5 h-2.5 text-cyan-400" />
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
