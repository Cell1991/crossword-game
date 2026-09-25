'use client';

import React, { memo, useCallback, useRef, useState } from 'react';
import { MoveHistoryEntry, Player } from '@/lib/types';
import { BoardCamera, useCameraScale } from '@/hooks/useBoardCamera';
import {
  Trophy,
  Crown,
  Wifi,
  WifiOff,
  ZoomIn,
  ZoomOut,
  Compass,
  History,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { cardIcon } from './cardIcons';
import { TileBagDialog } from './TileBagDialog';

/** Zoom buttons and level. Subscribes to the camera itself so zooming re-renders only this row. */
function MapControls({ camera, onZoomIn, onZoomOut, onReset }: {
  camera: BoardCamera;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const scale = useCameraScale(camera);
  const isMinZoom = scale <= camera.minScale;
  const isMaxZoom = scale >= camera.maxScale;
  return (
    <div className="p-3 border-b border-slate-800/80 bg-slate-900/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
          Map Controls
        </span>
        {/* Minimalist Zoom Level Indicator Badge */}
        <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] font-mono font-semibold text-cyan-300 shadow-inner">
          {Math.round(scale * 100)}%
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          disabled={isMaxZoom}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 active:scale-95 border border-slate-700/60 text-slate-200 hover:text-cyan-300 disabled:text-slate-600 disabled:bg-slate-900/40 disabled:border-slate-800/40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] cursor-pointer"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold">+</span>
        </button>

        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          disabled={isMinZoom}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 active:scale-95 border border-slate-700/60 text-slate-200 hover:text-cyan-300 disabled:text-slate-600 disabled:bg-slate-900/40 disabled:border-slate-800/40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] cursor-pointer"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold">-</span>
        </button>

        {/* Reset View */}
        <button
          onClick={onReset}
          className="flex items-center justify-center p-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 active:scale-95 border border-slate-700/60 text-slate-300 hover:text-cyan-300 transition-all shadow-sm hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] cursor-pointer"
          title="Reset View"
          aria-label="Reset View"
        >
          <Compass className="w-4 h-4 text-cyan-400" />
        </button>
      </div>
    </div>
  );
}

