'use client';

import React, { useState } from 'react';
import {
  Trophy,
  Crown,
  Medal,
  RotateCcw,
  Home,
  Sparkles,
  Heart,
  Swords,
  Copy,
  Check,
  Shield,
  Star,
  Award,
} from 'lucide-react';
import { GameState, Player } from '@/lib/types';
import ParticleField from '@/components/effects/ParticleField';
import FullscreenButton from '@/components/ui/FullscreenButton';

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
  const winner = gameState.players.find(p => p.id === gameState.winner_id) || sorted[0];
  const isMeWinner = Boolean(winner && myPlayerId && winner.id === myPlayerId);
  const rematchPin = gameState.rematch_pin;
  const isHpMode = gameState.max_turns === null;

  const firstPlace = sorted[0];
  const secondPlace = sorted.length > 1 ? sorted[1] : null;
  const thirdPlace = sorted.length > 2 ? sorted[2] : null;
  const remainingPlayers = sorted.length > 3 ? sorted.slice(3) : [];

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
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between overflow-x-hidden bg-[radial-gradient(circle_at_50%_10%,rgba(99,102,241,0.28),transparent_50%),radial-gradient(circle_at_20%_80%,rgba(6,182,212,0.22),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(217,70,239,0.18),transparent_40%),linear-gradient(135deg,#020617_0%,#090d21_45%,#0f172a_100%)] px-3 py-6 sm:px-6 sm:py-10 select-none">
      
      {/* Volumetric Celestial Light Rays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.2)_0%,rgba(147,51,234,0.15)_35%,transparent_70%)]" />

      {/* Floating Golden Magical Runes & Constellation Background Elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-35">
        <div className="absolute top-1/4 left-[8%] text-amber-300 font-mono text-xl animate-pulse">ᚠ</div>
        <div className="absolute top-1/3 right-[12%] text-cyan-300 font-mono text-2xl animate-pulse" style={{ animationDelay: '1s' }}>ᛗ</div>
        <div className="absolute bottom-1/3 left-[15%] text-purple-300 font-mono text-lg animate-pulse" style={{ animationDelay: '2s' }}>ᚨ</div>
        <div className="absolute top-2/3 right-[8%] text-amber-200 font-mono text-xl animate-pulse" style={{ animationDelay: '1.5s' }}>ᚦ</div>
      </div>

      {/* Dynamic Cosmic Star Particle Field */}
      <ParticleField className="pointer-events-none fixed inset-0 h-full w-full" />
      <FullscreenButton className="fixed top-3.5 right-3.5 sm:top-5 sm:right-5 z-40" />

      {/* MAIN CONTENT WRAPPER */}
      <div className="relative z-10 my-auto flex w-full max-w-4xl flex-col items-center gap-6 sm:gap-8">
        
        {/* TOP SECTION: MYSTICAL BANNER & 3D METALLIC GAME OVER TITLE */}
        <div className="flex flex-col items-center text-center gap-2 animate-in fade-in slide-in-from-top-4 duration-700">
          
          {/* Glowing Digital Cyan Banner with Runes */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/80 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
            <span className="text-[11px] sm:text-xs font-black tracking-[0.25em] text-cyan-300 uppercase">
              ◆ MATCH COMPLETED ◆
            </span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
          </div>

          {/* Large Metallic 3D Beveled Title */}
          <div className="relative mt-1">
            {/* Atmospheric Glow Behind Title */}
            <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-600/20 blur-2xl pointer-events-none" />
            
            <h1 className="relative text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-none uppercase">
              {isMeWinner ? (
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-300 to-amber-600 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] filter drop-shadow-[0_0_25px_rgba(251,191,36,0.65)]">
                  VICTORY!
                </span>
              ) : (
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-slate-100 via-amber-200 to-amber-500 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] filter drop-shadow-[0_0_25px_rgba(251,191,36,0.45)]">
                  GAME OVER
                </span>
              )}
            </h1>
          </div>

          {/* Crown & Winner Proclamation */}
          {winner && (
            <div className="flex items-center justify-center gap-2 mt-1 px-4 py-1 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.2)]">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-bounce" />
              <p className="text-xs sm:text-base font-extrabold tracking-wide text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">
                {winner.display_name} {isMeWinner ? '(You)' : ''} reigns victorious!
              </p>
            </div>
          )}
        </div>

        {/* CENTRAL FOCUS: GRAND MULTI-TIERED VICTORY PODIUM */}
        <div className="w-full flex flex-col items-center gap-4">
          
          {/* 3-Tier Podium (Desktop & Tablet) / Stacked Cards (Mobile) */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end justify-center">
            
            {/* 🥈 2ND PLACE (Left Silver Pedestal) */}
            {secondPlace && (
              <div className="order-2 md:order-1 flex flex-col items-center w-full">
                <div className="w-full relative rounded-3xl bg-gradient-to-b from-slate-800/90 via-slate-900/95 to-slate-950 border-2 border-slate-300/70 p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_28px_rgba(226,232,240,0.25)] backdrop-blur-xl ring-1 ring-slate-300/40 flex flex-col items-center text-center gap-3 transition-all hover:scale-[1.02] md:min-h-[290px] justify-between">
                  
                  {/* Sunburst Silver Aura */}
                  <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-slate-400/15 via-slate-200/20 to-slate-400/15 blur-lg pointer-events-none animate-pulse" />

                  {/* Grand 3D Silver Medallion Shield */}
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-gradient-to-br from-white via-slate-300 to-slate-500 border-2 border-white shadow-[0_0_28px_rgba(226,232,240,0.85),inset_0_1px_2px_rgba(255,255,255,0.9)] flex items-center justify-center">
                      <Medal className="w-9 h-9 sm:w-10 sm:h-10 text-slate-950 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]" />
                    </div>
                  </div>

                  {/* 2nd Place Silver Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_14px_rgba(226,232,240,0.6)]">
                    <Medal className="w-3.5 h-3.5" />
                    <span>Runner-Up • 2nd</span>
                  </div>

                  {/* Player Name */}
                  <div className="flex items-center gap-1.5 max-w-full truncate mt-0.5">
                    <span className={`text-base sm:text-xl font-bold truncate ${secondPlace.id === myPlayerId ? 'text-pink-300 font-black drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'text-slate-100'}`}>
                      {secondPlace.display_name} {secondPlace.id === myPlayerId && '(You)'}
                    </span>
                    {secondPlace.is_host && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>

                  {/* Silver Score Orb */}
                  <div className="w-full px-4 py-2 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-400/60 text-slate-100 font-mono font-black text-base sm:text-lg shadow-[0_0_15px_rgba(203,213,225,0.25)]">
                    {secondPlace.score} <span className="text-xs font-semibold text-slate-400">PTS</span>
                  </div>
                </div>
              </div>
            )}

            {/* 🥇 1ST PLACE (Center Tallest Golden Champion Tier) */}
            {firstPlace && (
              <div className="order-1 md:order-2 flex flex-col items-center w-full">
                <div className="w-full relative rounded-3xl bg-gradient-to-b from-amber-950/80 via-slate-900/95 to-slate-950 border-2 border-amber-400 p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_40px_rgba(251,191,36,0.4)] backdrop-blur-2xl ring-2 ring-amber-400/50 flex flex-col items-center text-center gap-3.5 transition-all hover:scale-[1.02] md:min-h-[330px] justify-between">
                  
                  {/* Sunburst Trophy Aura */}
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-amber-500/25 via-yellow-400/30 to-amber-600/25 blur-xl pointer-events-none animate-pulse" />

                  {/* Grand 3D Gold Champion Trophy */}
                  <div className="relative">
                    <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-3xl bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700 border-2 border-yellow-100 shadow-[0_0_35px_rgba(251,191,36,0.9),inset_0_1px_3px_rgba(255,255,255,0.8)] flex items-center justify-center">
                      <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-slate-950 drop-shadow-[0_1px_3px_rgba(255,255,255,0.7)]" />
                    </div>
                  </div>

                  {/* 1st Place Gold Pill */}
                  <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-widest shadow-[0_0_18px_rgba(251,191,36,0.7)]">
                    <Crown className="w-4 h-4" />
                    <span>Champion • 1st</span>
                  </div>

                  {/* Champion Name */}
                  <div className="flex items-center gap-1.5 max-w-full truncate mt-0.5">
                    <span className={`text-xl sm:text-2xl font-black truncate drop-shadow-[0_0_14px_rgba(251,191,36,0.6)] ${firstPlace.id === myPlayerId ? 'text-pink-300' : 'text-amber-200'}`}>
                      {firstPlace.display_name} {firstPlace.id === myPlayerId && '(You)'}
                    </span>
                    {firstPlace.is_host && (
                      <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </div>

                  {/* Gold Score Orb */}
                  <div className="w-full px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-400/80 text-amber-300 font-mono font-black text-lg sm:text-xl shadow-[0_0_22px_rgba(251,191,36,0.4)]">
                    {firstPlace.score} <span className="text-xs font-bold text-amber-400/80">PTS</span>
                  </div>
                </div>
              </div>
            )}

            {/* 🥉 3RD PLACE (Right Bronze Pedestal) */}
            {thirdPlace ? (
              <div className="order-3 md:order-3 flex flex-col items-center w-full">
                <div className="w-full relative rounded-3xl bg-gradient-to-b from-amber-950/60 via-slate-900/95 to-slate-950 border-2 border-amber-600/70 p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_28px_rgba(217,119,6,0.25)] backdrop-blur-xl ring-1 ring-amber-600/40 flex flex-col items-center text-center gap-3 transition-all hover:scale-[1.02] md:min-h-[290px] justify-between">
                  
                  {/* Sunburst Bronze Aura */}
                  <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-amber-600/20 via-orange-500/25 to-amber-700/20 blur-lg pointer-events-none animate-pulse" />

                  {/* Grand 3D Bronze Medallion Shield */}
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-900 border-2 border-amber-300 shadow-[0_0_28px_rgba(217,119,6,0.85),inset_0_1px_2px_rgba(255,255,255,0.6)] flex items-center justify-center">
                      <Award className="w-9 h-9 sm:w-10 sm:h-10 text-amber-950 drop-shadow-[0_1px_2px_rgba(251,191,36,0.6)]" />
                    </div>
                  </div>

                  {/* 3rd Place Bronze Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-amber-950 font-black text-xs uppercase tracking-widest shadow-[0_0_14px_rgba(217,119,6,0.6)]">
                    <Award className="w-3.5 h-3.5" />
                    <span>Bronze • 3rd</span>
                  </div>

                  {/* Player Name */}
                  <div className="flex items-center gap-1.5 max-w-full truncate mt-0.5">
                    <span className={`text-base sm:text-xl font-bold truncate ${thirdPlace.id === myPlayerId ? 'text-pink-300 font-black drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'text-amber-100'}`}>
                      {thirdPlace.display_name} {thirdPlace.id === myPlayerId && '(You)'}
                    </span>
                    {thirdPlace.is_host && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>

                  {/* Bronze Score Orb */}
                  <div className="w-full px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-950 via-slate-850 to-amber-950 border border-amber-600/70 text-amber-200 font-mono font-black text-base sm:text-lg shadow-[0_0_15px_rgba(217,119,6,0.25)]">
                    {thirdPlace.score} <span className="text-xs font-semibold text-amber-400/80">PTS</span>
                  </div>
                </div>
              </div>
            ) : sorted.length > 1 ? (
              // Symmetrical placeholder for 2-player matches
              <div className="order-3 hidden md:block" />
            ) : null}

          </div>

          {/* RUNNERS-UP (4th, 5th, 6th place if present) */}
          {remainingPlayers.length > 0 && (
            <div className="w-full max-w-2xl rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 p-3.5 space-y-2 shadow-lg">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-2 flex items-center gap-1.5">
                <Swords className="w-3 h-3 text-cyan-400" />
                <span>Other Challengers</span>
              </span>
              {remainingPlayers.map((player, idx) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-xl border bg-slate-950/70 text-xs transition-colors ${
                    player.id === myPlayerId ? 'border-pink-500/50 text-pink-200 ring-1 ring-pink-500/30' : 'border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-slate-400 font-black text-xs">#{idx + 4}</span>
                    <span className="font-semibold truncate text-sm">
                      {player.display_name} {player.id === myPlayerId && '(You)'}
                    </span>
                  </div>
                  <span className="font-mono font-black text-emerald-400 text-sm">{player.score} pts</span>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* REMATCH LOBBY NOTIFICATION BANNER */}
        {rematchPin && (
          <div className="flex w-full max-w-lg items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-slate-950 border border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.25)] text-xs text-emerald-200 animate-pulse">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
              <span className="truncate font-medium">
                New rematch arena ready! PIN: <strong className="font-mono text-emerald-300 text-base tracking-widest font-black">{rematchPin}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={copyRematchPin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-400/50 text-xs font-bold text-emerald-100 transition-colors cursor-pointer shrink-0"
              title="Copy PIN"
            >
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-center text-xs sm:text-sm font-semibold text-rose-400 bg-rose-950/80 border border-rose-500/50 px-4 py-2 rounded-xl">
            {error}
          </p>
        )}

        {/* BOTTOM METALLIC ACTION BUTTONS */}
        <div className="flex w-full max-w-lg flex-col gap-3.5 sm:flex-row">
          {onPlayAgain && (
            <button
              type="button"
              onClick={handlePlayAgain}
              disabled={joining}
              className="group relative flex flex-1 items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-base shadow-[0_0_35px_rgba(6,182,212,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] border-2 border-cyan-300 ring-2 ring-cyan-400/40 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer overflow-hidden"
            >
              {/* Light Shimmering Gleam */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              
              <RotateCcw className={`w-5 h-5 ${joining ? 'animate-spin' : ''}`} strokeWidth={2.5} />
              <span>
                {joining
                  ? (rematchPin ? 'Joining Arena...' : 'Forging Arena...')
                  : 'Play Again'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onHome}
            disabled={joining}
            className={`flex flex-1 items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-base border-2 transition-all disabled:opacity-50 active:scale-95 cursor-pointer ${
              onPlayAgain
                ? 'border-slate-600/80 bg-slate-900/90 hover:bg-slate-800 hover:border-slate-400 text-slate-200 hover:text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.5)]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>

      </div>
    </div>
  );
};
