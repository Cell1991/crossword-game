'use client';

import React from 'react';
import { Crown, Medal, Award, Shield, WifiOff, Sparkles, Crosshair } from 'lucide-react';
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
  isTargeted?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  rankIndex,
  isCurrent,
  isMe,
  showHealth,
  maxHp,
  cardEffect,
  isTargeted = false,
}) => {
  const isDead = player.hp <= 0;
  const hasLeft = player.connection_status === 'OFFLINE';
  const hasShield = Boolean(player.has_shield && !isDead);
  const playerMaxHp = player.max_hp || maxHp;
  const displayName = player.display_name.trim() || 'Player';

  const isActiveTurn = isCurrent && !isDead && !hasLeft;
  const isLeader = rankIndex === 0 && !isDead;
  const isSecond = rankIndex === 1 && !isDead;
  const isThird = rankIndex === 2 && !isDead;
  const healthPercent = Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100));

  // Vibrant, high-contrast health bar colors
  const hpGradient = hasShield
    ? 'from-sky-400 via-cyan-300 to-blue-400 shadow-[0_0_12px_rgba(56,189,248,0.7)]'
    : player.hp <= playerMaxHp * 0.25
    ? 'from-rose-500 via-red-500 to-rose-600 shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse'
    : player.hp <= playerMaxHp * 0.5
    ? 'from-amber-400 via-orange-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
    : 'from-emerald-400 via-teal-300 to-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]';

  const hpTextColor = hasShield
    ? 'text-sky-300'
    : player.hp <= playerMaxHp * 0.25
    ? 'text-rose-400 font-black'
    : player.hp <= playerMaxHp * 0.5
    ? 'text-amber-400'
    : 'text-emerald-400';

  return (
    <div
      className={`relative flex flex-col p-3 rounded-2xl transition-all duration-200 select-none overflow-hidden ${
        isDead || hasLeft
          ? 'bg-slate-950/40 border border-white/[0.04] opacity-40 grayscale-[50%]'
          : isActiveTurn
          ? 'bg-gradient-to-r from-[#0d2a3d]/95 via-[#081e2d]/95 to-[#05131d]/95 border-2 border-cyan-400 shadow-[0_0_26px_rgba(6,182,212,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-cyan-400/50'
          : isLeader
          ? 'bg-gradient-to-r from-[#1c2214]/90 via-[#131d2a]/90 to-[#0a121e]/95 border border-amber-400/50 shadow-[0_4px_18px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)] hover:border-amber-300'
          : isMe
          ? 'bg-gradient-to-r from-[#17253b]/90 via-[#0e1929]/90 to-[#09111e]/95 border border-amber-400/35 hover:border-amber-400/60 shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)]'
          : 'bg-gradient-to-r from-[#111e30]/85 via-[#0c1524]/90 to-[#080e1a]/95 hover:from-[#16263b]/90 hover:to-[#0d1828] border border-white/10 hover:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]'
      }`}
    >
      {/* Top Gloss Specular Layer */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

      {/* Active turn cyan glow accent */}
      {isActiveTurn && (
        <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-400/12 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Top Row: Rank + Identity + Score */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        {/* Left: Rank Badge + Name / Status Info */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* Rank Badge */}
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 font-mono shadow-md transition-transform mt-0.5 ${
              isLeader
                ? 'bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 text-amber-950 font-black border border-yellow-200/90 shadow-[0_0_14px_rgba(245,158,11,0.65),inset_0_1px_1px_rgba(255,255,255,0.9)] scale-105'
                : isSecond
                ? 'bg-gradient-to-br from-white via-slate-200 to-slate-400 text-slate-950 font-black border border-white/90 shadow-[0_0_12px_rgba(226,232,240,0.5),inset_0_1px_1px_rgba(255,255,255,0.9)]'
                : isThird
                ? 'bg-gradient-to-br from-amber-300 via-amber-600 to-orange-700 text-amber-950 font-black border border-amber-300/80 shadow-[0_0_12px_rgba(217,119,6,0.45),inset_0_1px_1px_rgba(254,215,170,0.7)]'
                : isDead || hasLeft
                ? 'bg-slate-900/60 text-slate-500 font-bold border border-white/5'
                : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-slate-100 font-extrabold border border-slate-500/50 shadow-[0_2px_6px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]'
            }`}
            title={`Rank #${rankIndex + 1}`}
          >
            {isLeader ? (
              <Crown className="w-4 h-4 text-amber-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]" />
            ) : isSecond ? (
              <Medal className="w-3.5 h-3.5 text-slate-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]" />
            ) : isThird ? (
              <Award className="w-3.5 h-3.5 text-amber-950 drop-shadow-[0_1px_1px_rgba(254,215,170,0.5)]" />
            ) : (
              <span>{rankIndex + 1}</span>
            )}
          </div>

          {/* Player Identity Column */}
          <div className="flex flex-col min-w-0 flex-1">
            {/* Player Name Line */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-xs sm:text-sm font-black truncate leading-tight ${
                  isMe
                    ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                    : isActiveTurn
                    ? 'text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                    : 'text-slate-100'
                }`}
                title={displayName}
              >
                {displayName}
              </span>

              {/* You Pill */}
              {isMe && (
                <span className="px-1 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 shrink-0">
                  YOU
                </span>
              )}

              {/* Offline / Eliminated Notice */}
              {(isDead || hasLeft) && (
                <span className="text-[10px] font-bold shrink-0">
                  {isDead ? (
                    <span className="text-rose-400 font-black">Eliminated</span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-0.5">
                      <WifiOff className="w-2.5 h-2.5" /> Off
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Status Badges Sub-row */}
            {(hasShield || (isTargeted && !isDead && !hasLeft) || cardEffect) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {/* Shield Active Badge */}
                {hasShield && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-400/20 border border-sky-400/60 text-[9.5px] font-black text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.4)] shrink-0">
                    <Shield className="w-3 h-3 text-sky-300 fill-sky-400/30" />
                    <span>Shield Active</span>
                  </span>
                )}

                {/* Double Damage Targeted Badge */}
                {isTargeted && !isDead && !hasLeft && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/70 text-[9.5px] font-black text-rose-200 shadow-[0_0_8px_rgba(244,63,94,0.4)] shrink-0 animate-pulse"
                    title="Targeted for 2× Double Damage"
                  >
                    <Crosshair className="w-3 h-3 text-rose-300 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>Targeted ×2</span>
                  </span>
                )}

                {/* Card effect in play */}
                {cardEffect && (
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/50 text-[9.5px] font-black text-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.3)] shrink-0"
                    title={`${cardEffect} active`}
                  >
                    <Sparkles className="w-3 h-3 text-purple-300" />
                    <span>{cardIcon(cardEffect, 'h-3 w-3') ?? cardEffect}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Big Score */}
        <div className="flex items-baseline gap-1 shrink-0 pl-2">
          <span
            className={`text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums ${
              isLeader
                ? 'bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(245,158,11,0.7)]'
                : isActiveTurn
                ? 'text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,197,0.6)]'
                : isSecond
                ? 'bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(226,232,240,0.4)]'
                : isThird
                ? 'bg-gradient-to-b from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(217,119,6,0.4)]'
                : 'text-slate-200'
            }`}
          >
            {player.score}
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase font-mono">
            PTS
          </span>
        </div>
      </div>

      {/* Bottom Row: Linear Health Meter */}
      {showHealth && !isDead && (
        <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center gap-2.5 relative z-10">
          {/* Health Bar Track */}
          <div className="flex-1 h-2 rounded-full bg-slate-950/90 border border-white/10 p-[1px] overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-300 ${hpGradient}`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>

          {/* Exact HP Number */}
          <div className={`text-[10.5px] font-black font-mono tracking-tight shrink-0 ${hpTextColor}`}>
            {player.hp}
            <span className="text-[9.5px] text-slate-500 font-bold">/{playerMaxHp}</span>
          </div>
        </div>
      )}
    </div>
  );
};
