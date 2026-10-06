'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookMarked, BookOpen, Check, Copy, Eye, Maximize, Minimize, ScrollText } from 'lucide-react';
import { Player } from '@/lib/types';
import { TurnBanner } from './TurnBanner';

const SpectatorBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <div
      className="relative inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-gradient-to-b from-[#161942]/90 to-[#0d0f28]/95 px-2.5 sm:px-3 text-xs font-bold text-indigo-200 shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden"
      title={`${count} spectator${count > 1 ? 's' : ''} watching`}
      aria-label={`${count} spectator${count > 1 ? 's' : ''} watching`}
    >
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
      <Eye className="h-3.5 w-3.5 text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.7)] relative z-10" />
      <span className="font-mono font-black tabular-nums relative z-10">{count}</span>
    </div>
  );
};

interface GameHudProps {
  isSpectator: boolean;
  isEliminated?: boolean;
  isConnected: boolean;
  roomPin: string | null;
  myPlayerName?: string;
  spectatorCount: number;
  isMyTurn: boolean;
  isBotPlacing?: boolean;
  currentPlayer: Player | undefined;
  nextPlayer?: Player | undefined;
  turnNumber: number;
  maxTurns: number | null;
  totalPlayers?: number;
  onExit: () => void;
  onOpenInfo: () => void;
  onOpenGuide?: () => void;
  onOpenGrimoire?: () => void;
  isGrimoireEnabled?: boolean;
  timer: React.ReactNode;
  debugSlot?: React.ReactNode;
}

/**
 * WordX Celestial Cosmic Top Navigation HUD
 * High-end cosmic glassmorphism, responsive tactile buttons, starlight status indicators, and 100% English UI.
 */
