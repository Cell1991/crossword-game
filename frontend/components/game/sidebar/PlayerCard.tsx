'use client';

import React from 'react';
import { Crown, Shield, WifiOff } from 'lucide-react';
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

  // Circular health ring geometry (38px box, radius 16)
  const radius = 16;
  const circumference = 2 * Math.PI * radius; // ~100.53
  const strokeDashoffset = circumference - (healthPercent / 100) * circumference;

  return (
    <div
      className={`relative flex items-center justify-between p-3 rounded-2xl transition-all duration-200 select-none ${
        isDead || hasLeft
          ? 'bg-[rgba(11,18,32,0.6)] border border-[rgba(120,160,200,0.08)] opacity-45'
          : isActiveTurn
          ? 'bg-[rgba(20,38,60,0.85)] border border-[#22D3C5]/50 shadow-[0_0_20px_rgba(34,211,197,0.12),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[#22D3C5]/25'
          : 'bg-[rgba(16,28,46,0.65)] hover:bg-[rgba(20,35,55,0.75)] border border-[rgba(120,160,200,0.14)] shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
      }`}
    >
      {/* Left: Avatar with Integrated Radial Health Ring + Identity */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Radial Health Ring Avatar */}
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
          {showHealth && (
            <svg
              className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
              viewBox="0 0 38 38"
            >
              {/* Background Track Ring */}
              <circle
                cx="19"
                cy="19"
                r={radius}
                className="stroke-[rgba(120,160,200,0.15)]"
                strokeWidth="2.5"
                fill="none"
              />
              {/* Foreground Health Meter Ring */}
              <circle
                cx="19"
                cy="19"
                r={radius}
                stroke={
                  hasShield
                    ? '#38BDF8'
                    : player.hp <= playerMaxHp / 2
                    ? '#F6C453'
                    : '#22D3C5'
                }
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-300"
              />
            </svg>
          )}

          {/* Avatar Core */}
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-colors ${
              isActiveTurn
                ? 'bg-[#163844] text-[#22D3C5] shadow-[0_0_8px_rgba(34,211,197,0.3)]'
                : 'bg-[#18263a] text-[#F2F6FC]'
            }`}
            aria-hidden="true"
          >
            {initial}
          </div>
        </div>

        {/* Player Name & Quick Status */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-sm sm:text-base font-bold text-[#F2F6FC] truncate"
              title={displayName}
            >
              {displayName}
            </span>

            {/* Host Crown */}
            {player.is_host && (
              <Crown className="w-3.5 h-3.5 text-[#F6C453] shrink-0 drop-shadow-[0_0_4px_rgba(246,196,83,0.5)]" />
            )}

            {/* YOU Badge */}
            {isMe && (
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#F6C453]/15 text-[#F6C453] border border-[#F6C453]/30 uppercase tracking-wider shrink-0">
                YOU
              </span>
            )}

            {/* Shield Active Icon */}
            {hasShield && (
              <Shield className="w-3.5 h-3.5 text-[#38BDF8] shrink-0 drop-shadow-[0_0_4px_#38bdf8]" />
            )}

            {/* Card effect in play */}
            {cardEffect && (
              <span className="text-xs text-[#22D3C5] shrink-0" title={`${cardEffect} in play`}>
                {cardIcon(cardEffect, 'h-3.5 w-3.5', <span>×2</span>) ?? '✨'}
              </span>
            )}
          </div>

          {/* Clear, Minimal Sub-status */}
          <div className="text-[11px] font-medium leading-tight">
            {isDead ? (
              <span className="text-[#66758A]">Eliminated</span>
            ) : hasLeft ? (
              <span className="text-[#66758A] flex items-center gap-1">
                Left game
                <WifiOff className="w-2.5 h-2.5 text-[#66758A]" />
              </span>
            ) : isActiveTurn ? (
              <span className="text-[#22D3C5] flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22D3C5] shadow-[0_0_6px_#22d3c5]" />
                Playing now
              </span>
            ) : (
              <span className="text-[#91A0B5]">Waiting for turn</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Big, Bold, Crystal-Clear Score */}
      <div className="flex items-baseline font-mono shrink-0 pl-2">
        <span className="text-lg sm:text-2xl font-black text-[#F2F6FC] tabular-nums tracking-tight">
          {player.score}
        </span>
        <span className="text-[10px] sm:text-xs font-bold text-[#91A0B5] ml-1 uppercase">
          PTS
        </span>
      </div>
    </div>
  );
};
