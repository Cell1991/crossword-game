'use client';

import React from 'react';
import { Player } from '@/lib/types';
import { Crown, User, CheckCircle2, Bot } from 'lucide-react';

interface PlayerListProps {
  players: Player[];
  myPlayerId?: string | null;
  maxPlayers?: number | null;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, myPlayerId, maxPlayers }) => {
  const limit = maxPlayers || 4;
  return (
    <div className="flex flex-col w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          PLAYERS ({players.length}/{limit})
        </span>
        <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Lobby Ready
        </span>
      </div>

      {players.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-slate-400 text-xs sm:text-sm animate-pulse">
          Connecting to lobby...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {players.map((p) => {
          const isMe = p.id === myPlayerId;
          const isBot = p.display_name.toLowerCase().includes('bot') || p.display_name.toLowerCase().includes('[ai]');
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                isMe
                  ? 'bg-amber-950/40 border-amber-500/50 shadow-md shadow-amber-950/20'
                  : isBot
                  ? 'bg-cyan-950/30 border-cyan-500/40 shadow-sm shadow-cyan-950/20'
                  : 'bg-slate-900/70 border-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className={`p-1.5 rounded-xl ${
                  isMe
                    ? 'bg-amber-500/20 text-amber-300'
                    : isBot
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/25'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <span className={`text-sm truncate ${
                  isMe
                    ? 'font-bold text-amber-200'
                    : isBot
                    ? 'font-semibold text-cyan-200'
                    : 'font-medium text-slate-200'
                }`}>
                  {p.display_name} {isMe && '(You)'}
                </span>
              </div>

              {p.is_host ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                  <Crown className="w-3 h-3" /> Host
                </span>
              ) : isBot ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
                  <Bot className="w-3 h-3" /> AI Bot
                </span>
              ) : null}
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};

