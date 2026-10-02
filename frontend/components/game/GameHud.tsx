'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronDown, Eye, Maximize, Minimize, ScrollText } from 'lucide-react';
import { Player } from '@/lib/types';
import { TurnBanner } from './TurnBanner';

const SpectatorBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <div className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-950/50 px-2.5 text-xs font-semibold text-sky-200" title={`${count} spectator${count > 1 ? 's' : ''} watching`} aria-label={`${count} spectator${count > 1 ? 's' : ''} watching`}>
      <Eye className="h-3.5 w-3.5 text-sky-300" />
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

/** Opaque match navigation above the playfield. */
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
    <div className="gameplay-top-hud-container relative z-30 w-full shrink-0 flex flex-col border-b border-[#334b68]/80 bg-gradient-to-b from-[#1C2B3E] via-[#172536] to-[#121E2C] shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md">
      {/* ROW 1: System Bar (Back, PIN, Logo, Timer, Stats, Guide, Fullscreen) */}
      <header className="gameplay-top-hud relative grid w-full items-center grid-cols-[1fr_auto_1fr] gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2">
        {/* Left HUD cluster */}
        <div className="gameplay-hud-cluster gameplay-hud-left flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onExit}
            className="tactile-button flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(140,180,220,0.25)] bg-[#25384E] text-[#E2E8F0] hover:text-white hover:border-[#38BDF8] hover:bg-[#2F4763] hover:shadow-[0_0_14px_rgba(56,189,248,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
            title={isSpectator ? 'Stop watching' : 'Exit game'}
            aria-label={isSpectator ? 'Stop watching' : 'Exit game'}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {roomPin && (
            <button
              type="button"
              onClick={handleCopyPin}
              className={`tactile-button flex h-9 sm:h-10 shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl border px-2 sm:px-3 font-mono text-xs sm:text-sm font-bold transition-all shadow-[0_2px_8px_rgba(0,0,0,0.25)] cursor-pointer ${
                copiedPin
                  ? 'border-emerald-500/80 bg-emerald-950/80 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
                  : 'border-[rgba(140,180,220,0.25)] bg-[#25384E] text-[#E2E8F0] hover:border-[#F6C453] hover:bg-[#2F4763] hover:text-white hover:shadow-[0_0_14px_rgba(246,196,83,0.25)]'
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
                  <span className="text-[9px] sm:text-xs font-bold text-[#94A3B8] uppercase tracking-wider">PIN</span>
                  <strong className="text-xs sm:text-base font-black text-[#FCD34D] drop-shadow-[0_0_8px_rgba(252,211,77,0.5)]">#{roomPin}</strong>
                </>
              )}
            </button>
          )}

          <div
            className={`gameplay-live-indicator flex h-9 sm:h-10 items-center gap-1.5 rounded-xl px-2 sm:px-2.5 text-xs sm:text-sm font-black uppercase tracking-wider border ${
              isConnected
                ? 'border-emerald-500/40 bg-[#13382C] text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'border-rose-500/40 bg-[#38151D] text-rose-300 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
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
            <span className="hidden md:inline">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>

        {/* Center: WordX Brand on Mobile, WordX + Turn state on Desktop */}
        <div className="gameplay-hud-center flex min-w-0 items-center justify-center gap-3">
          <div className="gameplay-brand flex items-center select-none cursor-default py-0.5">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
              Word
            </span>
            <span className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-tr from-[#F59E0B] via-[#FCD34D] to-[#F59E0B] bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(245,158,11,0.9)] ml-0.5">
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
          <div className="gameplay-header-timer">{timer}</div>

          {/* Mobile-only Stats button */}
          <button
            type="button"
            onClick={onOpenInfo}
            className="gameplay-info-button tactile-button flex lg:hidden h-9 sm:h-10 items-center gap-1.5 rounded-xl border border-[rgba(140,180,220,0.25)] bg-[#25384E] px-2.5 sm:px-3 text-xs font-bold text-[#F1F5F9] hover:border-[#38BDF8] shadow-[0_2px_8px_rgba(0,0,0,0.25)] shrink-0"
            title="Match stats & word history"
            aria-label="Open match stats and word history"
          >
            <ScrollText className="h-4 w-4 text-[#38BDF8]" />
            <span>Stats</span>
          </button>

          <div className="hidden lg:block"><SpectatorBadge count={spectatorCount} /></div>
          {debugSlot}
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="tactile-button hidden sm:flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-[rgba(140,180,220,0.25)] bg-[#25384E] text-[#38BDF8] hover:border-[#38BDF8] hover:bg-[#2F4763] hover:text-white hover:shadow-[0_0_14px_rgba(56,189,248,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] shrink-0"
              title="Game Guide & Cards"
              aria-label="Open Game Guide & Cards"
            >
              <BookOpen className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="tactile-button hidden sm:flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-[rgba(140,180,220,0.25)] bg-[#25384E] text-[#E2E8F0] hover:border-[#38BDF8] hover:bg-[#2F4763] hover:text-white hover:shadow-[0_0_14px_rgba(56,189,248,0.3)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] shrink-0"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4 text-[#38BDF8]" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ROW 2 (Mobile only): Dedicated Clean Turn Banner */}
      <div className="gameplay-mobile-turn-bar flex lg:hidden w-full items-center justify-center px-2.5 pb-2 pt-0.5 select-none">
        <div className="w-full max-w-lg">
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
      </div>
    </div>
  );
};
