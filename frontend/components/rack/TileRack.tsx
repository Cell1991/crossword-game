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
  onStartTileDrag: (tile: Tile, clientX: number, clientY: number) => void;
  onFinishTileDrag: () => void;
  onCancelTileDrag: () => void;
  /** The tray element; the page's board drag hit-tests drops against it. */
  rackRef: React.RefObject<HTMLDivElement | null>;
  isExternalDragActive: boolean;
  isMyTurn: boolean;
  canStageMove: boolean;
  hasTemporaryTiles: boolean;
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
  placementValid,
  isSubmitting,
  estimatedScore,
  isBingoBonus,
  powerCardSlot,
}: TileRackProps) {
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  /** Where the floating tile appears; after that it follows the pointer without re-rendering. */
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  /** The tile left the stand and the board drag (which draws its own floating tile) took over. */
  const [isHandedToBoard, setIsHandedToBoard] = useState(false);
  /** True when the user has clicked Pass once and we're waiting for confirm/cancel. */
  const [passConfirming, setPassConfirming] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const externalDragRef = useRef(false);
  const ghostRef = useRef<HTMLDivElement>(null);
  /** The tray's box, measured when a drag starts (the tray does not move while a tile is dragged). */
  const rackRectRef = useRef<DOMRect | null>(null);
  const dragPositionFrameRef = useRef<number | null>(null);
  const pendingDragPositionRef = useRef<{ x: number; y: number } | null>(null);

  const tileCount = slots.reduce((total, tile) => (tile ? total + 1 : total), 0);
  const isExchanging = exchangeTileIds !== null;
  const exchangeCount = exchangeTileIds?.length ?? 0;
  // Rules §5: exchanging is only allowed while the bag still holds at least 7 tiles.
  const canStartExchange = isMyTurn && canStageMove && !hasTemporaryTiles && !isSubmitting && tileCount > 0 && tileBagCount >= 7;
  const canConfirmExchange = isMyTurn && !isSubmitting && exchangeCount > 0 && exchangeCount <= tileBagCount;

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, slotIndex: number) => {
    // While exchanging, a tap marks the tile instead of lifting it.
    if (!canStageMove || isExchanging) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
    externalDragRef.current = false;
    rackRectRef.current = rackRef.current?.getBoundingClientRect() ?? null;
    setDraggedSlot(slotIndex);
    setDragOverSlot(null);
    setDragPosition({ x: event.clientX, y: event.clientY });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>, tile: Tile) => {
    const start = pointerStartRef.current;
    if (!start || draggedSlot === null) return;
    pendingDragPositionRef.current = { x: event.clientX, y: event.clientY };
    if (dragPositionFrameRef.current === null) {
      dragPositionFrameRef.current = window.requestAnimationFrame(() => {
        dragPositionFrameRef.current = null;
        const position = pendingDragPositionRef.current;
        if (position) moveFixedElement(ghostRef.current, position.x, position.y);
      });
    }
    const rackRect = rackRectRef.current;
    const insideRack = Boolean(
      rackRect &&
      event.clientX >= rackRect.left &&
      event.clientX <= rackRect.right &&
      event.clientY >= rackRect.top &&
      event.clientY <= rackRect.bottom
    );
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) {
      didDragRef.current = true;
      // Leaving the stand hands the tile over to the board drag, and coming back takes it
      // over again — so a tile lifted above the rack can still be dropped on another seat.
      if (!insideRack && !externalDragRef.current) {
        externalDragRef.current = true;
        setIsHandedToBoard(true);
        onStartTileDrag(tile, event.clientX, event.clientY);
      } else if (insideRack && externalDragRef.current) {
        externalDragRef.current = false;
        // The floating tile mounts again here, so it starts where the pointer is now.
        setDragPosition({ x: event.clientX, y: event.clientY });
        setIsHandedToBoard(false);
        onCancelTileDrag();
      }
    }
    if (!insideRack) {
      setDragOverSlot(null);
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-rack-slot]');
    const targetSlot = target ? Number(target.dataset.rackSlot) : NaN;
    setDragOverSlot(Number.isInteger(targetSlot) && targetSlot !== draggedSlot ? targetSlot : null);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragPositionFrameRef.current !== null) {
      window.cancelAnimationFrame(dragPositionFrameRef.current);
      dragPositionFrameRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (draggedSlot !== null && dragOverSlot !== null) {
      onSwapSlots(draggedSlot, dragOverSlot);
    } else if (externalDragRef.current) {
      onFinishTileDrag();
    }
    pointerStartRef.current = null;
    setDraggedSlot(null);
    setDragOverSlot(null);
    setDragPosition(null);
    setIsHandedToBoard(false);
    externalDragRef.current = false;
    pendingDragPositionRef.current = null;
  };

  const handleTileClick = (tile: Tile) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (canStageMove) onSelectTile(tile);
  };

  const draggedTile = draggedSlot !== null ? slots[draggedSlot] : null;
  const getDisplayLetter = (tile: Tile) => (
    isBlankLetter(tile.letter) ? designatedBlankLetters[tile.id] ?? tile.letter : tile.letter
  );

  return (
    <div className="mx-auto flex w-full max-w-[72rem] flex-col items-center gap-1.5 px-0 pointer-events-auto sm:gap-2 sm:px-2">
      {draggedTile && dragPosition && !isHandedToBoard && (
        <FloatingTile
          ref={ghostRef}
          letter={getDisplayLetter(draggedTile)}
          value={draggedTile.value}
          position={dragPosition}
          isDesignatedBlank={isBlankLetter(draggedTile.letter) && Boolean(designatedBlankLetters[draggedTile.id])}
        />
      )}

      {/* SEPARATE ROW 1: POWER CARDS BAR (Always centered above the rack, never pushes buttons in row below) */}
      {powerCardSlot && (
        <div className="w-full flex justify-center items-center mb-1 sm:mb-2">
          {powerCardSlot}
        </div>
      )}

      {/* ROW 2: Premium Player Control Hub: 3-column balanced layout (Left Pod, Center Tray, Right Pod) */}
      <div className="flex w-full flex-row flex-wrap items-end justify-center gap-1.5 sm:gap-2 lg:flex-nowrap lg:gap-4">
        {/* CENTER POD: COSMIC BLUE TILE TRAY */}
        <div className="relative order-1 flex w-full max-w-full shrink-0 flex-col items-center lg:order-2 lg:w-auto">

          {/* Mobile Score Badge above Tray */}
          <AnimatePresence>
            {!isExchanging && hasTemporaryTiles && estimatedScore !== undefined && (
              <motion.div
                key="mobile-score-badge"
                initial={{ scale: 0.7, opacity: 0, y: 4 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  y: 0,
                  x: placementValid === false ? [-4, 4, -3, 3, -1, 1, 0] : 0,
                }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                className="lg:hidden w-full flex justify-center mb-1.5 pointer-events-none"
              >
                <span className={`font-extrabold tracking-widest text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
                  placementValid === false ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {placementValid === false ? 'INVALID' : `+${estimatedScore} PTS`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tray Stand (Blue Theme) */}
          <div className="w-full overflow-x-auto overflow-y-hidden pt-3.5 -mt-3.5 pb-1.5 -mb-1.5 px-1 sm:px-0 flex justify-center hide-scrollbar scroll-smooth lg:overflow-visible lg:pt-0 lg:mt-0 lg:pb-0 lg:mb-0">
            <div
              ref={rackRef}
              className={`relative flex items-center justify-center gap-1.5 pt-3.5 pb-2 px-2 sm:w-auto sm:gap-2.5 sm:pt-4 sm:pb-2.5 sm:px-2.5 bg-gradient-to-b from-[#0e1d3d] via-[#081226] to-[#040814] lg:backdrop-blur-md rounded-2xl border-2 shadow-[inset_0_1px_2px_rgba(255,255,255,0.22),0_12px_28px_rgba(0,0,0,0.7),0_0_22px_rgba(37,99,235,0.35)] min-h-[68px] sm:min-h-[84px] ${
                isExternalDragActive ? 'border-cyan-300 ring-2 ring-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.5)]' : 'border-blue-500/70 hover:border-blue-400/90'
              } transition-all`}
            >
          {slots.map((tile, slotIndex) => {
            const isDropTarget = dragOverSlot === slotIndex;
            if (!tile) {
              return (
                <div
                  key={`slot-${slotIndex}`}
                  data-rack-slot={slotIndex}
                  aria-hidden="true"
                  className={`relative shrink-0 h-[46px] w-[40px] sm:h-[56px] sm:w-[50px] rounded-[10px] border border-blue-900/40 bg-[#060d1c]/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.75)] transition-all sm:rounded-xl ${
                    isDropTarget
                      ? 'ring-2 ring-sky-400/90'
                      : isExternalDragActive
                      ? 'ring-1 ring-sky-400/40'
                      : ''
                  }`}
                >
                  <span className="absolute inset-[7px] rounded-md border border-dashed border-sky-400/20" />
                </div>
              );
            }

            const isSelected = selectedTileId === tile.id;
            const displayLetter = getDisplayLetter(tile);
            const isDesignatedBlank = isBlankLetter(tile.letter) && Boolean(designatedBlankLetters[tile.id]);
            const isMarkedForExchange = exchangeTileIds?.includes(tile.id) ?? false;
            const isDragging = draggedSlot === slotIndex;
            return (
              <div
                key={`slot-${slotIndex}`}
                data-rack-slot={slotIndex}
                className="relative shrink-0 h-[46px] w-[40px] sm:h-[56px] sm:w-[50px]"
              >
                {/* Slot frame / seat behind tile - always visible when tile is lifted/selected/dragged */}
                <div
                  aria-hidden="true"
                  className={`absolute inset-0 rounded-[10px] border border-blue-900/40 bg-[#060d1c]/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.75)] transition-all sm:rounded-xl ${
                    isDropTarget
                      ? 'ring-2 ring-sky-400/90'
                      : isExternalDragActive
                      ? 'ring-1 ring-sky-400/40'
                      : ''
                  }`}
                >
                  <span className="absolute inset-[7px] rounded-md border border-dashed border-sky-400/20" />
                </div>

                {/* Tile Button with spring physics */}
                <motion.button
                  key={tile.id}
                  layout={!isDragging}
                  data-rack-slot={slotIndex}
                  data-rack-tile-id={tile.id}
                  onClick={() => handleTileClick(tile)}
                  onPointerDown={(event) => handlePointerDown(event, slotIndex)}
                  onPointerMove={(event) => handlePointerMove(event, tile)}
                  onPointerUp={handlePointerUp}
                  disabled={!canStageMove}
                  aria-pressed={isExchanging ? isMarkedForExchange : undefined}
                  whileHover={canStageMove && !isDragging ? { scale: 1.06, y: -4 } : undefined}
                  whileTap={canStageMove ? { scale: 0.94 } : undefined}
                  transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                  className={`tile-face group absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[10px] border border-amber-100/80 font-sans transition-all select-none touch-none overflow-hidden sm:rounded-xl ${
                    isDragging
                      ? 'z-20 scale-105 -translate-y-2.5 opacity-40 shadow-2xl cursor-grabbing'
                      : isDropTarget
                      ? 'translate-x-1 ring-2 ring-sky-400/80'
                      : isMarkedForExchange
                      ? '-translate-y-2.5 border-2 border-amber-100 shadow-lg shadow-amber-500/40 ring-4 ring-amber-300/70 cursor-pointer'
                      : isSelected
                      ? '-translate-y-2.5 border-2 border-cyan-300 shadow-[0_0_18px_rgba(59,130,246,0.55)] ring-4 ring-cyan-400/60'
                      : canStageMove
                      ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_6px_12px_rgba(74,34,8,0.48),0_2px_4px_rgba(34,24,20,0.35)] hover:brightness-110 cursor-pointer'
                      : 'opacity-65 cursor-not-allowed shadow-md'
                  }`}
                >
                  {/* 3D Specular Top Bevel Glass Highlight */}
                  <div className="absolute inset-x-1 top-0.5 h-[36%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10" />

                  {/* High-Contrast Prominent Letter OR Cosmic Wildcard Star */}
                  {isBlankLetter(tile.letter) && !isDesignatedBlank ? (
                    <div className="relative z-20 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" className="tile-blank-star w-6 h-6 sm:w-8 sm:h-8 animate-pulse" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                        <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
                      </svg>
                    </div>
                  ) : (
                    <span className="tile-letter tile-letter-orange relative z-20 text-[28px] sm:text-[36px] leading-none font-maple">
                      {displayLetter}
                    </span>
                  )}

                  {/* Glowing Value Badge */}
                  <span className="tile-score-blue absolute bottom-0.5 right-1 z-20 text-[10px] font-maple sm:bottom-1 sm:right-1.5 sm:text-[13px] lg:text-[18px] leading-none">
                    {tile.value}
                  </span>
                </motion.button>
              </div>
            );
          })}
            </div>
          </div>
        </div>


        {/* MOBILE CONTROLS WRAPPER (Unified symmetrical pill on mobile, split pods on desktop) */}
        <div className="order-2 relative flex w-auto max-w-full flex-row items-center justify-center gap-1 rounded-2xl bg-slate-900/90 border border-slate-700/60 p-1 shadow-xl shadow-black/60 lg:contents lg:bg-transparent lg:border-0 lg:p-0 lg:shadow-none">

        {/* LEFT POD: GAME MANAGEMENT */}
        <div className="flex shrink flex-col items-center lg:order-1 lg:flex-1 lg:basis-0 lg:items-end min-w-0">
          <div className="hidden lg:flex mb-1.5 items-center gap-1.5 px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
            <span className="hidden text-[10px] font-bold tracking-widest text-slate-400 uppercase sm:inline">
              {isExchanging ? 'Exchange Mode' : 'Game Management'}
            </span>
          </div>

          <div className="flex w-auto justify-center items-center gap-1 p-0 lg:p-2 lg:bg-slate-900/85 lg:backdrop-blur-xl lg:border lg:border-slate-700/60 lg:rounded-2xl lg:shadow-xl lg:shadow-black/60 lg:ring-1 lg:ring-cyan-500/15 min-h-[44px] sm:min-h-[58px]">
            {isExchanging ? (
              <div className="flex items-center gap-2 px-1">
                <motion.button
                  onClick={onCancelExchange}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-colors bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-700/60 cursor-pointer shadow-md shadow-rose-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4 text-rose-400" />
                  <span className="hidden xs:inline sm:inline">Cancel</span>
                </motion.button>
                <span className="text-xs text-slate-400 max-w-[150px] leading-tight">
                  {exchangeCount > tileBagCount
                    ? `Only ${tileBagCount} left`
                    : 'Tap tiles to return'}
                </span>
              </div>
            ) : (
              <>
                {/* Cancel Move */}
                <motion.button
                  onClick={onCancelMove}
                  disabled={!hasTemporaryTiles || isSubmitting}
                  whileHover={hasTemporaryTiles ? { scale: 1.05 } : undefined}
                  whileTap={hasTemporaryTiles ? { scale: 0.94 } : undefined}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl font-medium text-xs sm:text-sm transition-colors ${
                    hasTemporaryTiles
                      ? 'bg-rose-950/70 text-rose-300 hover:bg-rose-900/90 border border-rose-600/60 cursor-pointer shadow-md shadow-rose-950/40'
                      : 'bg-slate-800/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                  }`}
                  title="Recall placed tiles to rack"
                >
                  <RotateCcw className={`w-4 h-4 ${hasTemporaryTiles ? 'text-rose-400' : 'text-slate-600'}`} />
                  <span className="hidden xs:inline sm:inline">Cancel</span>
                </motion.button>

                {/* Shuffle */}
                <motion.button
                  onClick={onShuffleRack}
                  disabled={tileCount < 2 || isSubmitting}
                  whileHover={tileCount >= 2 && !isSubmitting ? { scale: 1.05 } : undefined}
                  whileTap={tileCount >= 2 && !isSubmitting ? { scale: 0.94 } : undefined}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl font-medium text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 disabled:text-slate-600 disabled:bg-slate-800/30 disabled:border-slate-800/60 disabled:cursor-not-allowed border border-slate-700/70 shadow-sm transition-colors cursor-pointer"
                  title="Shuffle rack tiles"
                >
                  <Shuffle className="w-4 h-4 text-amber-400" />
                  <span className="hidden xs:inline sm:inline">Shuffle</span>
                </motion.button>

                {/* Exchange */}
                <motion.button
                  onClick={onStartExchange}
                  disabled={!canStartExchange}
                  whileHover={canStartExchange ? { scale: 1.05 } : undefined}
                  whileTap={canStartExchange ? { scale: 0.94 } : undefined}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl font-medium text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 disabled:text-slate-600 disabled:bg-slate-800/30 disabled:border-slate-800/60 disabled:cursor-not-allowed border border-slate-700/70 shadow-sm transition-colors cursor-pointer"
                  title={tileBagCount < 7 ? 'Exchanging needs at least 7 tiles in the bag' : 'Swap tiles with the bag (uses your turn)'}
                >
                  <ArrowLeftRight className="w-4 h-4 text-sky-400" />
                  <span className="hidden xs:inline sm:inline">Swap</span>
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* Divider on mobile */}
        <div className="h-5 w-px bg-slate-700/60 mx-0.5 lg:hidden" />

        {/* RIGHT POD: TURN ACTIONS */}
        <div className="flex shrink flex-col items-center lg:order-3 lg:flex-1 lg:basis-0 lg:items-start min-w-0">
          <div className="mb-1.5 hidden lg:flex w-full items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="hidden text-[10px] font-bold tracking-widest text-slate-400 uppercase sm:inline">
                {isExchanging ? 'Confirm Action' : 'Turn Actions'}
              </span>
            </div>
            {/* Points / Validity preview badge & Bingo indicator with smooth pop and shake animations */}
            <AnimatePresence mode="wait">
              {!isExchanging && hasTemporaryTiles && estimatedScore !== undefined && (
                <motion.div
                  key={placementValid === false ? 'invalid' : isBingoBonus ? 'bingo' : 'valid'}
                  initial={{ scale: 0.7, opacity: 0, y: 3 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    y: 0,
                    x: placementValid === false ? [-4, 4, -3, 3, -1, 1, 0] : 0,
                  }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                  className="flex items-center"
                >
                  {placementValid === false ? (
                    <span className="text-[11px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-lg border bg-gradient-to-r from-rose-950/90 to-rose-900/80 border-rose-500/70 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.45)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                      INVALID
                    </span>
                  ) : isBingoBonus ? (
                    <div className="flex items-center rounded-lg border border-amber-500/70 bg-slate-950/90 shadow-[0_0_16px_rgba(245,158,11,0.35)] overflow-hidden text-[11px] font-black tracking-wider uppercase">
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-300 border-r border-amber-500/50">
                        <span>🎉</span>
                        <span>BINGO</span>
                      </span>
                      <span className="px-2.5 py-0.5 bg-emerald-950/70 text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        +{estimatedScore} PTS
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-lg border bg-gradient-to-r from-emerald-950/90 to-emerald-900/80 border-emerald-500/70 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.45)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                      +{estimatedScore} PTS
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex w-auto flex-wrap items-center justify-center gap-1 p-0 lg:p-2 lg:bg-slate-900/85 lg:backdrop-blur-xl lg:border lg:border-slate-700/60 lg:rounded-2xl lg:shadow-xl lg:shadow-black/60 lg:ring-1 lg:ring-emerald-500/15 min-h-[44px] sm:min-h-[58px]">
            {isExchanging ? (
              <motion.button
                onClick={onConfirmExchange}
                disabled={!canConfirmExchange}
                whileHover={canConfirmExchange ? { scale: 1.05 } : undefined}
                whileTap={canConfirmExchange ? { scale: 0.94 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors ${
                  canConfirmExchange
                    ? 'bg-sky-600 text-white hover:bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.5)] cursor-pointer border-2 border-sky-400/50 ring-2 ring-sky-400/30'
                    : 'bg-slate-800/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{isSubmitting ? 'Exchanging...' : `Exchange ${exchangeCount} Tile${exchangeCount === 1 ? '' : 's'}`}</span>
              </motion.button>
            ) : (
              <>
                {/* Pass Button — with inline confirm step */}
                {passConfirming ? (
                  <>
                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap tracking-wide">
                      Skip?
                    </span>
                    <motion.button
                      onClick={() => { setPassConfirming(false); onPassTurn(); }}
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.93 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                      className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors bg-slate-700 hover:bg-slate-600 text-white border border-slate-500/70 cursor-pointer shadow-sm"
                      title="Confirm pass"
                    >
                      <Check className="w-4 h-4 text-sky-400" />
                      <span>Yes</span>
                    </motion.button>
                    <motion.button
                      onClick={() => setPassConfirming(false)}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.93 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                      className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl font-medium text-xs sm:text-sm transition-colors bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 border border-slate-700/50 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </>
                ) : (
                  <motion.button
                    onClick={() => setPassConfirming(true)}
                    disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
                    whileHover={isMyTurn && !hasTemporaryTiles ? { scale: 1.05 } : undefined}
                    whileTap={isMyTurn && !hasTemporaryTiles ? { scale: 0.94 } : undefined}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl font-medium text-xs sm:text-sm transition-colors ${
                      isMyTurn && !hasTemporaryTiles
                        ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600/60 cursor-pointer shadow-sm'
                        : 'bg-slate-800/30 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                    }`}
                    title="Pass your turn"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span className="hidden xs:inline sm:inline">Pass</span>
                  </motion.button>
                )}

                {/* Confirm Move: Largest, prominent, breathing glowing button */}
                <motion.button
                  onClick={onConfirmMove}
                  disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                  whileHover={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 1.05 } : undefined}
                  whileTap={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 0.95 } : undefined}
                  animate={
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? { scale: [1, 1.03, 1] }
                      : { scale: 1 }
                  }
                  transition={
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? { scale: { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } }
                      : { duration: 0.2 }
                  }
                  className={`flex items-center gap-1.5 px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-base transition-colors ${
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-[0_0_24px_rgba(16,185,129,0.65)] border-2 border-emerald-300 ring-2 ring-emerald-400/40 cursor-pointer'
                      : 'bg-slate-800/40 text-slate-600 border border-slate-700/30 cursor-not-allowed'
                  }`}
                >
                  <Check className={`w-4 h-4 sm:w-5 sm:h-5 ${isMyTurn && hasTemporaryTiles && placementValid === true ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]' : 'text-slate-600'}`} />
                  <span className="hidden xs:inline sm:inline">{isSubmitting ? 'Confirming...' : 'Confirm'}</span>
                </motion.button>
              </>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
});
