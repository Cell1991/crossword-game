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
    <header className="gameplay-top-hud relative z-30 grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
      {/* Left HUD cluster */}
      <div className="gameplay-hud-cluster gameplay-hud-left flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onExit}
          className="tactile-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(120,160,200,0.2)] bg-[rgba(20,35,55,0.65)] text-[#91A0B5] hover:text-[#F2F6FC] hover:border-[#22D3C5]/50 hover:shadow-[0_0_12px_rgba(34,211,197,0.2)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5]/70"
          title={isSpectator ? 'Stop watching' : 'Exit game'}
          aria-label={isSpectator ? 'Stop watching' : 'Exit game'}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {roomPin && (
          <button
            type="button"
            onClick={handleCopyPin}
            className={`tactile-button flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 font-mono text-xs font-bold transition-all shadow-[0_2px_8px_rgba(0,0,0,0.2)] cursor-pointer ${
              copiedPin
                ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'border-[rgba(120,160,200,0.2)] bg-[rgba(20,35,55,0.65)] text-[#91A0B5] hover:border-[#F6C453]/60 hover:text-white hover:shadow-[0_0_12px_rgba(246,196,83,0.15)]'
            }`}
            title="Room PIN (click to copy)"
          >
            {copiedPin ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <span className="text-[10px] text-[#66758A] uppercase tracking-wider">PIN</span>
                <strong className="text-[#F6C453] drop-shadow-[0_0_6px_rgba(246,196,83,0.4)]">#{roomPin}</strong>
              </>
            )}
          </button>
        )}

        <div
          className={`gameplay-live-indicator flex h-9 items-center gap-2 rounded-xl px-2.5 text-[10px] font-bold uppercase tracking-[.15em] border ${
            isConnected
              ? 'border-emerald-500/25 bg-emerald-950/30 text-emerald-300'
              : 'border-rose-500/25 bg-rose-950/30 text-rose-300'
          }`}
          title={isConnected ? 'Live match connected' : 'Reconnecting to match'}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected
                ? 'bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse'
                : 'bg-rose-400 shadow-[0_0_8px_#ef4444]'
            }`}
          />
          <span className="hidden sm:inline">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>

      {/* Center WordX Brand & Turn state */}
      <div className="gameplay-hud-center flex min-w-0 flex-col items-center justify-center">
        <div className="gameplay-brand flex items-center px-3.5 py-1 rounded-2xl bg-[rgba(20,35,55,0.55)] border border-[rgba(120,160,200,0.18)] shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
          <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-b from-white via-[#F2F6FC] to-[#91A0B5] bg-clip-text text-transparent">
            Word
          </span>
          <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-tr from-[#F6C453] via-[#FFD56A] to-[#F59E0B] bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(246,196,83,0.85)] ml-0.5">
            X
          </span>
        </div>
        <div className="gameplay-turn-state flex min-w-0 items-center justify-center gap-2 lg:hidden mt-1">
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

      {/* Right HUD cluster */}
      <div className="gameplay-hud-cluster gameplay-hud-right flex min-w-0 items-center justify-end gap-2">
        <div className="gameplay-header-timer">{timer}</div>

        {/* Mobile-only Stats button (hidden on desktop where RightSidebar is visible) */}
        <button
          type="button"
          onClick={onOpenInfo}
          className="gameplay-info-button tactile-button flex lg:hidden h-9 items-center gap-1.5 rounded-xl border border-[rgba(120,160,200,0.2)] bg-[rgba(20,35,55,0.65)] px-2.5 text-xs font-bold text-[#F2F6FC] hover:border-[#22D3C5]/50 shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
          title="Match stats & word history"
          aria-label="Open match stats and word history"
        >
          <ScrollText className="h-3.5 w-3.5 text-[#22D3C5]" />
          <span>Stats</span>
        </button>

        <div className="hidden sm:block"><SpectatorBadge count={spectatorCount} /></div>
        {debugSlot}
        {onOpenGuide && (
          <button
            type="button"
            onClick={onOpenGuide}
            className="tactile-button flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(120,160,200,0.2)] bg-[rgba(20,35,55,0.65)] text-[#22D3C5] hover:border-[#22D3C5]/60 hover:text-white hover:shadow-[0_0_12px_rgba(34,211,197,0.2)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5]/70"
            title="Game Guide & Cards"
            aria-label="Open Game Guide & Cards"
          >
            <BookOpen className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="tactile-button flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(120,160,200,0.2)] bg-[rgba(20,35,55,0.65)] text-[#91A0B5] hover:border-[#22D3C5]/60 hover:text-white hover:shadow-[0_0_12px_rgba(34,211,197,0.2)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5]/70"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize className="h-4 w-4 text-[#22D3C5]" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
