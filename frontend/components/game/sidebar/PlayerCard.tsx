'use client';

import React from 'react';
import { Crown, Shield, WifiOff, Sparkles } from 'lucide-react';
import { Player } from '@/lib/types';
import { cardIcon } from '../cardIcons';

interface PlayerCardProps {
  player: Player;
  rankIndex: number;
  isCurrent: boolean;
  isMe: boolean;
  showHealth: boolean;
  maxHp: number;
  cardEffect?: string;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  rankIndex,
  isCurrent,
  isMe,
  showHealth,
  maxHp,
  cardEffect,
}) => {
  const isDead = player.hp <= 0;
  const hasLeft = player.connection_status === 'OFFLINE';
  const hasShield = Boolean(player.has_shield && !isDead);
  const playerMaxHp = player.max_hp || maxHp;
  const displayName = player.display_name.trim() || 'Player';

  const isActiveTurn = isCurrent && !isDead && !hasLeft;
  const isLeader = rankIndex === 0 && !isDead;
  const healthPercent = Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100));

  // Vibrant, high-contrast health bar colors
  const hpGradient = hasShield
    ? 'from-sky-400 to-cyan-500 shadow-[0_0_10px_rgba(56,189,248,0.5)]'
    : player.hp <= playerMaxHp * 0.25
    ? 'from-rose-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
    : player.hp <= playerMaxHp * 0.5
    ? 'from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
    : 'from-emerald-400 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]';

  const hpTextColor = hasShield
    ? 'text-sky-300'
    : player.hp <= playerMaxHp * 0.25
    ? 'text-rose-400'
    : player.hp <= playerMaxHp * 0.5
    ? 'text-amber-400'
    : 'text-emerald-400';

  return (
    <div
      className={`relative flex flex-col p-2.5 rounded-2xl transition-all duration-200 select-none overflow-hidden ${
        isDead || hasLeft
          ? 'bg-slate-950/40 border border-white/[0.04] opacity-40 grayscale-[40%]'
          : isActiveTurn
          ? 'bg-gradient-to-r from-[#0d2a3d]/95 via-[#081e2d]/95 to-[#05131d]/95 border-2 border-cyan-400 shadow-[0_0_24px_rgba(34,211,197,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-cyan-400/40'
          : isMe
          ? 'bg-gradient-to-r from-[#17253b]/90 via-[#0e1929]/90 to-[#09111e]/95 border border-amber-400/35 hover:border-amber-400/60 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
          : 'bg-gradient-to-r from-[#132033]/80 via-[#0c1524]/85 to-[#080e1a]/90 hover:from-[#17273d]/90 hover:to-[#0d1828] border border-white/10 hover:border-white/20 shadow-[0_4px_14px_rgba(0,0,0,0.35)]'
      }`}
    >
      {/* Active turn cyan glow accent */}
      {isActiveTurn && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Top Row: Rank + Identity + Big Score */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        {/* Left: Rank Badge + Name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Rank Badge */}
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 font-mono shadow-sm ${
              isLeader
                ? 'bg-gradient-to-br from-amber-300 to-amber-600 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                : rankIndex === 1
                ? 'bg-slate-400 text-slate-950 font-bold'
                : rankIndex === 2
                ? 'bg-amber-700/80 text-amber-100 font-bold'
                : 'bg-slate-800 text-slate-400 font-bold border border-white/5'
            }`}
            title={`Rank #${rankIndex + 1}`}
          >
            {isLeader ? <Crown className="w-3 h-3 text-slate-950" /> : rankIndex + 1}
          </div>

          {/* Player Name */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className={`text-xs sm:text-sm font-extrabold truncate ${
                isMe
                  ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                  : isActiveTurn
                  ? 'text-white'
                  : 'text-slate-200'
              }`}
              title={displayName}
            >
              {displayName}
            </span>

            {/* Shield Active Icon */}
            {hasShield && (
              <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-sky-400/20 border border-sky-400/50 text-[9px] font-bold text-sky-300 shrink-0">
                <Shield className="w-2.5 h-2.5 text-sky-300" />
              </span>
            )}

            {/* Card effect in play */}
            {cardEffect && (
              <span
                className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-purple-500/20 border border-purple-400/40 text-[9px] font-bold text-purple-300 shrink-0"
                title={`${cardEffect} active`}
              >
                <Sparkles className="w-2.5 h-2.5 text-purple-300" />
                <span>{cardIcon(cardEffect, 'h-2.5 w-2.5', <span>×2</span>) ?? cardEffect}</span>
              </span>
            )}

            {/* Offline / Eliminated Notice */}
            {(isDead || hasLeft) && (
              <span className="text-[10px] font-bold shrink-0">
                {isDead ? (
                  <span className="text-rose-400">Eliminated</span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-0.5">
                    <WifiOff className="w-2.5 h-2.5" /> Off
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Right: Giant Focal Point Score */}
        <div className="flex items-baseline gap-1 shrink-0 pl-2">
          <span
            className={`text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums ${
              isLeader
                ? 'bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]'
                : isActiveTurn
                ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,197,0.4)]'
                : 'text-white'
            }`}
          >
            {player.score}
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase font-mono">
            PTS
          </span>
        </div>
      </div>

      {/* Bottom Row: Linear Health Meter (If HP enabled & not eliminated) */}
      {showHealth && !isDead && (
        <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-center gap-2 relative z-10">
          {/* Health Bar Track */}
          <div className="flex-1 h-2 rounded-full bg-slate-950/80 border border-white/10 p-[1px] overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-300 ${hpGradient}`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>

          {/* Exact HP Number */}
          <div className={`text-[10px] font-black font-mono tracking-tight shrink-0 ${hpTextColor}`}>
            {player.hp}<span className="text-[9px] text-slate-500 font-semibold">/{playerMaxHp}</span>
          </div>
        </div>
      )}
    </div>
  );
};