export const GameHud: React.FC<GameHudProps> = ({
  isSpectator,
  isEliminated = false,
  isConnected,
  roomPin,
  myPlayerName: _myPlayerName,
  spectatorCount,
  isMyTurn,
  isBotPlacing = false,
  currentPlayer,
  nextPlayer,
  turnNumber,
  maxTurns,
  totalPlayers = 1,
  onExit,
  onOpenInfo,
  onOpenGuide,
  onOpenGrimoire,
  isGrimoireEnabled = false,
  timer,
  debugSlot,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  useEffect(() => {
    const updateFullscreen = () => {
      const safariDocument = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement || safariDocument.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', updateFullscreen);
    document.addEventListener('webkitfullscreenchange', updateFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      document.removeEventListener('webkitfullscreenchange', updateFullscreen);
    };
  }, []);

  const handleCopyPin = () => {
    if (!roomPin) return;
    void navigator.clipboard?.writeText(roomPin).catch(() => undefined);
    setCopiedPin(true);
    window.setTimeout(() => setCopiedPin(false), 2000);
  };

  const toggleFullscreen = async () => {
    try {
      const safariDocument = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void> | void;
      };
      const safariElement = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (!document.fullscreenElement && !safariDocument.webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        else if (safariElement.webkitRequestFullscreen) await safariElement.webkitRequestFullscreen();
      } else if (document.exitFullscreen) await document.exitFullscreen();
      else if (safariDocument.webkitExitFullscreen) await safariDocument.webkitExitFullscreen();
    } catch (error) {
      console.warn('Fullscreen toggle failed:', error);
    }
  };

  return (
    <div className="gameplay-top-hud-container relative z-30 w-full shrink-0 flex flex-col border-b border-indigo-500/20 bg-gradient-to-r from-[#060718] via-[#0e102e] to-[#060718] sm:from-[#060718]/96 sm:via-[#0e102e]/98 sm:to-[#060718]/96 shadow-[0_6px_30px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] sm:backdrop-blur-2xl">
      {/* Top radiant starlight specular filament */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/50 via-purple-400/35 to-transparent pointer-events-none" />

      {/* Atmospheric center nebula glow (desktop only for mobile 120 FPS performance) */}
      <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-14 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute top-1/2 left-1/4 -translate-y-1/2 w-48 h-12 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* ROW 1: System Bar */}
      <header className="gameplay-top-hud relative z-10 flex md:grid w-full items-center justify-between md:grid-cols-[1fr_auto_1fr] gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2">
        {/* Left HUD cluster */}
        <div className="gameplay-hud-cluster gameplay-hud-left flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          {/* Back / Exit Button */}
          <button
            type="button"
            onClick={onExit}
            className="group relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-400/25 bg-gradient-to-b from-[#181a42]/90 to-[#0d0f28]/95 text-slate-300 hover:text-white hover:border-amber-400/60 hover:from-[#25285c] hover:to-[#141738] hover:shadow-[0_0_18px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] active:scale-95 overflow-hidden"
            title={isSpectator ? 'Stop watching' : 'Exit game'}
            aria-label={isSpectator ? 'Stop watching' : 'Exit game'}
          >
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
            <ArrowLeft className="h-4 w-4 sm:h-4.5 sm:w-4.5 relative z-10 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          {/* Room PIN Celestial Capsule */}
          {roomPin && (
            <button
              type="button"
              onClick={handleCopyPin}
              className={`group relative flex h-8 sm:h-9 shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl border px-2.5 sm:px-3 text-xs sm:text-sm font-bold transition-all shadow-[0_4px_14px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] cursor-pointer active:scale-95 overflow-hidden ${
                copiedPin
                  ? 'border-emerald-400/80 bg-gradient-to-r from-emerald-950/95 via-[#0b2419]/98 to-emerald-950/95 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] ring-1 ring-emerald-400/60'
                  : 'border-amber-400/35 bg-gradient-to-r from-[#191738]/90 via-[#100f28]/95 to-[#0a091c]/90 text-amber-200 hover:border-amber-400/60 hover:from-[#231f4a] hover:to-[#131130] hover:text-white hover:shadow-[0_0_18px_rgba(245,158,11,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)]'
              }`}
              title="Room PIN (Click to copy)"
            >
              {/* Specular shimmer */}
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />

              {copiedPin ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300 stroke-[3] relative z-10 animate-scale" />
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider relative z-10 text-emerald-200">
                    Copied!
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center justify-center rounded-lg bg-amber-400/15 border border-amber-400/40 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-amber-300 uppercase tracking-widest relative z-10 shadow-[0_0_8px_rgba(245,158,11,0.25)]">
                    PIN
                  </span>
                  <strong className="text-xs sm:text-sm font-black font-maple tracking-wide text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] relative z-10">
                    #{roomPin}
                  </strong>
                  <Copy className="h-3 w-3 text-slate-400 group-hover:text-amber-300 relative z-10 transition-colors hidden sm:inline" />
                </>
              )}
            </button>
          )}

          {/* Live Signal Beacon Indicator */}
          <div
            className={`gameplay-live-indicator hidden md:flex h-8 sm:h-9 items-center gap-2 rounded-xl px-2.5 sm:px-3 text-xs font-black uppercase tracking-widest border relative overflow-hidden backdrop-blur-xl ${
              isConnected
                ? 'border-emerald-400/40 bg-gradient-to-r from-emerald-950/70 via-[#0a2318]/80 to-emerald-950/70 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.25),inset_0_1px_1px_rgba(255,255,255,0.15)]'
                : 'border-rose-400/40 bg-gradient-to-r from-rose-950/70 via-[#240a12]/80 to-rose-950/70 text-rose-300 shadow-[0_0_16px_rgba(239,68,68,0.25),inset_0_1px_1px_rgba(255,255,255,0.15)]'
            }`}
            title={isConnected ? 'Live match connected' : 'Reconnecting to match'}
          >
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            
            {/* Animated Radar Beacon */}
            <span className="relative flex h-2.5 w-2.5 items-center justify-center shrink-0">
              {isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 duration-1000" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300 shadow-[0_0_8px_#34d399]" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400 shadow-[0_0_8px_#f87171]" />
              )}
            </span>
            <span className="text-[10px] sm:text-[11px] font-black relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Center: WordX Brand & Turn state (visible on md+) */}
        <div className="gameplay-hud-center hidden md:flex min-w-0 items-center justify-center gap-3">
          <div className="gameplay-brand flex items-center select-none cursor-default py-0.5 group">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]">
              Word
            </span>
            <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-tr from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(245,158,11,1)] ml-0.5 group-hover:scale-105 transition-transform">
              X
            </span>
          </div>

          <div className="gameplay-turn-state hidden lg:flex min-w-0 items-center justify-center gap-2">
            <TurnBanner
              isMyTurn={isMyTurn}
              isBotPlacing={isBotPlacing}
              isEliminated={isEliminated}
              isSpectator={isSpectator}
              isConnected={isConnected}
              currentPlayer={currentPlayer}
              nextPlayer={nextPlayer}
              turnNumber={turnNumber}
              maxTurns={maxTurns}
              totalPlayers={totalPlayers}
            />
          </div>
        </div>

        {/* Right HUD cluster */}
        <div className="gameplay-hud-cluster gameplay-hud-right flex min-w-0 items-center justify-end gap-1.5 sm:gap-2.5">
          <div className="gameplay-header-timer hidden lg:block">{timer}</div>

          {/* Mobile-only Stats button */}
          <button
            type="button"
            onClick={onOpenInfo}
            className="group relative gameplay-info-button flex lg:hidden h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-xl border border-indigo-400/25 bg-gradient-to-b from-[#181a42]/90 to-[#0d0f28]/95 px-2.5 sm:px-3 text-xs font-bold text-slate-100 hover:text-white hover:border-amber-400/60 hover:from-[#25285c] hover:to-[#141738] shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] shrink-0 cursor-pointer active:scale-95 overflow-hidden"
            title="Match stats & word history"
            aria-label="Open match stats and word history"
          >
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
            <ScrollText className="h-3.5 w-3.5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)] relative z-10" />
            <span className="relative z-10 font-black">Stats</span>
          </button>

          <div className="hidden lg:block">
            <SpectatorBadge count={spectatorCount} />
          </div>
          {debugSlot}
          {onOpenGrimoire && isGrimoireEnabled && (
            <button
              type="button"
              onClick={onOpenGrimoire}
              className="group relative flex h-8 w-8 sm:w-auto sm:h-9 items-center justify-center gap-1 sm:gap-1.5 rounded-xl border border-amber-400/50 bg-gradient-to-b from-[#251a0c]/90 via-[#181208]/95 to-[#0e0a04]/95 text-amber-200 hover:text-white hover:border-amber-400/80 hover:shadow-[0_0_18px_rgba(245,158,11,0.35)] px-0 sm:px-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] active:scale-95 overflow-hidden"
              title="Grimoire (Word Guide)"
              aria-label="Open Word Grimoire"
            >
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
              <BookMarked className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)] relative z-10" />
              <span className="relative z-10 font-black text-[11px] sm:text-xs hidden sm:inline">
                Grimoire
              </span>
            </button>
          )}
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="group relative hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-indigo-400/25 bg-gradient-to-b from-[#181a42]/90 to-[#0d0f28]/95 text-slate-300 hover:text-amber-200 hover:border-amber-400/60 hover:from-[#25285c] hover:to-[#141738] hover:shadow-[0_0_18px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] active:scale-95 overflow-hidden"
              title="Game Guide & Cards"
              aria-label="Open Game Guide & Cards"
            >
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
              <BookOpen className="h-4 w-4 relative z-10 group-hover:scale-105 transition-transform" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-indigo-400/25 bg-gradient-to-b from-[#181a42]/90 to-[#0d0f28]/95 text-slate-300 hover:text-amber-200 hover:border-amber-400/60 hover:from-[#25285c] hover:to-[#141738] hover:shadow-[0_0_18px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] active:scale-95 overflow-hidden"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
            {isFullscreen ? (
              <Minimize className="h-3.5 w-3.5 sm:h-4 sm:w-4 relative z-10 group-hover:scale-105 transition-transform" />
            ) : (
              <Maximize className="h-3.5 w-3.5 sm:h-4 sm:w-4 relative z-10 group-hover:scale-105 transition-transform" />
            )}
          </button>
        </div>
      </header>

      {/* ROW 2 (Mobile only): Dedicated Turn Banner & Timer */}
      <div className="gameplay-mobile-turn-bar flex lg:hidden w-full items-center justify-center px-2.5 pb-2 pt-0.5 select-none">
        <div className="w-full max-w-lg flex items-stretch gap-1.5 sm:gap-2">
          <div className="flex-1 min-w-0 flex items-stretch">
            <TurnBanner
              mobile
              isMyTurn={isMyTurn}
              isBotPlacing={isBotPlacing}
              isEliminated={isEliminated}
              isSpectator={isSpectator}
              isConnected={isConnected}
              currentPlayer={currentPlayer}
              nextPlayer={nextPlayer}
              turnNumber={turnNumber}
              maxTurns={maxTurns}
              totalPlayers={totalPlayers}
            />
          </div>
          {timer && <div className="shrink-0 flex items-stretch">{timer}</div>}
        </div>
      </div>
    </div>
  );
};

