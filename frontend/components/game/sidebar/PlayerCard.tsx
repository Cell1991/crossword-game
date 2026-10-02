'use client';

import React from 'react';
import { Shield, WifiOff } from 'lucide-react';
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
  const initial = displayName.charAt(0).toUpperCase();

  const isActiveTurn = isCurrent && !isDead && !hasLeft;
  const healthPercent = Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100));

  // Circular health gauge geometry (36px SVG viewBox 0 0 36 36, radius 14)
  const radius = 14;
  const circumference = 2 * Math.PI * radius; // ~87.96
  const strokeDashoffset = circumference - (healthPercent / 100) * circumference;

  // Vibrant tactical health colors:
  // High health (>50%) -> Vibrant Emerald Green (#10B981)
  // Low health (<=50%)  -> Tactical Amber (#F59E0B)
  // Critical (<=25%)    -> Crimson Red (#EF4444)
  // Shield active       -> Sky Blue (#38BDF8)
  const healthStrokeColor = hasShield
    ? '#38BDF8'
    : player.hp <= playerMaxHp * 0.25
    ? '#EF4444'
    : player.hp <= playerMaxHp * 0.5
    ? '#F59E0B'
    : '#10B981';

  return (
    <div
      className={`relative flex items-center justify-between p-2 rounded-xl transition-all duration-200 select-none ${
        isDead || hasLeft
          ? 'bg-slate-950/40 border border-white/[0.04] opacity-45'
          : isActiveTurn
          ? 'bg-slate-900/80 border border-cyan-400/60 shadow-[0_0_18px_rgba(34,211,197,0.18)] ring-1 ring-cyan-400/30'
          : 'bg-slate-900/40 hover:bg-slate-800/50 border border-white/[0.06] hover:border-white/[0.12] shadow-sm'
      }`}
    >
      {/* Left: Avatar with 8-Segment Tactical Health Ring + Identity */}
      <div className="flex items-center gap-2 min-w-0">
        {/* 8-Segment Radial Health Ring Avatar */}
        <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
          {showHealth && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 36 36"
            >
              {/* Background Track Ring (Dark Navy) */}
              <circle
                cx="18"
                cy="18"
                r={radius}
                className="stroke-[rgba(120,160,200,0.18)]"
                strokeWidth="3"
                fill="none"
              />

              {/* Foreground Health Meter Ring (Thick Green / Amber / Red) */}
              <circle
                cx="18"
                cy="18"
                r={radius}
                stroke={healthStrokeColor}
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                transform="rotate(-90 18 18)"
                className="transition-all duration-300"
                style={{
                  filter: `drop-shadow(0 0 4px ${
                    hasShield
                      ? 'rgba(56, 189, 248, 0.5)'
                      : player.hp <= playerMaxHp * 0.25
                      ? 'rgba(239, 68, 68, 0.5)'
                      : player.hp <= playerMaxHp * 0.5
                      ? 'rgba(245, 158, 11, 0.5)'
                      : 'rgba(16, 185, 129, 0.5)'
                  })`,
                }}
              />

              {/* 8 Symmetric Radial Notches / Dividers */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <line
                  key={angle}
                  x1="18"
                  y1="1.5"
                  x2="18"
                  y2="6.5"
                  stroke="#0E1726"
                  strokeWidth="1.6"
                  transform={`rotate(${angle} 18 18)`}
                />
              ))}
            </svg>
          )}

          {/* Avatar Core */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs transition-colors ${
              isActiveTurn
                ? 'bg-[#163844] text-[#22D3C5] shadow-[0_0_6px_rgba(34,211,197,0.3)]'
                : 'bg-[#18263a] text-[#F2F6FC]'
            }`}
            aria-hidden="true"
          >
            {initial}
          </div>
        </div>

        {/* Player Name & Quick Status */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <span
              className={`text-xs sm:text-sm font-bold truncate ${
                isMe ? 'text-[#F6C453]' : 'text-[#F2F6FC]'
              }`}
              title={displayName}
            >
              {displayName}
            </span>

            {/* Shield Active Icon */}
            {hasShield && (
              <Shield className="w-3 h-3 text-[#38BDF8] shrink-0 drop-shadow-[0_0_4px_#38bdf8]" />
            )}

            {/* Card effect in play */}
            {cardEffect && (
              <span className="text-[11px] text-[#22D3C5] shrink-0" title={`${cardEffect} in play`}>
                {cardIcon(cardEffect, 'h-3 w-3', <span>×2</span>) ?? '✨'}
              </span>
            )}
          </div>

          {/* Clear, Minimal Sub-status */}
          <div className="text-[10px] font-medium leading-tight">
            {isDead ? (
              <span className="text-[#66758A]">Eliminated</span>
            ) : hasLeft ? (
              <span className="text-[#66758A] flex items-center gap-1">
                Left
                <WifiOff className="w-2.5 h-2.5 text-[#66758A]" />
              </span>
            ) : isActiveTurn ? (
              <span className="text-[#22D3C5] flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22D3C5] shadow-[0_0_5px_#22d3c5]" />
                Playing
              </span>
            ) : (
              <span className="text-[#91A0B5]">Waiting</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Big, Bold, Crystal-Clear Score */}
      <div className="flex items-baseline font-mono shrink-0 pl-1.5">
        <span className="text-base sm:text-xl font-black text-[#F2F6FC] tabular-nums tracking-tight">
          {player.score}
        </span>
        <span className="text-[9px] font-bold text-[#91A0B5] ml-0.5 uppercase">
          PTS
        </span>
      </div>
    </div>
  );
};
