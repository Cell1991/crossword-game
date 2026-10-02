'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Eye, Maximize, Minimize, ScrollText } from 'lucide-react';
import { Player } from '@/lib/types';
import { TurnBanner } from './TurnBanner';

const SpectatorBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <div className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sky-500/30 bg-[#0a1220]/90 px-2.5 text-xs font-bold text-sky-300 shadow-[0_2px_8px_rgba(0,0,0,0.4)]" title={`${count} spectator${count > 1 ? 's' : ''} watching`} aria-label={`${count} spectator${count > 1 ? 's' : ''} watching`}>
      <Eye className="h-3.5 w-3.5 text-sky-400" />
      <span className="font-mono tabular-nums">{count}</span>
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
  onExit: () => void;
  onOpenInfo: () => void;
  onOpenGuide?: () => void;
  timer: React.ReactNode;
  debugSlot?: React.ReactNode;
}

/** Rich Gold & Black match navigation header with modern cyan & white tactile controls. */
export const GameHud: React.FC<GameHudProps> = ({
  isSpectator, isEliminated = false, isConnected, roomPin, myPlayerName, spectatorCount,
  isMyTurn, isBotPlacing = false, currentPlayer, nextPlayer, turnNumber, maxTurns,
  onExit, onOpenInfo, onOpenGuide, timer, debugSlot,
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
      const safariDocument = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
      const safariElement = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
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
    <div className="gameplay-top-hud-container relative z-30 w-full shrink-0 flex flex-col border-b-2 border-amber-400/80 bg-gradient-to-r from-[#1c1303] via-[#45300c] via-[#241906] via-[#4d360e] to-[#1c1303] shadow-[0_6px_30px_rgba(245,158,11,0.25),0_2px_8px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,236,179,0.45)] backdrop-blur-2xl">
      {/* Top subtle golden light edge */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent pointer-events-none" />

      {/* Decorative center gold radiance */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-16 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* ROW 1: System Bar (Back, PIN, Logo, Timer, Stats, Guide, Fullscreen) */}
      <header className="gameplay-top-hud relative z-10 grid w-full items-center grid-cols-[1fr_auto_1fr] gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2">
        {/* Left HUD cluster */}
        <div className="gameplay-hud-cluster gameplay-hud-left flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onExit}
            className="tactile-button flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#0a1220]/90 text-slate-200 hover:text-white hover:border-cyan-400/60 hover:bg-[#121f35] hover:shadow-[0_0_14px_rgba(34,211,238,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
            title={isSpectator ? 'Stop watching' : 'Exit game'}
            aria-label={isSpectator ? 'Stop watching' : 'Exit game'}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {roomPin && (
            <button
              type="button"
              onClick={handleCopyPin}
              className={`tactile-button flex h-8 sm:h-10 shrink-0 items-center gap-1 sm:gap-2 rounded-xl border px-2 sm:px-3 font-mono text-xs sm:text-sm font-bold transition-all shadow-[0_2px_8px_rgba(0,0,0,0.4)] cursor-pointer ${
                copiedPin
                  ? 'border-emerald-400 bg-emerald-950/95 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.5)]'
                  : 'border-white/15 bg-[#0a1220]/90 text-slate-200 hover:border-cyan-400/60 hover:bg-[#121f35] hover:text-white hover:shadow-[0_0_14px_rgba(34,211,238,0.25)]'
              }`}
              title="Room PIN (click to copy)"
            >
              {copiedPin ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="font-sans text-[10px] sm:text-xs font-bold">Copied</span>
                </>
              ) : (
                <>
                  <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">PIN</span>
                  <strong className="text-xs sm:text-base font-black text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">#{roomPin}</strong>
                </>
              )}
            </button>
          )}

          <div
            className={`gameplay-live-indicator hidden md:flex h-9 sm:h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs sm:text-sm font-black uppercase tracking-wider border shadow-[0_2px_8px_rgba(0,0,0,0.4)] ${
              isConnected
                ? 'border-emerald-400/50 bg-emerald-950/70 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'border-rose-400/50 bg-rose-950/70 text-rose-300 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
            }`}
            title={isConnected ? 'Live match connected' : 'Reconnecting to match'}
          >
            <span
              className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse'
                  : 'bg-rose-400 shadow-[0_0_10px_#f87171]'
              }`}
            />
            <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>

        {/* Center: WordX Brand on Mobile, WordX + Turn state on Desktop */}
        <div className="gameplay-hud-center flex min-w-0 items-center justify-center gap-3">
          <div className="gameplay-brand flex items-center select-none cursor-default py-0.5">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
              Word
            </span>
            <span className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-tr from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(245,158,11,1)] ml-0.5">
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
            />
          </div>
        </div>

        {/* Right HUD cluster */}
        <div className="gameplay-hud-cluster gameplay-hud-right flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <div className="gameplay-header-timer hidden lg:block">{timer}</div>

          {/* Mobile-only Stats button */}
          <button
            type="button"
            onClick={onOpenInfo}
            className="gameplay-info-button tactile-button flex lg:hidden h-8 sm:h-10 items-center gap-1 sm:gap-1.5 rounded-xl border border-white/15 bg-[#0a1220]/90 px-2 sm:px-3 text-xs font-bold text-slate-100 hover:border-cyan-400/60 shadow-[0_2px_8px_rgba(0,0,0,0.4)] shrink-0 cursor-pointer"
            title="Match stats & word history"
            aria-label="Open match stats and word history"
          >
            <ScrollText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-400" />
            <span>Stats</span>
          </button>

          <div className="hidden lg:block"><SpectatorBadge count={spectatorCount} /></div>
          {debugSlot}
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="tactile-button hidden sm:flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-white/15 bg-[#0a1220]/90 text-cyan-400 hover:border-cyan-400/70 hover:bg-[#121f35] hover:text-white hover:shadow-[0_0_14px_rgba(34,211,238,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shrink-0 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
              title="Game Guide & Cards"
              aria-label="Open Game Guide & Cards"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="tactile-button flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-white/15 bg-[#0a1220]/90 text-cyan-400 hover:border-cyan-400/70 hover:bg-[#121f35] hover:text-white hover:shadow-[0_0_14px_rgba(34,211,238,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shrink-0 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <Maximize className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </button>
        </div>
      </header>

      {/* ROW 2 (Mobile only): Dedicated Clean Turn Banner & Timer */}
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
            />
          </div>
          {timer && (
            <div className="shrink-0 flex items-stretch">
              {timer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
