'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, BookOpen, Check, Eye, Maximize, Minimize, ScrollText } from 'lucide-react';
import { Player } from '@/lib/types';
import { TurnBanner } from './TurnBanner';

const SpectatorBadge: React.FC<{ count: number; className?: string }> = ({ count, className = '' }) => {
  if (count <= 0) return null;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-gradient-to-r from-sky-950/70 via-slate-900/80 to-sky-950/70 px-2 py-1 text-xs font-semibold text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.2)] ring-1 ring-sky-400/25 whitespace-nowrap shrink-0 select-none ${className}`}
      title={`${count} spectator${count > 1 ? 's' : ''} watching`}
      aria-label={`${count} spectator${count > 1 ? 's' : ''} watching`}
    >
      <Eye className="h-3.5 w-3.5 text-sky-400 drop-shadow-[0_0_4px_#38bdf8] shrink-0" />
      <span className="font-mono text-sky-200 tabular-nums">{count}</span>
    </div>
  );
};

interface GameHudProps {
  isSpectator: boolean;
  isEliminated?: boolean;
  isConnected: boolean;
  roomPin: string | null;
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
  /** The turn countdown, rendered by its own component so its tick stays local. */
  timer: React.ReactNode;
  debugSlot?: React.ReactNode;
}

/** Top HUD. On a phone it wraps: controls and counters on the first row, the turn banner below. */
export const GameHud: React.FC<GameHudProps> = ({
  isSpectator,
  isEliminated = false,
  isConnected,
  roomPin,
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
    setTimeout(() => setCopiedPin(false), 2000);
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
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (safariElement.webkitRequestFullscreen) {
          await safariElement.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (safariDocument.webkitExitFullscreen) {
          await safariDocument.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  return (
    <div className="game-hud relative z-20 flex shrink-0 flex-col border-b border-slate-700/55 bg-slate-950/90">
      {/* ROW 1: System Bar (Exit, Logo, Connection, PIN, Log & Stats, Fullscreen) */}
      <div className="game-hud-row mx-auto grid w-full max-w-[1920px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 px-2.5 py-2 sm:gap-x-4 sm:px-5 sm:py-2.5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* Left: Exit, logo, connection, room PIN, and Log & Stats */}
        <div className="game-hud-leading flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={onExit}
            className="tactile-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900 text-slate-300 transition-colors hover:border-slate-500 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            title={isSpectator ? 'Stop watching' : 'Exit game'}
            aria-label={isSpectator ? 'Stop watching' : 'Exit game'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Image
            src="/wordx-icon-256.png?v=20260915"
            alt="WordX logo"
            width={28}
            height={28}
            className="h-7 w-7 rounded-md object-contain shrink-0"
          />
          <span className="text-base font-black tracking-tight text-white sm:text-lg shrink-0">Word<span className="text-amber-400">X</span></span>
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 ${isConnected ? 'text-emerald-400' : 'text-rose-400'}`}
            title={isConnected ? 'Live' : 'Reconnecting...'}
          >
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.14em]">{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          {roomPin && (
            <button
              type="button"
              onClick={handleCopyPin}
              className={`tactile-button whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-mono text-[11px] shrink-0 cursor-pointer select-none transition-colors ${
                copiedPin
                  ? 'border-emerald-500/70 bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                  : 'border-slate-700/80 bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Room PIN (click to copy)"
            >
              {copiedPin ? (
                <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </span>
              ) : (
                <>
                  PIN <span className="font-black text-amber-300">#{roomPin}</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onOpenInfo}
            className="tactile-button lg:hidden flex h-9 items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 bg-slate-900 px-2.5 text-xs font-bold text-cyan-200 hover:border-cyan-300/60 hover:text-white cursor-pointer select-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            title="Match stats, word history, and tile bag"
            aria-label="Open match stats, word history, and tile bag"
          >
            <ScrollText className="h-3.5 w-3.5 text-cyan-300 drop-shadow-[0_0_4px_#22d3ee] shrink-0" />
            <span className="hidden tracking-wide font-extrabold text-[11px] whitespace-nowrap sm:inline">Stats</span>
          </button>
        </div>

        {/* Center: the active match state stays visually anchored to the board. */}
        <div className="game-turn-island hidden items-center justify-center gap-2 lg:flex">
          {timer}
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

        {/* Right: match utilities */}
        <div className="game-hud-tools col-start-2 row-start-1 flex items-center justify-end gap-1.5 sm:gap-2.5 lg:col-start-3 lg:row-start-1">
          {spectatorCount > 0 && (
            <div className="hidden lg:inline-flex shrink-0">
              <SpectatorBadge count={spectatorCount} />
            </div>
          )}
          {debugSlot}
          {onOpenGuide && (
            <button
              type="button"
              onClick={onOpenGuide}
              className="tactile-button flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              title="Game Guide & Cards"
              aria-label="Open Game Guide & Cards"
            >
              <BookOpen className="h-4 w-4 text-cyan-300" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="tactile-button flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4 text-cyan-300" /> : <Maximize className="h-4 w-4 text-slate-300" />}
          </button>
        </div>
      </div>

      {/* ROW 2 (Mobile Only): Dedicated Turn Indicator, Spectator Count & Countdown Bar */}
      <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-2 border-t border-slate-800/60 bg-slate-950 px-3 py-1.5 lg:hidden select-none">
        <div className="min-w-0 flex-1">
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
        <div className="flex items-center gap-1.5 shrink-0">
          {spectatorCount > 0 && <SpectatorBadge count={spectatorCount} />}
          {timer && <div className="shrink-0">{timer}</div>}
        </div>
      </div>
    </div>
  );
};
