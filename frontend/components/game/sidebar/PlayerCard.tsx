'use client';

import React from 'react';
import { Crown, Shield, Wifi, WifiOff } from 'lucide-react';
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
  const initial = displayName.charAt(0).toUpperCase();

  const isActiveTurn = isCurrent && !isDead && !hasLeft;
  const healthPercent = Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100));

  return (
    <div
      className={`relative flex flex-col p-2.5 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-200 ${
        isDead || hasLeft
          ? 'bg-[rgba(11,18,32,0.6)] border border-[rgba(120,160,200,0.08)] opacity-45'
          : isActiveTurn
          ? 'bg-[rgba(20,38,60,0.85)] border border-[#22D3C5]/50 shadow-[0_0_20px_rgba(34,211,197,0.12),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[#22D3C5]/25'
          : 'bg-[rgba(16,28,46,0.65)] hover:bg-[rgba(20,35,55,0.75)] border border-[rgba(120,160,200,0.14)] shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
      }`}
    >
      {/* Topline: Rank, Avatar, Identity & Score */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Rank Number (01, 02) */}
          <span className="font-mono text-[11px] sm:text-xs font-bold text-[#66758A] w-4 shrink-0 tabular-nums">
            {String(rankIndex + 1).padStart(2, '0')}
          </span>

          {/* Avatar Crest / Initial Box */}
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
              isActiveTurn
                ? 'bg-[#163844] border border-[#22D3C5]/60 text-[#22D3C5] shadow-[0_0_10px_rgba(34,211,197,0.25)]'
                : 'bg-[#18263a] border border-[#2d4360] text-[#F2F6FC]'
            }`}
            aria-hidden="true"
          >
            {initial}
          </div>

          {/* Name & Subline info */}
          <div className="flex flex-col min-w-0">
            {/* Player Name Line */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-xs sm:text-sm font-bold text-[#F2F6FC] truncate"
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

            {/* Subline: Status text + Wifi indicator */}
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium leading-tight">
              {isDead ? (
                <span className="text-[#66758A]">Eliminated</span>
              ) : hasLeft ? (
                <span className="text-[#66758A] flex items-center gap-1">
                  Left game
                  <WifiOff className="w-2.5 h-2.5 text-[#66758A]" />
                </span>
              ) : isActiveTurn ? (
                <span className="text-[#22D3C5] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22D3C5] shadow-[0_0_6px_#22d3c5]" />
                  Playing now
                  <Wifi className="w-2.5 h-2.5 text-[#22D3C5]" />
                </span>
              ) : (
                <span className="text-[#91A0B5] flex items-center gap-1">
                  Waiting for turn
                  <Wifi className="w-2.5 h-2.5 text-[#66758A]" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Score (Large PTS) */}
        <div className="flex items-baseline font-mono shrink-0 pl-1">
          <span className="text-sm sm:text-base font-extrabold text-[#F2F6FC] tabular-nums">
            {player.score}
          </span>
          <span className="text-[10px] font-bold text-[#91A0B5] ml-1 uppercase">
            PTS
          </span>
        </div>
      </div>

      {/* Health Bar (if applicable) */}
      {showHealth && (
        <div className="mt-2 pt-1.5 border-t border-[rgba(120,160,200,0.08)]">
          <div className="flex justify-between items-center text-[10px] font-medium mb-1">
            <span className="text-[#91A0B5]">Health</span>
            <span className="font-mono font-semibold text-[#91A0B5] tabular-nums">
              {Math.max(0, player.hp)} / {playerMaxHp}
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-[#0a121e] overflow-hidden"
            role="progressbar"
            aria-label={`${displayName} health`}
            aria-valuemin={0}
            aria-valuemax={playerMaxHp}
            aria-valuenow={Math.max(0, Math.min(playerMaxHp, player.hp))}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                hasShield
                  ? 'bg-gradient-to-r from-[#38BDF8] to-[#0284C7]'
                  : player.hp <= playerMaxHp / 2
                  ? 'bg-gradient-to-r from-[#F6C453] to-[#EAB308]'
                  : 'bg-gradient-to-r from-[#15C6D4] to-[#22D3C5]'
              }`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
