'use client';

import React, { memo, useRef, useState } from 'react';
import { Tile } from '@/lib/types';
import { isBlankLetter } from '@/lib/tiles';
import { moveFixedElement } from '@/lib/dom';
import { RotateCcw, Check, SkipForward, Shuffle, ArrowLeftRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FloatingTile } from './FloatingTile';

interface TileRackProps {
  /** Fixed seats. `null` means the seat is empty — either the tile is on the board or the bag ran dry. */
  slots: (Tile | null)[];
  selectedTileId: string | null;
  designatedBlankLetters: Record<string, string>;
  /** Tiles picked to go back to the bag, or `null` when the player is not exchanging. */
  exchangeTileIds: string[] | null;
  tileBagCount: number;
  onSelectTile: (tile: Tile) => void;
  onCancelMove: () => void;
  onConfirmMove: () => void;
  onPassTurn: () => void;
  onShuffleRack: () => void;
  onStartExchange: () => void;
  onCancelExchange: () => void;
  onConfirmExchange: () => void;
  onSwapSlots: (fromSlot: number, toSlot: number) => void;
  onStartTileDrag: (tile: Tile, slotIndex: number, clientX: number, clientY: number) => void;
  onFinishTileDrag: (clientX?: number, clientY?: number) => void;
  onCancelTileDrag: () => void;
  /** The tray element; the page's board drag hit-tests drops against it. */
  rackRef: React.RefObject<HTMLDivElement | null>;
  isExternalDragActive: boolean;
  isMyTurn: boolean;
  canStageMove: boolean;
  hasTemporaryTiles: boolean;
  stagedTileCount?: number;
  /** Server verdict on the tiles placed on the board: `null` while it is being checked. */
  placementValid: boolean | null;
  isSubmitting: boolean;
  estimatedScore?: number;
  isBingoBonus?: boolean;
  powerCardSlot?: React.ReactNode;
}

