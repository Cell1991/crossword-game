'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Eye, Maximize, Minimize, ScrollText } from 'lucide-react';
import { Player } from '@/lib/types';
import { TurnBanner } from './TurnBanner';

const SpectatorBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <div
      className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-indigo-400/30 bg-[#121432]/90 px-2.5 text-xs font-bold text-indigo-200 shadow-[0_2px_10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]"
      title={`${count} spectator${count > 1 ? 's' : ''} watching`}
      aria-label={`${count} spectator${count > 1 ? 's' : ''} watching`}
    >
      <Eye className="h-3.5 w-3.5 text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.6)]" />
      <span className="font-bold tabular-nums">{count}</span>
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
  onExit,
  onOpenInfo,
  onOpenGuide,
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
    <div className="gameplay-top-hud-container relative z-30 w-full shrink-0 flex flex-col border-b border-white/10 bg-gradient-to-r from-[#0c0d24]/95 via-[#131438]/95 to-[#0c0d24]/95 shadow-[0_4px_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl">
      {/* Top subtle starlight golden/violet specular light edge */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/40 via-purple-400/30 to-transparent pointer-events-none" />

      {/* Decorative center radiant glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-12 bg-amber-400/8 rounded-full blur-2xl pointer-events-none" />

      {/* ROW 1: System Bar */}
      <header className="gameplay-top-hud relative z-10 grid w-full items-center grid-cols-[1fr_auto_1fr] gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2">
        {/* Left HUD cluster */}
        <div className="gameplay-hud-cluster gameplay-hud-left flex min-w-0 items-center gap-1.5 sm:gap-2">
          {/* Back / Exit Button */}
          <button
            type="button"
            onClick={onExit}
            className="tactile-button flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-[#121430]/90 text-slate-200 hover:text-white hover:border-amber-400/60 hover:bg-[#1b1e48] hover:shadow-[0_0_14px_rgba(251,191,36,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-95"
            title={isSpectator ? 'Stop watching' : 'Exit game'}
            aria-label={isSpectator ? 'Stop watching' : 'Exit game'}
          >
            <ArrowLeft className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </button>

          {/* Room PIN Pill */}
          {roomPin && (
            <button
              type="button"
              onClick={handleCopyPin}
              className={`tactile-button flex h-8 sm:h-9 shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl border px-2.5 sm:px-3 text-xs sm:text-sm font-bold transition-all shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer active:scale-95 ${
                copiedPin
                  ? 'border-emerald-400 bg-emerald-950/95 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.5)]'
                  : 'border-amber-400/30 bg-[#121430]/90 text-amber-200 hover:border-amber-400/60 hover:bg-[#1b1e48] hover:text-white hover:shadow-[0_0_14px_rgba(251,191,36,0.25)]'
              }`}
              title="Room PIN (click to copy)"
            >
              {copiedPin ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300 stroke-[3]" />
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Copied</span>
                </>
              ) : (
                <>
                  <span className="text-[9.5px] sm:text-[10.5px] font-black text-amber-300/80 uppercase tracking-wider">
                    PIN
                  </span>
                  <strong className="text-xs sm:text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    #{roomPin}
                  </strong>
                </>
              )}
            </button>
          )}

          {/* Live Match Connection LED */}
          <div
            className={`gameplay-live-indicator hidden md:flex h-8 sm:h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-black uppercase tracking-wider border shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ${
              isConnected
                ? 'border-emerald-400/40 bg-emerald-950/70 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'border-rose-400/40 bg-rose-950/70 text-rose-300 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
            }`}
            title={isConnected ? 'Live match connected' : 'Reconnecting to match'}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                  : 'bg-rose-400 shadow-[0_0_8px_#f87171]'
              }`}
            />
            <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>

        {/* Center: WordX Logo & Turn state */}
        <div className="gameplay-hud-center flex min-w-0 items-center justify-center gap-3">
          <div className="gameplay-brand flex items-center select-none cursor-default py-0.5 group">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
              Word
            </span>
            <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-tr from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(245,158,11,1)] ml-0.5">
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
            className="gameplay-info-button tactile-button flex lg:hidden h-8 sm:h-9 items-center gap-1 sm:gap-1.5 rounded-xl border border-white/12 bg-[#121430]/90 px-2.5 sm:px-3 text-xs font-bold text-slate-100 hover:border-amber-400/60 shadow-[0_2px_8px_rgba(0,0,0,0.5)] shrink-0 cursor-pointer active:scale-95"
            title="Match stats & word history"
            aria-label="Open match stats and word history"
          >
            <ScrollText className="h-3.5 w-3.5 text-amber-300" />
            <span>Stats</span>
          </button>

          <div className="hidden lg:block">
            <SpectatorBadge count={spectatorCount} />
          </div>
          {debugSlot}
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="tactile-button hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/12 bg-[#121430]/90 text-slate-200 hover:border-amber-400/60 hover:bg-[#1b1e48] hover:text-white hover:shadow-[0_0_14px_rgba(251,191,36,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-95"
              title="Game Guide & Cards"
              aria-label="Open Game Guide & Cards"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="tactile-button flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/12 bg-[#121430]/90 text-slate-200 hover:border-amber-400/60 hover:bg-[#1b1e48] hover:text-white hover:shadow-[0_0_14px_rgba(251,191,36,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-95"
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
            />
          </div>
          {timer && <div className="shrink-0 flex items-stretch">{timer}</div>}
        </div>
      </div>
    </div>
  );
};
