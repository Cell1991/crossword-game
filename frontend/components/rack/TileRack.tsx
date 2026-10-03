'use client';

import React, { memo, useRef, useState } from 'react';
import { Tile } from '@/lib/types';
import { isBlankLetter } from '@/lib/tiles';
import { moveFixedElement } from '@/lib/dom';
import { RotateCcw, Check, SkipForward, Shuffle, ArrowLeftRight, X } from 'lucide-react';
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
  /** Captured score for the float-away exit animation when move is confirmed. */
  const [floatingExitScore, setFloatingExitScore] = useState<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; slotIndex: number; tile: Tile } | null>(null);
  const didDragRef = useRef(false);

  const tileCount = slots.reduce((total, tile) => (tile ? total + 1 : total), 0);
  const isExchanging = exchangeTileIds !== null;
  const exchangeCount = exchangeTileIds?.length ?? 0;
  // Rules §5: exchanging is only allowed while the bag still holds at least 7 tiles.
  const canStartExchange = isMyTurn && canStageMove && !hasTemporaryTiles && !isSubmitting && tileCount > 0 && tileBagCount >= 7;
  const canConfirmExchange = isMyTurn && !isSubmitting && exchangeCount > 0 && exchangeCount <= tileBagCount;

  const handleConfirmMove = () => {
    if (estimatedScore !== undefined && estimatedScore > 0) {
      setFloatingExitScore(estimatedScore);
      setTimeout(() => {
        setFloatingExitScore(null);
      }, 1100);
    }
    onConfirmMove();
  };

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
      <div className="game-control-layout relative flex w-full flex-col lg:flex-row items-center justify-center gap-1.5 sm:gap-2 lg:gap-4 overflow-visible">
        {/* Floating Estimated Score Pill Centered Above Deck */}
        {floatingExitScore !== null ? (
          <div
            key={`floating-score-exit-${floatingExitScore}`}
            className="absolute -top-12 sm:-top-14 left-1/2 z-30 pointer-events-none whitespace-nowrap animate-score-pill-float-away"
          >
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-gradient-to-b from-[#3a250a]/98 via-[#221505]/98 to-[#0e0802]/98 border-2 border-amber-200 shadow-[0_0_32px_rgba(251,191,36,0.9),0_8px_20px_rgba(0,0,0,0.95),inset_0_1.5px_1px_rgba(255,255,255,0.75)] text-[#fffbeb] font-black text-sm sm:text-base md:text-lg tracking-wider leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              +{floatingExitScore} PTS
            </span>
          </div>
        ) : isMyTurn && hasTemporaryTiles && placementValid === true && estimatedScore !== undefined && estimatedScore > 0 ? (
          <div className="absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap transition-all duration-200">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-gradient-to-b from-[#2e1d08]/98 via-[#1a1004]/98 to-[#0b0702]/98 border-2 border-amber-300 shadow-[0_0_26px_rgba(245,158,11,0.75),0_6px_16px_rgba(0,0,0,0.9),inset_0_1.5px_1px_rgba(255,255,255,0.65)] text-[#fef08a] font-black text-sm sm:text-base md:text-lg tracking-wider leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              +{estimatedScore} PTS
            </span>
          </div>
        ) : null}

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
                      className={`tile-face group absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[10px] border border-amber-200/90 font-sans select-none touch-none overflow-hidden sm:rounded-xl active:scale-95 transition-all ${
                        isDragging
                          ? 'z-20 scale-105 -translate-y-2.5 opacity-40 shadow-2xl cursor-grabbing transition-none'
                          : isMarkedForExchange
                          ? '-translate-y-2.5 border-2 border-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.7),inset_0_2px_1px_rgba(255,255,255,0.9)] ring-4 ring-amber-300/70 cursor-pointer duration-100'
                          : isSelected
                          ? '-translate-y-2.5 border-2 border-cyan-300 shadow-[0_0_24px_rgba(56,189,248,0.9),inset_0_2px_1px_rgba(255,255,255,0.9)] ring-4 ring-sky-400/80 duration-100'
                          : canStageMove
                          ? 'hover:-translate-y-1 hover:brightness-110 cursor-pointer duration-100'
                          : 'opacity-65 cursor-not-allowed shadow-md transition-none'
                      }`}
                    >
                      {/* Top Edge Subtle Golden/Cyan Highlight */}
                      <div className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent ${isSelected ? 'via-cyan-200/90' : 'via-amber-100/60'} to-transparent pointer-events-none z-10`} />

                      {/* Letter / Wildcard Star */}
                      {isBlankLetter(tile.letter) && !isDesignatedBlank ? (
                        <div className="relative z-20 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="tile-blank-star w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                            <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
                          </svg>
                        </div>
                      ) : (
                        <span
                          className={`tile-letter tile-letter-orange relative z-20 text-[26px] sm:text-[28px] leading-none font-maple inline-block ${
                            displayLetter === 'W'
                              ? 'scale-x-90 -translate-x-[0.5px]'
                              : displayLetter === 'M'
                              ? 'scale-x-95'
                              : ''
                          }`}
                        >
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
              <div className="col-span-3 flex items-center justify-between gap-2 px-3 py-1 bg-gradient-to-r from-[#220b16]/95 via-[#130b20]/95 to-[#0a0b1c]/95 border border-red-500/30 rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.6),0_0_12px_rgba(220,38,38,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)] relative overflow-hidden backdrop-blur-xl">
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                <button
                  type="button"
                  onClick={onCancelExchange}
                  disabled={isSubmitting}
                  className="game-btn-base game-btn-cancel flex h-[32px] items-center gap-1.5 px-3 rounded-lg font-black text-xs cursor-pointer"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                  <X className="w-3.5 h-3.5 text-red-100 relative z-10 stroke-[2.5]" />
                  <span className="relative z-10 uppercase tracking-wider text-[11px] text-white font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">Cancel</span>
                </button>
                <span className="text-[11px] text-amber-200/90 font-bold truncate tracking-wide relative z-10">
                  {exchangeCount > tileBagCount ? `Only ${tileBagCount} in bag` : 'Pick tiles to swap'}
                </span>
              </div>
            ) : (
              <>
                {/* Recall */}
                <button
                  type="button"
                  onClick={onCancelMove}
                  disabled={!hasTemporaryTiles || isSubmitting}
                  className={`game-btn-base group flex h-[36px] sm:h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs ${
                    hasTemporaryTiles
                      ? 'game-btn-recall-active cursor-pointer'
                      : 'game-btn-dormant cursor-not-allowed opacity-70'
                  }`}
                  title="Recall placed tiles to rack"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                  <RotateCcw className={`w-4 h-4 relative z-10 transition-transform group-hover:-rotate-45 ${hasTemporaryTiles ? 'text-amber-100 stroke-[3] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' : 'text-slate-400 stroke-[2.5]'}`} />
                  <span className={`relative z-10 uppercase tracking-wider text-[11px] font-black ${hasTemporaryTiles ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]' : 'text-slate-300'}`}>
                    Recall{hasTemporaryTiles ? ` (${stagedTileCount})` : ''}
                  </span>
                </button>

                {/* Shuffle */}
                <button
                  type="button"
                  onClick={onShuffleRack}
                  disabled={tileCount < 2 || isSubmitting}
                  className={`game-btn-base group flex h-[36px] sm:h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs ${
                    tileCount >= 2 && !isSubmitting
                      ? 'game-btn-shuffle cursor-pointer'
                      : 'game-btn-dormant cursor-not-allowed opacity-70'
                  }`}
                  title="Shuffle rack tiles"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                  <Shuffle className={`w-4 h-4 relative z-10 group-hover:scale-110 transition-transform ${tileCount >= 2 && !isSubmitting ? 'text-amber-100 stroke-[3] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' : 'text-slate-400 stroke-[2.5]'}`} />
                  <span className={`relative z-10 uppercase tracking-wider text-[11px] font-black ${tileCount >= 2 && !isSubmitting ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]' : 'text-slate-300'}`}>
                    Shuffle
                  </span>
                </button>

                {/* Swap */}
                <button
                  type="button"
                  onClick={onStartExchange}
                  disabled={!canStartExchange}
                  className={`game-btn-base group flex h-[36px] sm:h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs ${
                    canStartExchange
                      ? 'game-btn-swap cursor-pointer'
                      : 'game-btn-dormant cursor-not-allowed opacity-70'
                  }`}
                  title={tileBagCount < 7 ? 'Exchanging needs at least 7 tiles in the bag' : 'Swap tiles with the bag (uses your turn)'}
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                  <ArrowLeftRight className={`w-4 h-4 relative z-10 group-hover:scale-110 transition-transform ${canStartExchange ? 'text-sky-100 stroke-[3] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' : 'text-slate-400 stroke-[2.5]'}`} />
                  <span className={`relative z-10 uppercase tracking-wider text-[11px] font-black ${canStartExchange ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]' : 'text-slate-300'}`}>
                    Swap
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Desktop Row 2: Turn Actions (CONFIRM / PLAY MOVE & Pass) */}
          <div className="w-full">
            {isExchanging ? (
              <button
                type="button"
                onClick={onConfirmExchange}
                disabled={!canConfirmExchange}
                className={`game-btn-base group flex w-full h-[40px] sm:h-[42px] items-center justify-center gap-2 rounded-xl font-black text-xs sm:text-sm ${
                  canConfirmExchange
                    ? 'game-btn-swap cursor-pointer'
                    : 'game-btn-dormant cursor-not-allowed opacity-70'
                }`}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <ArrowLeftRight className="w-4 h-4 text-sky-200 stroke-[3] relative z-10" />
                <span className="relative z-10 uppercase tracking-wider font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                  {isSubmitting ? 'Swapping...' : `Confirm Swap (${exchangeCount} Tiles)`}
                </span>
              </button>
            ) : passConfirming ? (
              <div className="grid grid-cols-[1fr_2fr] gap-1.5 w-full">
                {/* Cancel Pass */}
                <button
                  type="button"
                  onClick={() => setPassConfirming(false)}
                  disabled={isSubmitting}
                  className="game-btn-base flex h-[40px] sm:h-[42px] items-center justify-center rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider game-btn-dormant hover:border-indigo-400/40 cursor-pointer"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                  <span className="relative z-10 text-slate-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">Cancel</span>
                </button>

                {/* Confirm Pass Button */}
                <button
                  type="button"
                  onClick={() => { setPassConfirming(false); onPassTurn(); }}
                  disabled={isSubmitting}
                  className="game-btn-base flex h-[40px] sm:h-[42px] items-center justify-center rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider bg-gradient-to-b from-[#dc2626] via-[#b91c1c] to-[#7f1d1d] hover:brightness-110 text-white border-2 border-rose-300 shadow-[0_0_22px_rgba(239,68,68,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                  <span className="relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">{isSubmitting ? 'Passing...' : 'Confirm Pass'}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-[2fr_1fr] gap-1.5 w-full">
                {/* Primary Confirm / Play Move Button */}
                <button
                  type="button"
                  onClick={handleConfirmMove}
                  disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                  className={`game-primary-action game-btn-base group flex h-[40px] sm:h-[42px] items-center justify-center gap-2 rounded-xl px-3 font-black text-xs sm:text-sm ${
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'game-btn-play-ready cursor-pointer'
                      : isMyTurn && hasTemporaryTiles
                      ? 'game-btn-play-invalid cursor-not-allowed'
                      : 'game-btn-dormant cursor-not-allowed opacity-70'
                  }`}
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                  {isMyTurn && hasTemporaryTiles && placementValid === true ? (
                    <Check className="w-5 h-5 stroke-[3.5] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] relative z-10 shrink-0" />
                  ) : isMyTurn && hasTemporaryTiles ? (
                    <X className="w-5 h-5 stroke-[3.5] text-rose-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] relative z-10 shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[2.5] text-slate-400 relative z-10 shrink-0" />
                  )}
                  <span className={`tracking-wider uppercase font-black truncate relative z-10 ${
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'text-white drop-shadow-[0_1px_0_#000] drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
                      : isMyTurn && hasTemporaryTiles
                      ? 'text-rose-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]'
                      : 'text-slate-300'
                  }`}>
                    {isSubmitting
                      ? 'Submitting...'
                      : isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'PLAY'
                      : isMyTurn && hasTemporaryTiles
                      ? 'INVALID WORD'
                      : 'PLAY'}
                  </span>
                </button>

                {/* Pass Button */}
                <button
                  type="button"
                  onClick={() => setPassConfirming(true)}
                  disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
                  className={`game-btn-base group flex h-[40px] sm:h-[42px] items-center justify-center gap-1.5 rounded-xl font-black text-xs ${
                    isMyTurn && !hasTemporaryTiles
                      ? 'game-btn-pass cursor-pointer'
                      : 'game-btn-dormant cursor-not-allowed opacity-70'
                  }`}
                  title="Pass your turn"
                >
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                  <SkipForward className={`w-4 h-4 relative z-10 transition-colors ${isMyTurn && !hasTemporaryTiles ? 'text-amber-200 stroke-[3] drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]' : 'text-slate-400 stroke-[2.5]'}`} />
                  <span className={`relative z-10 uppercase tracking-wider text-[11px] font-black ${isMyTurn && !hasTemporaryTiles ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]' : 'text-slate-300'}`}>
                    Pass
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE VIEW (< 1024px): 1 ULTRA-SLEEK COMPACT ROW */}
        <div className="game-actions-container flex lg:hidden order-2 w-full max-w-[340px] sm:max-w-[360px] shrink-0 flex-col select-none">
          {isExchanging ? (
            <div className="grid grid-cols-[1fr_2fr] gap-1.5 w-full">
              {/* Cancel Exchange */}
              <button
                type="button"
                onClick={onCancelExchange}
                disabled={isSubmitting}
                className="game-btn-base game-btn-cancel flex h-[38px] items-center justify-center gap-1.5 px-2.5 rounded-xl font-black text-xs cursor-pointer"
                title="Cancel Swap"
                aria-label="Cancel Swap"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <X className="w-4 h-4 text-red-100 relative z-10 stroke-[2.5]" />
                <span className="relative z-10 uppercase tracking-wider text-white font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">Cancel</span>
              </button>

              {/* Confirm Exchange */}
              <button
                type="button"
                onClick={onConfirmExchange}
                disabled={!canConfirmExchange}
                className={`game-btn-base flex h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs ${
                  canConfirmExchange
                    ? 'game-btn-swap cursor-pointer'
                    : 'game-btn-dormant cursor-not-allowed opacity-70'
                }`}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                <ArrowLeftRight className="w-4 h-4 relative z-10" />
                <span className="relative z-10 uppercase tracking-wider font-black">
                  {isSubmitting ? 'Swapping...' : `Swap (${exchangeCount})`}
                </span>
              </button>
            </div>
          ) : passConfirming ? (
            <div className="grid grid-cols-[1fr_2fr] gap-1.5 w-full">
              {/* Cancel Pass */}
              <button
                type="button"
                onClick={() => setPassConfirming(false)}
                disabled={isSubmitting}
                className="game-btn-base flex h-[38px] items-center justify-center gap-1 rounded-xl text-xs font-black uppercase tracking-wider game-btn-dormant cursor-pointer"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                <X className="w-4 h-4 text-slate-300 relative z-10" />
                <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">Cancel</span>
              </button>

              {/* Confirm Pass Button */}
              <button
                type="button"
                onClick={() => { setPassConfirming(false); onPassTurn(); }}
                disabled={isSubmitting}
                className="game-btn-base flex h-[38px] items-center justify-center gap-1.5 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-b from-[#dc2626] via-[#b91c1c] to-[#7f1d1d] hover:brightness-110 text-white border-2 border-rose-300 shadow-[0_0_20px_rgba(239,68,68,0.7),inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                <SkipForward className="w-4 h-4 text-white relative z-10" />
                <span className="relative z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">{isSubmitting ? 'Passing...' : 'Confirm Pass'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1.8fr] gap-1.5 w-full">
              {/* 1. Recall */}
              <button
                type="button"
                onClick={onCancelMove}
                disabled={!hasTemporaryTiles || isSubmitting}
                className={`game-btn-base group flex h-[38px] items-center justify-center gap-1 rounded-xl ${
                  hasTemporaryTiles
                    ? 'game-btn-recall-active cursor-pointer'
                    : 'game-btn-dormant cursor-not-allowed opacity-70'
                }`}
                title={`Recall placed tiles${hasTemporaryTiles ? ` (${stagedTileCount})` : ''}`}
                aria-label="Recall placed tiles"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                <RotateCcw className={`w-4 h-4 relative z-10 ${hasTemporaryTiles ? 'text-amber-100 stroke-[3] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' : 'text-slate-400 stroke-[2.5]'}`} />
                {hasTemporaryTiles && (
                  <span className="text-[10px] font-black leading-none text-white relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">{stagedTileCount}</span>
                )}
              </button>

              {/* 2. Shuffle */}
              <button
                type="button"
                onClick={onShuffleRack}
                disabled={tileCount < 2 || isSubmitting}
                className={`game-btn-base group flex h-[38px] items-center justify-center rounded-xl ${
                  tileCount >= 2 && !isSubmitting
                    ? 'game-btn-shuffle cursor-pointer'
                    : 'game-btn-dormant cursor-not-allowed opacity-70'
                }`}
                title="Shuffle rack tiles"
                aria-label="Shuffle rack tiles"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                <Shuffle className={`w-4 h-4 relative z-10 ${tileCount >= 2 && !isSubmitting ? 'text-amber-100 stroke-[3] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' : 'text-slate-400 stroke-[2.5]'}`} />
              </button>

              {/* 3. Swap */}
              <button
                type="button"
                onClick={onStartExchange}
                disabled={!canStartExchange}
                className={`game-btn-base group flex h-[38px] items-center justify-center rounded-xl ${
                  canStartExchange
                    ? 'game-btn-swap cursor-pointer'
                    : 'game-btn-dormant cursor-not-allowed opacity-70'
                }`}
                title={tileBagCount < 7 ? 'Exchanging needs at least 7 tiles in bag' : 'Swap tiles with bag'}
                aria-label="Swap tiles with bag"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
                <ArrowLeftRight className={`w-4 h-4 relative z-10 ${canStartExchange ? 'text-sky-100 stroke-[3] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' : 'text-slate-400 stroke-[2.5]'}`} />
              </button>

              {/* 4. Pass */}
              <button
                type="button"
                onClick={() => setPassConfirming(true)}
                disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
                className={`game-btn-base group flex h-[38px] items-center justify-center rounded-xl ${
                  isMyTurn && !hasTemporaryTiles
                    ? 'game-btn-pass cursor-pointer'
                    : 'game-btn-dormant cursor-not-allowed opacity-70'
                }`}
                title="Pass your turn"
                aria-label="Pass your turn"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/12 to-transparent pointer-events-none" />
                <SkipForward className={`w-3.5 h-3.5 relative z-10 ${isMyTurn && !hasTemporaryTiles ? 'text-amber-200 stroke-[3] drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]' : 'text-slate-400 stroke-[2.5]'}`} />
              </button>

              {/* 5. Primary Confirm / Play Move Button */}
              <button
                type="button"
                onClick={handleConfirmMove}
                disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                className={`game-primary-action game-btn-base group flex h-[38px] items-center justify-center gap-1 rounded-xl px-2 font-black text-xs ${
                  isMyTurn && hasTemporaryTiles && placementValid === true
                    ? 'game-btn-play-ready cursor-pointer'
                    : isMyTurn && hasTemporaryTiles
                    ? 'game-btn-play-invalid cursor-not-allowed'
                    : 'game-btn-dormant cursor-not-allowed opacity-70'
                }`}
                title={
                  placementValid === true && estimatedScore !== undefined && estimatedScore > 0
                    ? `Play word (+${estimatedScore} pts)`
                    : 'Play placed tiles'
                }
                aria-label="Confirm move"
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                {isMyTurn && hasTemporaryTiles && placementValid === true ? (
                  <Check className="w-4 h-4 stroke-[3.5] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] relative z-10 shrink-0" />
                ) : isMyTurn && hasTemporaryTiles ? (
                  <X className="w-4 h-4 stroke-[3.5] text-rose-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] relative z-10 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 stroke-[2.5] text-slate-400 relative z-10 shrink-0" />
                )}
                <span className={`text-[10px] font-black uppercase tracking-wider relative z-10 truncate ${
                  isMyTurn && hasTemporaryTiles && placementValid === true
                    ? 'text-white drop-shadow-[0_1px_0_#000] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
                    : isMyTurn && hasTemporaryTiles
                    ? 'text-rose-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
                    : 'text-slate-300'
                }`}>
                  {isSubmitting
                    ? '...'
                    : isMyTurn && hasTemporaryTiles && placementValid === true
                    ? 'PLAY'
                    : isMyTurn && hasTemporaryTiles
                    ? 'INVALID'
                    : 'PLAY'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
