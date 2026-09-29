'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Trophy,
  Crown,
  Medal,
  RotateCcw,
  Home,
  Sparkles,
  Heart,
  Flame,
  Swords,
  Copy,
  Check,
} from 'lucide-react';
import { GameState } from '@/lib/types';
import ParticleField from '@/components/effects/ParticleField';
import FullscreenButton from '@/components/ui/FullscreenButton';
import MouseGradientText from '@/components/effects/MouseGradientText';

interface GameOverScreenProps {
  gameState: GameState;
  myPlayerId: string | null;
  onHome: () => void;
  /** Leave out for spectators: they hold no seat to carry into another round. */
  onPlayAgain?: () => Promise<void>;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  gameState,
  myPlayerId,
  onHome,
  onPlayAgain,
}) => {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);

  // Sorted players by score
  const sorted = [...(gameState.players ?? [])].sort((a, b) => b.score - a.score);
  // Server determines the winner
  const winner = gameState.players.find(p => p.id === gameState.winner_id);
  const isMeWinner = Boolean(winner && myPlayerId && winner.id === myPlayerId);
  const rematchPin = gameState.rematch_pin;
  const isHpMode = gameState.max_turns === null;

  const handlePlayAgain = async () => {
    if (!onPlayAgain) return;
    setJoining(true);
    setError('');
    try {
      await onPlayAgain();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start a new game');
      setJoining(false);
    }
  };

  const copyRematchPin = () => {
    if (!rematchPin) return;
    navigator.clipboard?.writeText(rematchPin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-x-hidden bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.25),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.18),transparent_50%),linear-gradient(135deg,#020617_0%,#090d21_50%,#0f172a_100%)] px-4 py-8 sm:py-12 select-none">
      {/* Dynamic Cosmic Star Particle Field */}
      <ParticleField className="pointer-events-none fixed inset-0 h-full w-full" />
      <FullscreenButton className="fixed top-4 right-4 z-40" />

      {/* Main Container */}
      <div className="relative z-10 my-auto flex w-full max-w-xl flex-col items-center gap-6 sm:gap-7">
        
        {/* Game Logo & Status Badge */}
        <div className="flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-cyan-500/30 text-cyan-300 text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Match Completed</span>
          </div>

          <div className="relative flex items-center justify-center mt-2">
            {/* Sunburst Trophy Aura */}
            <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-600/25 blur-xl animate-pulse" />
            
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-b from-amber-400/20 via-slate-900/90 to-slate-950 border border-amber-400/60 shadow-[0_0_35px_rgba(251,191,36,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center">
              <Trophy className="w-11 h-11 sm:w-14 sm:h-14 text-amber-400 drop-shadow-[0_0_16px_rgba(251,191,36,0.8)]" />
            </div>
          </div>

          {/* Majestic Title */}
          <div className="text-center mt-2">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              {isMeWinner ? (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-[0_0_24px_rgba(251,191,36,0.6)]">
                  VICTORY!
                </span>
              ) : (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                  GAME OVER
                </span>
              )}
            </h1>

            {winner && (
              <div className="mt-1 flex items-center justify-center gap-2">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                <p className="text-sm sm:text-lg font-bold text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">
                  {winner.display_name} {isMeWinner ? '(You)' : ''} is the Champion!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Podium Leaderboard Card */}
        <div className="w-full rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/70 p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.1)] ring-1 ring-cyan-500/20 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500">
          
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_6px_#38bdf8]" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-300">
                Final Standings
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {sorted.length} {sorted.length === 1 ? 'Player' : 'Players'}
            </span>
          </div>

          {/* Roster Rows with Rank Styling */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {sorted.map((player, idx) => {
              const isWinnerPlayer = player.id === winner?.id;
              const isMe = player.id === myPlayerId;
              const rank = idx + 1;

              // Rank-specific themed containers
              let rankStyle = 'bg-slate-950/60 border-slate-800/70 text-slate-300';
              let badgeColor = 'bg-slate-800 text-slate-400 border-slate-700';
              let rankName = `#${rank}`;

              if (rank === 1) {
                rankStyle = 'bg-gradient-to-r from-amber-950/50 via-yellow-950/30 to-slate-900/90 border-amber-400/60 shadow-[0_0_18px_rgba(251,191,36,0.22)] ring-1 ring-amber-400/30';
                badgeColor = 'bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 font-black border-amber-300';
                rankName = '🥇 1st';
              } else if (rank === 2) {
                rankStyle = 'bg-gradient-to-r from-slate-800/50 via-slate-850/40 to-slate-900/90 border-slate-400/50 shadow-[0_0_14px_rgba(203,213,225,0.12)]';
                badgeColor = 'bg-gradient-to-br from-slate-300 to-slate-500 text-slate-950 font-black border-slate-200';
                rankName = '🥈 2nd';
              } else if (rank === 3) {
                rankStyle = 'bg-gradient-to-r from-amber-950/30 via-orange-950/20 to-slate-900/90 border-amber-700/50 shadow-[0_0_12px_rgba(217,119,6,0.1)]';
                badgeColor = 'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 font-black border-amber-500';
                rankName = '🥉 3rd';
              }

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${rankStyle} ${
                    isMe ? 'ring-2 ring-pink-500/50 shadow-[0_0_16px_rgba(236,72,153,0.2)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Rank Pill */}
                    <span className={`px-2 py-0.5 rounded-lg text-xs border shadow-sm ${badgeColor}`}>
                      {rankName}
                    </span>

                    {/* Player Name */}
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`text-sm truncate ${
                        isMe ? 'font-extrabold text-pink-200' : isWinnerPlayer ? 'font-bold text-amber-200' : 'font-medium text-slate-200'
                      }`}>
                        {player.display_name} {isMe && '(You)'}
                      </span>
                      {player.is_host && (
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                      )}
                      {isWinnerPlayer && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-black text-amber-300 uppercase tracking-wider">
                          Winner
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score & HP Stats */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isHpMode && (
                      <div className="hidden xs:flex items-center gap-1 text-xs text-rose-300 font-mono">
                        <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-500/30" />
                        <span>{player.hp > 0 ? `${player.hp} HP` : '0 HP'}</span>
                      </div>
                    )}
                    <span className="font-mono font-black text-emerald-400 text-sm sm:text-base drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">
                      {player.score} <span className="text-xs font-medium text-slate-400">pts</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rematch Lobby Banner (If active) */}
        {rematchPin && (
          <div className="flex w-full items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.2)] text-xs text-emerald-200 animate-pulse">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="truncate">
                Rematch lobby open! PIN: <strong className="font-mono text-emerald-300 text-sm tracking-widest">{rematchPin}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={copyRematchPin}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-400/40 text-[11px] font-bold text-emerald-200 transition-colors cursor-pointer shrink-0"
              title="Copy PIN"
            >
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-center text-xs sm:text-sm font-semibold text-rose-400 bg-rose-950/60 border border-rose-500/40 px-4 py-2 rounded-xl">
            {error}
          </p>
        )}

        {/* Action Controls */}
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          {onPlayAgain && (
            <button
              type="button"
              onClick={handlePlayAgain}
              disabled={joining}
              className="group relative flex flex-1 items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-sm sm:text-base shadow-[0_0_28px_rgba(6,182,212,0.45)] border border-cyan-300/40 ring-2 ring-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer overflow-hidden"
            >
              {/* Button light shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              
              <RotateCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${joining ? 'animate-spin' : ''}`} strokeWidth={2.5} />
              <span>
                {joining
                  ? (rematchPin ? 'Joining Rematch...' : 'Creating Rematch...')
                  : 'Play Again'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onHome}
            disabled={joining}
            className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm sm:text-base border transition-all disabled:opacity-50 active:scale-95 cursor-pointer ${
              onPlayAgain
                ? 'border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white hover:border-slate-500 shadow-md'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_25px_rgba(6,182,212,0.4)]'
            }`}
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Back to Home</span>
          </button>
        </div>

      </div>
    </div>
  );
};