export const TileRack = memo(function TileRack({
  slots,
  selectedTileId,
  designatedBlankLetters,
  exchangeTileIds,
  tileBagCount,
  onSelectTile,
  onCancelMove,
  onConfirmMove,
  onPassTurn,
  onShuffleRack,
  onStartExchange,
  onCancelExchange,
  onConfirmExchange,
  onSwapSlots,
  onStartTileDrag,
  onFinishTileDrag,
  onCancelTileDrag,
  rackRef,
  isExternalDragActive,
  isMyTurn,
  canStageMove,
  hasTemporaryTiles,
  stagedTileCount = 0,
  placementValid,
  isSubmitting,
  estimatedScore,
  isBingoBonus,
  powerCardSlot,
}: TileRackProps) {
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  /** True when the user has clicked Pass once and we're waiting for confirm/cancel. */
  const [passConfirming, setPassConfirming] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number; slotIndex: number; tile: Tile } | null>(null);
  const didDragRef = useRef(false);

  const tileCount = slots.reduce((total, tile) => (tile ? total + 1 : total), 0);
  const isExchanging = exchangeTileIds !== null;
  const exchangeCount = exchangeTileIds?.length ?? 0;
  // Rules §5: exchanging is only allowed while the bag still holds at least 7 tiles.
  const canStartExchange = isMyTurn && canStageMove && !hasTemporaryTiles && !isSubmitting && tileCount > 0 && tileBagCount >= 7;
  const canConfirmExchange = isMyTurn && !isSubmitting && exchangeCount > 0 && exchangeCount <= tileBagCount;

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, slotIndex: number, tile: Tile) => {
    if (!canStageMove) return;
    // While exchanging, don't drag — just capture click on release
    if (!isExchanging) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerStartRef.current = { x: event.clientX, y: event.clientY, slotIndex, tile };
      didDragRef.current = false;
    } else {
      pointerStartRef.current = { x: event.clientX, y: event.clientY, slotIndex, tile };
      didDragRef.current = false;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current;
    if (!start || isExchanging) return;
    if (!didDragRef.current && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) {
      didDragRef.current = true;
      setDraggedSlot(start.slotIndex);
      onStartTileDrag(start.tile, start.slotIndex, event.clientX, event.clientY);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>, tile: Tile) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const wasDragging = didDragRef.current;
    pointerStartRef.current = null;
    didDragRef.current = false;
    setDraggedSlot(null);

    if (wasDragging) {
      onFinishTileDrag(event.clientX, event.clientY);
    } else {
      if (canStageMove) {
        onSelectTile(tile);
      }
    }
  };

  const getDisplayLetter = (tile: Tile) => (
    isBlankLetter(tile.letter) ? designatedBlankLetters[tile.id] ?? tile.letter : tile.letter
  );

  return (
    <div className="game-control-deck mx-auto w-full max-w-none pointer-events-auto">

      {/* Compact High-Tech Gaming Console Dock */}
      <div className="game-control-layout relative flex w-full flex-col lg:flex-row items-center justify-center gap-1.5 sm:gap-2 lg:gap-4">
        {/* Specular Edge Highlight Trim */}
        <div aria-hidden="true" className="pedestal-top-glint absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/70 to-transparent pointer-events-none" />

        {/* LEFT / CENTER: 7-TILE RACK & POWER CARDS */}
        <div className="game-rack-module game-rack-center relative order-1 flex w-full max-w-full shrink-0 flex-col items-center gap-1.5 lg:w-[344px] lg:max-w-[344px] overflow-visible">
          {/* 7-Tile Stand: Row 2 */}
          <div className="order-2 w-full overflow-x-auto overflow-y-visible px-1 sm:px-0 flex justify-center hide-scrollbar scroll-smooth lg:overflow-visible pt-2 -mt-1 pb-1">
            <div
              ref={rackRef}
              className={`game-tile-tray relative flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl border px-2 py-1.5 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-1.5 min-h-[52px] sm:min-h-[56px] ${
                isExternalDragActive
                  ? 'border-amber-300/80 bg-amber-950/40 ring-2 ring-amber-300/40'
                  : 'border-amber-400/25 bg-[#09081a]/90 shadow-[inset_0_2px_8px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)]'
              } transition-all`}
            >
              {slots.map((tile, slotIndex) => {
                if (!tile) {
                  return (
                    <div
                      key={`slot-${slotIndex}`}
                      data-rack-slot={slotIndex}
                      aria-hidden="true"
                      className={`relative shrink-0 h-[44px] w-[38px] sm:h-[46px] sm:w-[42px] rounded-[10px] border border-indigo-950/70 bg-[#060516]/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.85)] transition-all sm:rounded-xl ${
                        isExternalDragActive
                          ? 'ring-1 ring-amber-400/40'
                          : ''
                      }`}
                    >
                      <span className="absolute inset-[6px] rounded-md border border-dashed border-amber-400/20" />
                    </div>
                  );
                }

                const isSelected = selectedTileId === tile.id;
                const displayLetter = getDisplayLetter(tile);
                const isDesignatedBlank = isBlankLetter(tile.letter) && Boolean(designatedBlankLetters[tile.id]);
                const isMarkedForExchange = exchangeTileIds?.includes(tile.id) ?? false;
                const isDragging = draggedSlot === slotIndex || (isExternalDragActive && selectedTileId === tile.id);
                return (
                  <div
                    key={`slot-${slotIndex}`}
                    data-rack-slot={slotIndex}
                    className="relative shrink-0 h-[44px] w-[38px] sm:h-[46px] sm:w-[42px]"
                  >
                    {/* Slot frame / seat behind tile */}
                    <div
                      aria-hidden="true"
                      className={`absolute inset-0 rounded-[10px] border border-indigo-950/70 bg-[#060516]/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.85)] transition-all sm:rounded-xl ${
                        isExternalDragActive
                          ? 'ring-1 ring-amber-400/40'
                          : ''
                      }`}
                    >
                      <span className="absolute inset-[6px] rounded-md border border-dashed border-amber-400/20" />
                    </div>

                    {/* Tile Button with GPU CSS transforms */}
                    <button
                      key={tile.id}
                      data-rack-slot={slotIndex}
                      data-rack-tile-id={tile.id}
                      onPointerDown={(event) => handlePointerDown(event, slotIndex, tile)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={(event) => handlePointerUp(event, tile)}
                      disabled={!canStageMove}
                      aria-pressed={isExchanging ? isMarkedForExchange : undefined}
                      className={`tile-face group absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[10px] border border-amber-100/80 font-sans select-none touch-none overflow-hidden sm:rounded-xl active:scale-95 ${
                        isDragging
                          ? 'z-20 scale-105 -translate-y-2.5 opacity-40 shadow-2xl cursor-grabbing transition-none'
                          : isMarkedForExchange
                          ? '-translate-y-2.5 border-2 border-amber-100 shadow-lg shadow-amber-500/40 ring-4 ring-amber-300/70 cursor-pointer transition-transform duration-100'
                          : isSelected
                          ? '-translate-y-2.5 border-2 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)] ring-4 ring-amber-400/50 transition-transform duration-100'
                          : canStageMove
                          ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_6px_12px_rgba(74,34,8,0.48),0_2px_4px_rgba(34,24,20,0.35)] hover:-translate-y-1 hover:brightness-110 cursor-pointer transition-transform duration-100'
                          : 'opacity-65 cursor-not-allowed shadow-md transition-none'
                      }`}
                    >
                      {/* 3D Specular Top Bevel Glass Highlight */}
                      <div className="absolute inset-x-1 top-0.5 h-[36%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10" />

                      {/* Letter / Wildcard Star */}
                      {isBlankLetter(tile.letter) && !isDesignatedBlank ? (
                        <div className="relative z-20 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="tile-blank-star w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                            <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
                          </svg>
                        </div>
                      ) : (
                        <span className="tile-letter tile-letter-orange relative z-20 text-[26px] sm:text-[28px] leading-none font-maple">
                          {displayLetter}
                        </span>
                      )}

                      {/* Value Badge */}
                      <span className="tile-score-blue absolute bottom-0.5 right-1 z-20 text-[9.5px] font-maple sm:bottom-1 sm:right-1.5 sm:text-[11px] leading-none">
                        {tile.value}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Power Cards Bay: Row 1 (Top) */}
          {powerCardSlot && (
            <div className="game-power-strip order-1 flex w-full max-w-full items-center justify-center">
              {powerCardSlot}
            </div>
          )}
        </div>

        {/* RIGHT / BOTTOM: ACTION CONTROLS */}
        {/* DESKTOP VIEW (>= 1024px): 2 BALANCED ROWS WITH FULL TEXT LABELS */}
        <div className="game-actions-container hidden lg:flex order-2 w-[320px] shrink-0 flex-col gap-1.5 select-none">
          {/* Desktop Row 1: Utility Controls (Recall, Shuffle, Swap) */}
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {isExchanging ? (
              <div className="col-span-3 flex items-center justify-between gap-2 px-3 py-1 bg-gradient-to-r from-[#2a0c18]/95 via-[#18091e]/95 to-[#0e0a24]/95 border border-rose-500/50 rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.6),0_0_14px_rgba(244,63,94,0.25),inset_0_1px_1px_rgba(255,255,255,0.15)] relative overflow-hidden backdrop-blur-xl">
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                <motion.button
                  onClick={onCancelExchange}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  className="group relative flex h-[32px] items-center gap-1.5 px-3 rounded-lg font-black text-xs bg-gradient-to-b from-rose-700 to-rose-900 text-white hover:from-rose-600 hover:to-rose-800 border border-rose-400/60 cursor-pointer shadow-[0_2px_8px_rgba(244,63,94,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all overflow-hidden"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                  <X className="w-3.5 h-3.5 text-rose-200 relative z-10" />
                  <span className="relative z-10 uppercase tracking-wider text-[11px]">Cancel</span>
                </motion.button>
                <span className="text-[11px] text-amber-200/90 font-bold truncate tracking-wide relative z-10">
                  {exchangeCount > tileBagCount ? `Only ${tileBagCount} in bag` : 'Pick tiles to swap'}
                </span>
              </div>
            ) : (
              <>
                {/* Recall */}
                <motion.button
                  onClick={onCancelMove}
                  disabled={!hasTemporaryTiles || isSubmitting}
                  whileHover={hasTemporaryTiles ? { scale: 1.03 } : undefined}
                  whileTap={hasTemporaryTiles ? { scale: 0.96 } : undefined}
                  className={`group relative flex h-[36px] sm:h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs transition-all select-none overflow-hidden ${
                    hasTemporaryTiles
                      ? 'bg-gradient-to-b from-[#3a1024]/95 via-[#240b17]/95 to-[#15060e]/95 text-rose-200 hover:text-white border border-rose-400/70 hover:border-rose-300 shadow-[0_4px_14px_rgba(0,0,0,0.6),0_0_16px_rgba(244,63,94,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] hover:shadow-[0_0_24px_rgba(244,63,94,0.55),inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer'
                      : 'bg-gradient-to-b from-[#101228]/70 to-[#080914]/85 text-slate-500/70 border border-white/[0.06] shadow-inner cursor-not-allowed'
                  }`}
                  title="Recall placed tiles to rack"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                  <RotateCcw className={`w-3.5 h-3.5 relative z-10 transition-transform group-hover:-rotate-45 ${hasTemporaryTiles ? 'text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]' : 'text-slate-600'}`} />
                  <span className="relative z-10 uppercase tracking-wider text-[11px]">
                    Recall{hasTemporaryTiles ? ` (${stagedTileCount})` : ''}
                  </span>
                </motion.button>

                {/* Shuffle */}
                <motion.button
                  onClick={onShuffleRack}
                  disabled={tileCount < 2 || isSubmitting}
                  whileHover={tileCount >= 2 && !isSubmitting ? { scale: 1.03 } : undefined}
                  whileTap={tileCount >= 2 && !isSubmitting ? { scale: 0.96 } : undefined}
                  className="group relative flex h-[36px] sm:h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs text-amber-200 hover:text-white bg-gradient-to-b from-[#2a1d08]/90 via-[#1c1305]/95 to-[#0e0a02]/95 hover:from-[#3a280c] hover:to-[#160f04] border border-amber-400/50 hover:border-amber-300 disabled:text-slate-600 disabled:bg-gradient-to-b disabled:from-[#101228]/70 disabled:to-[#080914]/85 disabled:border-white/[0.06] disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(0,0,0,0.6),0_0_14px_rgba(245,158,11,0.25),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_0_22px_rgba(245,158,11,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all cursor-pointer overflow-hidden"
                  title="Shuffle rack tiles"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                  <Shuffle className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)] relative z-10 group-hover:scale-110 transition-transform" />
                  <span className="relative z-10 uppercase tracking-wider text-[11px]">Shuffle</span>
                </motion.button>

                {/* Swap */}
                <motion.button
                  onClick={onStartExchange}
                  disabled={!canStartExchange}
                  whileHover={canStartExchange ? { scale: 1.03 } : undefined}
                  whileTap={canStartExchange ? { scale: 0.96 } : undefined}
                  className="group relative flex h-[36px] sm:h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs text-indigo-200 hover:text-white bg-gradient-to-b from-[#161c48]/90 via-[#0e1232]/95 to-[#07091c]/95 hover:from-[#202868] hover:to-[#121740] border border-indigo-400/50 hover:border-indigo-300 disabled:text-slate-600 disabled:bg-gradient-to-b disabled:from-[#101228]/70 disabled:to-[#080914]/85 disabled:border-white/[0.06] disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(0,0,0,0.6),0_0_14px_rgba(99,102,241,0.25),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_0_22px_rgba(99,102,241,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all cursor-pointer overflow-hidden"
                  title={tileBagCount < 7 ? 'Exchanging needs at least 7 tiles in the bag' : 'Swap tiles with the bag (uses your turn)'}
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.8)] relative z-10 group-hover:scale-110 transition-transform" />
                  <span className="relative z-10 uppercase tracking-wider text-[11px]">Swap</span>
                </motion.button>
              </>
            )}
          </div>

          {/* Desktop Row 2: Turn Actions (CONFIRM / PLAY MOVE & Pass) */}
          <div className="w-full">
            {isExchanging ? (
              <motion.button
                onClick={onConfirmExchange}
                disabled={!canConfirmExchange}
                whileHover={canConfirmExchange ? { scale: 1.02 } : undefined}
                whileTap={canConfirmExchange ? { scale: 0.97 } : undefined}
                className={`group relative flex w-full h-[40px] sm:h-[42px] items-center justify-center gap-2 rounded-xl font-black text-xs sm:text-sm transition-all overflow-hidden ${
                  canConfirmExchange
                    ? 'bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 text-white shadow-[0_0_22px_rgba(99,102,241,0.6),0_4px_16px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-indigo-200 hover:brightness-110 cursor-pointer'
                    : 'bg-gradient-to-b from-[#101228]/70 to-[#080914]/85 text-slate-600 border border-white/[0.06] cursor-not-allowed'
                }`}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <ArrowLeftRight className="w-4 h-4 relative z-10" />
                <span className="relative z-10 uppercase tracking-wider font-black">
                  {isSubmitting ? 'Swapping...' : `Confirm Swap (${exchangeCount} Tiles)`}
                </span>
              </motion.button>
            ) : passConfirming ? (
              <div className="grid grid-cols-[1fr_2fr] gap-1.5 w-full">
                {/* Cancel Pass */}
                <motion.button
                  onClick={() => setPassConfirming(false)}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="group relative flex h-[40px] sm:h-[42px] items-center justify-center rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider bg-gradient-to-b from-[#181a3e]/90 to-[#0d0f28]/95 hover:from-[#25285c] hover:to-[#141738] text-slate-300 hover:text-white border border-indigo-400/30 hover:border-amber-400/50 cursor-pointer transition-all shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                  <span className="relative z-10">Cancel</span>
                </motion.button>

                {/* Confirm Pass Button */}
                <motion.button
                  onClick={() => { setPassConfirming(false); onPassTurn(); }}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="group relative flex h-[40px] sm:h-[42px] items-center justify-center rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:brightness-110 text-white border border-rose-300 shadow-[0_0_22px_rgba(244,63,94,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer transition-all overflow-hidden"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                  <span className="relative z-10">{isSubmitting ? 'Passing...' : 'Confirm Pass'}</span>
                </motion.button>
              </div>
            ) : (
              <div className="grid grid-cols-[2fr_1fr] gap-1.5 w-full">
                {/* Primary Confirm / Play Move Button */}
                <motion.button
                  onClick={onConfirmMove}
                  disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                  whileHover={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 1.02 } : undefined}
                  whileTap={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 0.97 } : undefined}
                  className={`game-primary-action group relative flex h-[40px] sm:h-[42px] items-center justify-center gap-1.5 rounded-xl px-3 font-black text-xs sm:text-sm transition-all select-none overflow-hidden ${
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-slate-950 border-2 border-emerald-100 shadow-[0_0_28px_rgba(52,211,153,0.8),0_4px_16px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.9)] ring-2 ring-emerald-400/50 hover:brightness-110 cursor-pointer font-black'
                      : isMyTurn && hasTemporaryTiles
                      ? 'bg-gradient-to-r from-rose-950/90 via-[#260a14]/95 to-rose-950/90 text-rose-300 border border-rose-500/60 shadow-[0_0_14px_rgba(244,63,94,0.35),inset_0_1px_1px_rgba(255,255,255,0.12)] cursor-not-allowed'
                      : 'bg-gradient-to-b from-[#12142e]/70 to-[#080916]/85 text-slate-600 border border-white/[0.08] shadow-inner cursor-not-allowed'
                  }`}
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                  <Check className={`w-4 h-4 stroke-[3] relative z-10 ${isMyTurn && hasTemporaryTiles && placementValid === true ? 'text-slate-950' : 'text-slate-600'}`} />
                  <span className="tracking-wider uppercase font-black truncate relative z-10">
                    {isSubmitting
                      ? 'Submitting...'
                      : placementValid === true && estimatedScore !== undefined && estimatedScore > 0
                      ? `CONFIRM (+${estimatedScore})`
                      : 'CONFIRM MOVE'}
                  </span>
                </motion.button>

                {/* Pass Button */}
                <motion.button
                  onClick={() => setPassConfirming(true)}
                  disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
                  whileHover={isMyTurn && !hasTemporaryTiles ? { scale: 1.03 } : undefined}
                  whileTap={isMyTurn && !hasTemporaryTiles ? { scale: 0.96 } : undefined}
                  className={`group relative flex h-[40px] sm:h-[42px] items-center justify-center gap-1.5 rounded-xl font-black text-xs transition-all select-none overflow-hidden ${
                    isMyTurn && !hasTemporaryTiles
                      ? 'bg-gradient-to-b from-[#181a3e]/90 via-[#10122c]/95 to-[#0a0c20]/95 hover:from-[#25285c] hover:to-[#141738] text-slate-200 hover:text-white border border-indigo-400/30 hover:border-amber-400/60 shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] hover:shadow-[0_0_18px_rgba(245,158,11,0.3)] cursor-pointer'
                      : 'bg-gradient-to-b from-[#101228]/70 to-[#080914]/85 text-slate-600 border border-white/[0.06] shadow-inner cursor-not-allowed'
                  }`}
                  title="Pass your turn"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                  <SkipForward className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 relative z-10 transition-colors" />
                  <span className="relative z-10 uppercase tracking-wider text-[11px]">Pass</span>
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE VIEW (< 1024px): 1 ULTRA-SLEEK COMPACT ROW */}
        <div className="game-actions-container flex lg:hidden order-2 w-full max-w-[340px] sm:max-w-[360px] shrink-0 flex-col select-none">
          {isExchanging ? (
            <div className="grid grid-cols-[1fr_2fr] gap-1.5 w-full">
              {/* Cancel Exchange */}
              <motion.button
                onClick={onCancelExchange}
                disabled={isSubmitting}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="group relative flex h-[38px] items-center justify-center gap-1 px-2.5 rounded-xl font-black text-xs bg-gradient-to-b from-rose-700 to-rose-900 text-white hover:from-rose-600 hover:to-rose-800 border border-rose-400/60 cursor-pointer shadow-[0_2px_8px_rgba(244,63,94,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] overflow-hidden"
                title="Cancel Swap"
                aria-label="Cancel Swap"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <X className="w-4 h-4 text-rose-200 relative z-10" />
                <span className="relative z-10 uppercase tracking-wider">Cancel</span>
              </motion.button>

              {/* Confirm Exchange */}
              <motion.button
                onClick={onConfirmExchange}
                disabled={!canConfirmExchange}
                whileHover={canConfirmExchange ? { scale: 1.02 } : undefined}
                whileTap={canConfirmExchange ? { scale: 0.96 } : undefined}
                className={`group relative flex h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs transition-all overflow-hidden ${
                  canConfirmExchange
                    ? 'bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.6),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-indigo-200 cursor-pointer'
                    : 'bg-gradient-to-b from-[#101228]/70 to-[#080914]/85 text-slate-600 border border-white/[0.06] cursor-not-allowed'
                }`}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <ArrowLeftRight className="w-4 h-4 relative z-10" />
                <span className="relative z-10 uppercase tracking-wider font-black">
                  {isSubmitting ? 'Swapping...' : `Swap (${exchangeCount})`}
                </span>
              </motion.button>
            </div>
          ) : passConfirming ? (
            <div className="grid grid-cols-[1fr_2fr] gap-1.5 w-full">
              {/* Cancel Pass */}
              <motion.button
                onClick={() => setPassConfirming(false)}
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="group relative flex h-[38px] items-center justify-center gap-1 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-b from-[#181a3e]/90 to-[#0d0f28]/95 hover:from-[#25285c] hover:to-[#141738] text-slate-300 hover:text-white border border-indigo-400/30 cursor-pointer transition-all shadow-sm overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                <X className="w-4 h-4 text-slate-400 relative z-10" />
                <span className="relative z-10">Cancel</span>
              </motion.button>

              {/* Confirm Pass Button */}
              <motion.button
                onClick={() => { setPassConfirming(false); onPassTurn(); }}
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="group relative flex h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:brightness-110 text-white border border-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.65),inset_0_1px_1px_rgba(255,255,255,0.3)] cursor-pointer transition-all overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                <SkipForward className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{isSubmitting ? 'Passing...' : 'Confirm Pass'}</span>
              </motion.button>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1.8fr] gap-1.5 w-full">
              {/* 1. Recall */}
              <motion.button
                onClick={onCancelMove}
                disabled={!hasTemporaryTiles || isSubmitting}
                whileHover={hasTemporaryTiles ? { scale: 1.05 } : undefined}
                whileTap={hasTemporaryTiles ? { scale: 0.95 } : undefined}
                className={`group relative flex h-[38px] items-center justify-center gap-1 rounded-xl transition-all select-none overflow-hidden ${
                  hasTemporaryTiles
                    ? 'bg-gradient-to-b from-[#3a1024]/95 via-[#240b17]/95 to-[#15060e]/95 text-rose-200 hover:text-white border border-rose-400/70 shadow-[0_4px_12px_rgba(0,0,0,0.6),0_0_14px_rgba(244,63,94,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] cursor-pointer'
                    : 'bg-gradient-to-b from-[#101228]/70 to-[#080914]/85 text-slate-600 border border-white/[0.06] cursor-not-allowed'
                }`}
                title={`Recall placed tiles${hasTemporaryTiles ? ` (${stagedTileCount})` : ''}`}
                aria-label="Recall placed tiles"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                <RotateCcw className={`w-4 h-4 relative z-10 ${hasTemporaryTiles ? 'text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]' : 'text-slate-600'}`} />
                {hasTemporaryTiles && (
                  <span className="text-[10px] font-black leading-none text-rose-200 relative z-10">{stagedTileCount}</span>
                )}
              </motion.button>

              {/* 2. Shuffle */}
              <motion.button
                onClick={onShuffleRack}
                disabled={tileCount < 2 || isSubmitting}
                whileHover={tileCount >= 2 && !isSubmitting ? { scale: 1.05 } : undefined}
                whileTap={tileCount >= 2 && !isSubmitting ? { scale: 0.95 } : undefined}
                className="group relative flex h-[38px] items-center justify-center rounded-xl text-amber-200 hover:text-white bg-gradient-to-b from-[#2a1d08]/90 via-[#1c1305]/95 to-[#0e0a02]/95 border border-amber-400/50 hover:border-amber-300 disabled:text-slate-600 disabled:bg-gradient-to-b disabled:from-[#101228]/70 disabled:to-[#080914]/85 disabled:border-white/[0.06] disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(0,0,0,0.6),0_0_12px_rgba(245,158,11,0.2),inset_0_1px_1px_rgba(255,255,255,0.18)] transition-all cursor-pointer overflow-hidden"
                title="Shuffle rack tiles"
                aria-label="Shuffle rack tiles"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                <Shuffle className="w-4 h-4 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)] relative z-10" />
              </motion.button>

              {/* 3. Swap */}
              <motion.button
                onClick={onStartExchange}
                disabled={!canStartExchange}
                whileHover={canStartExchange ? { scale: 1.05 } : undefined}
                whileTap={canStartExchange ? { scale: 0.95 } : undefined}
                className="group relative flex h-[38px] items-center justify-center rounded-xl text-indigo-200 hover:text-white bg-gradient-to-b from-[#161c48]/90 via-[#0e1232]/95 to-[#07091c]/95 border border-indigo-400/50 hover:border-indigo-300 disabled:text-slate-600 disabled:bg-gradient-to-b disabled:from-[#101228]/70 disabled:to-[#080914]/85 disabled:border-white/[0.06] disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(0,0,0,0.6),0_0_12px_rgba(99,102,241,0.2),inset_0_1px_1px_rgba(255,255,255,0.18)] transition-all cursor-pointer overflow-hidden"
                title={tileBagCount < 7 ? 'Exchanging needs at least 7 tiles in bag' : 'Swap tiles with bag'}
                aria-label="Swap tiles with bag"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                <ArrowLeftRight className="w-4 h-4 text-indigo-300 drop-shadow-[0_0_6px_rgba(129,140,248,0.8)] relative z-10" />
              </motion.button>

              {/* 4. Pass */}
              <motion.button
                onClick={() => setPassConfirming(true)}
                disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
                whileHover={isMyTurn && !hasTemporaryTiles ? { scale: 1.05 } : undefined}
                whileTap={isMyTurn && !hasTemporaryTiles ? { scale: 0.95 } : undefined}
                className={`group relative flex h-[38px] items-center justify-center rounded-xl transition-all select-none overflow-hidden ${
                  isMyTurn && !hasTemporaryTiles
                    ? 'bg-gradient-to-b from-[#181a3e]/90 via-[#10122c]/95 to-[#0a0c20]/95 text-slate-200 hover:text-white border border-indigo-400/30 hover:border-amber-400/60 shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] cursor-pointer'
                    : 'bg-gradient-to-b from-[#101228]/70 to-[#080914]/85 text-slate-600 border border-white/[0.06] cursor-not-allowed'
                }`}
                title="Pass your turn"
                aria-label="Pass your turn"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                <SkipForward className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-300 relative z-10" />
              </motion.button>

              {/* 5. Primary Confirm / Play Move Button */}
              <motion.button
                onClick={onConfirmMove}
                disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                whileHover={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 1.03 } : undefined}
                whileTap={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 0.97 } : undefined}
                className={`game-primary-action group relative flex h-[38px] items-center justify-center gap-1 rounded-xl px-2 font-black text-xs transition-all select-none overflow-hidden ${
                  isMyTurn && hasTemporaryTiles && placementValid === true
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-slate-950 border-2 border-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.8),0_4px_14px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.9)] ring-2 ring-emerald-400/50 hover:brightness-110 cursor-pointer font-black'
                    : isMyTurn && hasTemporaryTiles
                    ? 'bg-gradient-to-r from-rose-950/90 via-[#260a14]/95 to-rose-950/90 text-rose-300 border border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.35)] cursor-not-allowed'
                    : 'bg-gradient-to-b from-[#12142e]/70 to-[#080916]/85 text-slate-600 border border-white/[0.08] cursor-not-allowed'
                }`}
                title={
                  placementValid === true && estimatedScore !== undefined && estimatedScore > 0
                    ? `Play word (+${estimatedScore} pts)`
                    : 'Play placed tiles'
                }
                aria-label="Confirm move"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <Check className={`w-4 h-4 stroke-[3] relative z-10 ${isMyTurn && hasTemporaryTiles && placementValid === true ? 'text-slate-950' : 'text-slate-600'}`} />
                {placementValid === true && estimatedScore !== undefined && estimatedScore > 0 && (
                  <span className="text-xs font-black tracking-tight text-slate-950 relative z-10">
                    +{estimatedScore}
                  </span>
                )}
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
