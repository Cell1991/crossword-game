'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, BookOpen, Check, Eye, Maximize, Minimize, ScrollText } from 'lucide-react';
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

/** Three independent HUD clusters; each keeps the original match actions and state. */
export const GameHud: React.FC<GameHudProps> = ({
  isSpectator, isEliminated = false, isConnected, roomPin, spectatorCount,
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
    <header className="gameplay-top-hud relative z-30 mx-auto grid w-full max-w-[1920px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3 sm:px-5 sm:py-4">
      <div className="gameplay-hud-cluster gameplay-hud-left flex min-w-0 items-center gap-2">
        <button type="button" onClick={onExit} className="tactile-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70" title={isSpectator ? 'Stop watching' : 'Exit game'} aria-label={isSpectator ? 'Stop watching' : 'Exit game'}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        {roomPin && (
          <button type="button" onClick={handleCopyPin} className={`tactile-button flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11px] transition-colors ${copiedPin ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-200' : 'border-slate-700/70 bg-slate-900/65 text-slate-300 hover:border-amber-300/40 hover:text-white'}`} title="Room PIN (click to copy)">
            {copiedPin ? <><Check className="h-3.5 w-3.5" />Copied</> : <>PIN <strong className="text-amber-300">#{roomPin}</strong></>}
          </button>
        )}
        <div className={`gameplay-live-indicator flex h-9 items-center gap-2 rounded-lg px-2 text-[10px] font-bold uppercase tracking-[.13em] ${isConnected ? 'text-emerald-300' : 'text-rose-300'}`} title={isConnected ? 'Live' : 'Reconnecting'}>
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-300 shadow-[0_0_9px_rgba(110,231,183,.7)]' : 'bg-rose-400'}`} />
          <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      <div className="gameplay-hud-center flex min-w-0 flex-col items-center justify-center gap-1.5">
        <div className="gameplay-brand flex items-center gap-2">
          <Image src="/wordx-icon-256.png?v=20260915" alt="WordX" width={25} height={25} className="h-6 w-6 rounded-md object-contain" />
          <span className="text-base font-black tracking-tight text-white sm:text-lg">Word<span className="text-amber-400">X</span></span>
          <span className="hidden text-[9px] font-bold uppercase tracking-[.24em] text-slate-500 sm:inline">Arena</span>
        </div>
        <div className="gameplay-turn-state flex min-w-0 items-center justify-center gap-2">
          {timer}
          <TurnBanner mobile isMyTurn={isMyTurn} isBotPlacing={isBotPlacing} isEliminated={isEliminated} isSpectator={isSpectator} isConnected={isConnected} currentPlayer={currentPlayer} nextPlayer={nextPlayer} turnNumber={turnNumber} maxTurns={maxTurns} />
        </div>
      </div>

      <div className="gameplay-hud-cluster gameplay-hud-right flex min-w-0 items-center justify-end gap-2">
        <button type="button" onClick={onOpenInfo} className="tactile-button flex h-9 items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-slate-900/65 px-2.5 text-xs font-bold text-cyan-100 hover:border-cyan-300/50 sm:hidden" title="Match stats, word history, and tile bag" aria-label="Open match stats, word history, and tile bag">
          <ScrollText className="h-3.5 w-3.5 text-cyan-300" /><span>Stats</span>
        </button>
        <div className="hidden sm:block"><SpectatorBadge count={spectatorCount} /></div>
        {debugSlot}
        {onOpenGuide && <button type="button" onClick={onOpenGuide} className="tactile-button flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/75 text-cyan-300 hover:border-cyan-300/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70" title="Game Guide & Cards" aria-label="Open Game Guide & Cards"><BookOpen className="h-4 w-4" /></button>}
        <button type="button" onClick={toggleFullscreen} className="tactile-button flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/75 text-slate-300 hover:border-cyan-300/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70" title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'} aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
          {isFullscreen ? <Minimize className="h-4 w-4 text-cyan-300" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
