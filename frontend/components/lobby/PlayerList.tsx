'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Player } from '@/lib/types';
import { Crown, User, CheckCircle2, Bot } from 'lucide-react';

interface PlayerListProps {
  players: Player[];
  myPlayerId?: string | null;
  maxPlayers?: number | null;
}

export const PlayerList: React.FC<PlayerListProps> = ({ players, myPlayerId, maxPlayers }) => {
  const limit = maxPlayers || 4;
  const emptySlotsCount = Math.max(0, limit - players.length);

  return (
    <div className="flex flex-col w-full mx-auto">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-black uppercase tracking-wider text-amber-200/90 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-amber-300" />
          <span>PLAYERS ({players.length}/{limit})</span>
        </span>
        <span className="text-xs text-emerald-300 flex items-center gap-1.5 font-black bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Lobby Ready
        </span>
      </div>

      {players.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-amber-200/60 text-xs sm:text-sm animate-pulse font-semibold">
          Connecting to lobby...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {players.map((p) => {
            const isMe = p.id === myPlayerId;
            const isBot = Boolean(p.is_bot);
            const isHost = Boolean(p.is_host);

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  isHost
                    ? 'bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/30 border-2 border-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.25)] ring-1 ring-amber-400/30'
                    : isBot
                    ? 'bg-gradient-to-r from-purple-950/40 via-slate-900/90 to-purple-950/30 border border-purple-400/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                    : isMe
                    ? 'bg-gradient-to-r from-cyan-950/40 via-slate-900/90 to-cyan-950/30 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                    : 'bg-slate-900/80 border border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl font-black text-xs shrink-0 ${
                    isHost
                      ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                      : isBot
                      ? 'bg-gradient-to-br from-purple-400 to-indigo-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                      : 'bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                  }`}>
                    {isHost ? <Crown className="w-4 h-4 fill-slate-950/30" /> : isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs sm:text-sm truncate ${
                    isHost
                      ? 'font-black text-yellow-100 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]'
                      : isBot
                      ? 'font-black text-purple-200'
                      : isMe
                      ? 'font-black text-cyan-200'
                      : 'font-bold text-slate-200'
                  }`}>
                    {p.display_name} {isMe && '(You)'}
                  </span>
                </div>

                {isHost ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-slate-950 rounded-full text-[9px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(251,191,36,0.5)] shrink-0">
                    <Crown className="w-3 h-3 fill-slate-950/30" /> Host
                  </span>
                ) : isBot ? (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 bg-gradient-to-r from-purple-400 to-indigo-500 text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(168,85,247,0.4)] shrink-0">
                    <Bot className="w-3 h-3" /> AI Bot
                  </span>
                ) : null}
              </motion.div>
            );
          })}

          {/* Empty Slot Placeholders */}
          {Array.from({ length: Math.min(emptySlotsCount, 4) }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="flex items-center justify-between p-3 rounded-2xl border border-dashed border-amber-400/20 bg-slate-950/40 text-amber-200/40 text-xs font-semibold"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl border border-dashed border-amber-400/20 flex items-center justify-center text-amber-200/30">
                  <User className="w-4 h-4 opacity-40" />
                </div>
                <span className="italic">Waiting for player...</span>
              </div>
              <span className="text-[10px] font-bold text-amber-400/30">Open Slot</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

