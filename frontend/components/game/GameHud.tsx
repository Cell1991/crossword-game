'use client';

import React from 'react';
import Image from 'next/image';
import { Player } from '@/lib/types';
import { TurnBanner } from './TurnBanner';

interface GameHudProps {
  isSpectator: boolean;
  isConnected: boolean;
  roomPin: string | null;
  spectatorCount: number;
  isMyTurn: boolean;
  currentPlayer: Player | undefined;
  turnNumber: number;
  onExit: () => void;
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
  turnNumber,
  onExit,
  timer,
}) => (
  <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2 sm:px-4 bg-slate-900/75 border-b border-slate-800/60 backdrop-blur-sm shrink-0">
    {/* Left: Exit, logo, connection, room PIN */}
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <button
        onClick={onExit}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
        title={isSpectator ? 'Stop watching' : 'Exit game'}
      >
        <span>Exit</span>
      </button>
      <Image
        src="/wordx-icon.png?v=20260915"
        alt="WordX logo"
        width={30}
        height={30}
        className="h-7 w-7 rounded-md object-contain"
      />
      <span className="hidden text-lg font-black text-white sm:inline">Word<span className="text-amber-400">X</span></span>
      <div
        className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}
        title={isConnected ? 'Live' : 'Reconnecting...'}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
        <span className="hidden sm:inline">{isConnected ? 'Live' : 'Reconnecting...'}</span>
      </div>
      {roomPin && (
        <button
          type="button"
          onClick={() => { void navigator.clipboard?.writeText(roomPin).catch(() => undefined); }}
          className="whitespace-nowrap rounded-lg border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
          title="Room PIN (click to copy)"
        >
          PIN <span className="font-bold text-amber-300">{roomPin}</span>
        </button>
      )}
    </div>

    {/* Right: spectators, timer, and TurnBanner */}
    <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
      {spectatorCount > 0 && (
        <span className="whitespace-nowrap text-xs text-slate-400" title="Spectators watching">👁 {spectatorCount}</span>
      )}
      {timer}
      <TurnBanner isMyTurn={isMyTurn} currentPlayer={currentPlayer} turnNumber={turnNumber} />
    </div>
  </div>
);
