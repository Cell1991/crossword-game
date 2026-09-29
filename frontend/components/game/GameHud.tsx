'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Maximize, Minimize, ScrollText } from 'lucide-react';
import { Player } from '@/lib/types';
import { TurnBanner } from './TurnBanner';

interface GameHudProps {
  isSpectator: boolean;
  isConnected: boolean;
  roomPin: string | null;
  spectatorCount: number;
  isMyTurn: boolean;
  currentPlayer: Player | undefined;
  nextPlayer?: Player | undefined;
  turnNumber: number;
  maxTurns: number | null;
  onExit: () => void;
  onOpenInfo: () => void;
  /** The turn countdown, rendered by its own component so its tick stays local. */
  timer: React.ReactNode;
}

/** Top HUD. On a phone it wraps: controls and counters on the first row, the turn banner below. */
export const GameHud: React.FC<GameHudProps> = ({
  isSpectator,
  isConnected,
  roomPin,
  spectatorCount,
  isMyTurn,
  currentPlayer,
  nextPlayer,
  turnNumber,
  maxTurns,
  onExit,
  onOpenInfo,
  timer,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', updateFullscreen);
    document.addEventListener('webkitfullscreenchange', updateFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      document.removeEventListener('webkitfullscreenchange', updateFullscreen);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  return (
    <div className="relative z-10 flex items-center justify-between gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2 bg-slate-900/85 border-b border-slate-800/60 lg:backdrop-blur-sm shrink-0 overflow-x-hidden">
      {/* Left: Exit, logo, connection, room PIN, and Log & Stats */}
      <div className="flex flex-1 min-w-0 items-center gap-1.5 sm:gap-2.5">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white shrink-0 transition-colors"
          title={isSpectator ? 'Stop watching' : 'Exit game'}
          aria-label={isSpectator ? 'Stop watching' : 'Exit game'}
        >
          <span>Exit</span>
        </button>
        <Image
          src="/wordx-icon-256.png?v=20260915"
          alt="WordX logo"
          width={28}
          height={28}
          className="h-6 w-6 sm:h-7 sm:w-7 rounded-md object-contain shrink-0"
        />
        <span className="hidden text-lg font-black text-white sm:inline shrink-0">Word<span className="text-amber-400">X</span></span>
        <div
          className={`flex items-center gap-1 text-xs shrink-0 ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}
          title={isConnected ? 'Live' : 'Reconnecting...'}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="hidden sm:inline">{isConnected ? 'Live' : 'Reconnecting...'}</span>
        </div>
        {roomPin && (
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(roomPin).catch(() => undefined); }}
            className="whitespace-nowrap rounded-lg border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400 hover:bg-slate-800 hover:text-white shrink-0 transition-colors"
            title="Room PIN (click to copy)"
          >
            PIN <span className="font-bold text-amber-300">{roomPin}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenInfo}
          className="lg:hidden flex-1 max-w-[160px] flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-950/70 via-slate-900/80 to-slate-900/90 px-2.5 py-1 text-xs font-bold text-cyan-300 hover:from-cyan-900/80 hover:to-slate-800 hover:text-white shadow-[0_0_10px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/20 transition-all cursor-pointer active:scale-95 select-none shrink truncate"
          title="Match stats, word history, and tile bag"
          aria-label="Open match stats, word history, and tile bag"
        >
          <ScrollText className="h-3.5 w-3.5 text-cyan-300 drop-shadow-[0_0_4px_#22d3ee] shrink-0" />
          <span className="tracking-wide font-extrabold text-[11px] sm:text-xs truncate">Log & Stats</span>
        </button>
      </div>

      {/* Right: spectators, timer, TurnBanner, and Fullscreen button */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
        {spectatorCount > 0 && (
          <span className="whitespace-nowrap text-xs text-slate-400" title="Spectators watching">👁 {spectatorCount}</span>
        )}
        {timer}
        <div className="hidden lg:block"><TurnBanner isMyTurn={isMyTurn} currentPlayer={currentPlayer} nextPlayer={nextPlayer} turnNumber={turnNumber} maxTurns={maxTurns} /></div>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer active:scale-95 shrink-0"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize className="h-4 w-4 text-cyan-300" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
