'use client';

import React from 'react';
import { Player } from '../../lib/types';
import { Crown, Trophy, Wifi, WifiOff } from 'lucide-react';

interface ScoreBoardProps {
  players: Player[];
  currentPlayerId: string | null;
  myPlayerId: string | null;
  tileBagCount: number;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  players,
  currentPlayerId,
  myPlayerId,
  tileBagCount,
}) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col bg-slate-900/85 backdrop-blur-md rounded-2xl border border-slate-700/60 p-3 sm:p-4 shadow-xl text-slate-200">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/50">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Scoreboard</span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Tiles remaining: <span className="font-bold text-amber-300">{tileBagCount}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {sortedPlayers.map((player, idx) => {
          const isCurrent = player.id === currentPlayerId;
          const isMe = player.id === myPlayerId;

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                isCurrent
                  ? 'bg-indigo-950/70 border border-indigo-500/50 shadow-sm'
                  : 'bg-slate-800/40 border border-slate-700/30'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono font-bold text-slate-500 w-4">
                  {idx + 1}.
                </span>
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`text-sm truncate ${isMe ? 'font-bold text-amber-300' : 'font-medium'}`}>
                    {player.display_name} {isMe && '(You)'}
                  </span>
                  {player.is_host && (
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {player.score}
                </span>
                {player.connection_status === 'ONLINE' ? (
                  <Wifi className="w-3 h-3 text-emerald-400/80" />
                ) : (
                  <WifiOff className="w-3 h-3 text-rose-400/80" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