interface RightSidebarProps {
  players: Player[];
  currentPlayerId: string | null;
  myPlayerId: string | null;
  tileBagCount: number;
  tileBagCounts: Record<string, number>;
  moveHistory?: MoveHistoryEntry[];
  cardUseEffects?: Record<string, string>;
  // Zoom & Map Controls
  camera: BoardCamera;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export const RightSidebar = memo(function RightSidebar({
  players,
  currentPlayerId,
  myPlayerId,
  tileBagCount,
  tileBagCounts,
  moveHistory = [],
  cardUseEffects = {},
  camera,
  onZoomIn,
  onZoomOut,
  onReset,
}: RightSidebarProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isTileBagOpen, setIsTileBagOpen] = useState(false);
  const tileBagButtonRef = useRef<HTMLButtonElement>(null);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const closeTileBag = useCallback(() => {
    setIsTileBagOpen(false);
    tileBagButtonRef.current?.focus();
  }, []);

  return (
    <aside className="flex flex-col h-full w-72 shrink-0 p-3 select-none">
      {/* Sleek Vertical Glassmorphism Panel */}
      <div className="flex flex-col h-full bg-slate-950/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.12),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-cyan-500/20 overflow-hidden">
        
        {/* TOP SECTION: VERTICAL MAP & VIEW CONTROLS */}
        <MapControls camera={camera} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onReset} />

        {/* MIDDLE SECTION: COMPACT TILES STATUS CARD */}
        <div className="p-3 border-b border-slate-800/80 bg-gradient-to-r from-blue-950/30 via-slate-900/30 to-slate-950/30">
          <button
            ref={tileBagButtonRef}
            type="button"
            onClick={() => setIsTileBagOpen(true)}
            className="group w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-blue-500/20 hover:border-cyan-400/50 hover:bg-slate-800/80 active:scale-[0.99] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_0_14px_rgba(6,182,212,0.16)] transition-all cursor-pointer text-left"
            aria-label={`Show remaining letters, ${tileBagCount} tiles remaining`}
          >
            <div className="flex items-center gap-2.5">
              {/* Cosmic Tile Stack Icon */}
              <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/30 via-blue-600/40 to-slate-900 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.4)] flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-cyan-300 drop-shadow-[0_0_4px_#38bdf8]" />
                </div>
              </div>
              <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">Tiles Remaining</span>
            </div>
            <span className="text-sm font-bold font-mono text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
              {tileBagCount}
            </span>
          </button>
        </div>

        {/* MAIN SECTION: SCOREBOARD */}
        <div className="flex-1 flex flex-col min-h-0 p-3 overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                Scoreboard
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {players.length} {players.length === 1 ? 'Player' : 'Players'}
            </span>
          </div>

          {/* Players List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {sortedPlayers.map((player, idx) => {
              const isCurrent = player.id === currentPlayerId;
              const isMe = player.id === myPlayerId;
              const isDead = player.hp <= 0;
              const hasLeft = player.connection_status === 'OFFLINE';

              return (
                <div
                  key={player.id}
                  className={`relative flex flex-col p-2.5 rounded-xl transition-all ${
                    isDead || hasLeft
                      ? 'bg-slate-950/60 border border-slate-800/50 opacity-50'
                      : isMe
                      ? 'bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-slate-900/60 border border-pink-500/50 shadow-[0_0_14px_rgba(236,72,153,0.25)] ring-1 ring-pink-500/30'
                      : isCurrent
                      ? 'bg-blue-950/40 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'bg-slate-900/50 border border-slate-800/70 hover:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Rank Number */}
                      <span className={`text-xs font-mono font-bold w-4 shrink-0 ${
                        idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {idx + 1}.
                      </span>

                      {/* Player Name */}
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`text-xs truncate ${
                          isDead || hasLeft 
                            ? 'text-slate-500 line-through' 
                            : isMe 
                            ? 'font-bold text-pink-200' 
                            : 'font-medium text-slate-200'
                        }`}>
                          {player.display_name} {isMe && '(You)'}
                        </span>
                        {player.is_host && (
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                        )}
                        {cardUseEffects[player.id] && (
                          <span
                            className="animate-pulse rounded-full border border-cyan-300/80 bg-cyan-400/20 px-1.5 py-0.5 text-sm leading-none shadow-[0_0_14px_rgba(34,211,238,0.85)]"
                            title={`${cardUseEffects[player.id]} used`}
                          >
                            {cardIcon(cardUseEffects[player.id], 'h-3.5 w-3.5', <span className="text-xs font-black text-amber-300">×2</span>) ?? '✨'}
                          </span>
                        )}
                        {isCurrent && !isDead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8] animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Score & Connection Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold font-mono text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">
                        {player.score}
                      </span>
                      {player.connection_status === 'ONLINE' ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400/80" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 text-rose-400/80" />
                      )}
                    </div>
                  </div>

                  {/* HP Bar */}
                  <div className="mt-2 h-1 rounded-full bg-slate-950/80 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        player.hp <= 0 
                          ? 'bg-slate-700' 
                          : player.hp > 50 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                          : 'bg-gradient-to-r from-rose-500 to-amber-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, player.hp))}%` }}
                    />
                  </div>

                  {/* Vibrant Pink-Magenta Glowing Accent Line for "You" */}
                  {isMe && (
                    <div className="mt-1.5 h-0.5 rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-400 to-pink-500 shadow-[0_0_8px_#ec4899]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM SECTION: COLLAPSIBLE WORD HISTORY FEED */}
        <div className="border-t border-slate-800/80 bg-slate-900/40">
          <button
            onClick={() => setIsHistoryOpen(prev => !prev)}
            className="w-full flex items-center justify-between p-2.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Move History</span>
            </div>
            {isHistoryOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {isHistoryOpen && (
            <div className="p-2.5 pt-0 max-h-32 overflow-y-auto space-y-1.5">
              {moveHistory.length === 0 ? (
                <div className="py-2 text-center text-[11px] text-slate-500 italic">
                  No moves recorded yet
                </div>
              ) : (
                moveHistory.slice(-5).reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs"
                  >
                    <span className="text-slate-300 truncate max-w-[170px]">
                      {entry.text}
                    </span>
                    {entry.score !== undefined && entry.score > 0 && (
                      <span className="font-mono font-bold text-emerald-400 shrink-0">
                        +{entry.score}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>

      {isTileBagOpen && (
        <TileBagDialog tileBagCount={tileBagCount} tileBagCounts={tileBagCounts} onClose={closeTileBag} />
      )}
    </aside>
  );
});
