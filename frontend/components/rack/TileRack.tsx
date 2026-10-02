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
      onFinishTileDrag(event.clientX, event.clientY);
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
    <div className="game-control-deck mx-auto w-full max-w-none pointer-events-auto">
      {draggedTile && dragPosition && !isHandedToBoard && (
        <FloatingTile
          ref={ghostRef}
          letter={getDisplayLetter(draggedTile)}
          value={draggedTile.value}
          position={dragPosition}
          isDesignatedBlank={isBlankLetter(draggedTile.letter) && Boolean(designatedBlankLetters[draggedTile.id])}
        />
      )}

      {/* Symmetrical High-Tech Gaming Pedestal Console Dock */}
      <div className="game-control-layout relative flex w-full flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 lg:flex-nowrap lg:gap-5">
        {/* Decorative High-Tech Corner Brackets & Specular Trim */}
        <div aria-hidden="true" className="pedestal-bracket pedestal-bracket-tl absolute -top-[1px] left-3 hidden h-3.5 w-7 rounded-tl-lg border-l-2 border-t-2 border-cyan-400/80 pointer-events-none lg:block shadow-[0_0_8px_rgba(56,189,248,0.5)]">
          <span className="absolute left-1 top-1 h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_4px_#38bdf8]" />
        </div>
        <div aria-hidden="true" className="pedestal-bracket pedestal-bracket-tr absolute -top-[1px] right-3 hidden h-3.5 w-7 rounded-tr-lg border-r-2 border-t-2 border-cyan-400/80 pointer-events-none lg:block shadow-[0_0_8px_rgba(56,189,248,0.5)]">
          <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-cyan-300 shadow-[0_0_4px_#38bdf8]" />
        </div>
        <div aria-hidden="true" className="pedestal-top-glint absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent pointer-events-none" />

        {/* CENTER POD: 3-CARD EFFECT DECK (UPPER) + 7-TILE RACK (LOWER) */}
        <div className="game-rack-module game-rack-center relative order-1 flex w-full max-w-full shrink-0 flex-col items-center gap-1.5 lg:order-2 lg:w-auto">
          {/* Upper Deck: 3 Card Slots Bay */}
          {powerCardSlot && (
            <div className="game-power-strip flex w-full max-w-full items-center justify-center px-1.5 py-1">
              {powerCardSlot}
            </div>
          )}

          {/* Lower Deck: 7-Tile Stand */}
          <div className="w-full overflow-x-auto overflow-y-hidden pt-1 -mt-1 pb-1 -mb-1 px-1 sm:px-0 flex justify-center hide-scrollbar scroll-smooth lg:overflow-visible">
            <div
              ref={rackRef}
              className={`game-tile-tray relative flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-1.5 min-h-[58px] sm:min-h-[60px] ${
                isExternalDragActive
                  ? 'border-cyan-300/80 bg-cyan-950/40 ring-2 ring-cyan-300/40'
                  : 'border-white/10 bg-[#070f1a]/90 shadow-[inset_0_2px_8px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)]'
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
                  className={`relative shrink-0 h-[46px] w-[40px] sm:h-[46px] sm:w-[42px] rounded-[10px] border border-blue-900/40 bg-[#060d1c]/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.75)] transition-all sm:rounded-xl ${
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
                className="relative shrink-0 h-[46px] w-[40px] sm:h-[46px] sm:w-[42px]"
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
                      <svg viewBox="0 0 24 24" className="tile-blank-star w-6 h-6 sm:w-6 sm:h-6" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                        <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
                      </svg>
                    </div>
                  ) : (
                    <span className="tile-letter tile-letter-orange relative z-20 text-[28px] sm:text-[30px] leading-none font-maple">
                      {displayLetter}
                    </span>
                  )}

                  {/* Glowing Value Badge */}
                  <span className="tile-score-blue absolute bottom-0.5 right-1 z-20 text-[10px] font-maple sm:bottom-1 sm:right-1.5 sm:text-[12px] leading-none">
                    {tile.value}
                  </span>
                </motion.button>
              </div>
            );
          })}
            </div>
          </div>
        </div>


        {/* MOBILE CONTROLS WRAPPER (Unified symmetrical bar on mobile, split pods on desktop) */}
        <div className="game-actions-bridge order-2 relative flex w-auto max-w-full flex-row items-center justify-center gap-1.5 lg:contents">

        {/* LEFT WING: UTILITY CONTROLS (Balanced width) */}
        <div className="game-utility-module game-rack-tools flex shrink flex-col items-center justify-center lg:order-1 lg:flex-1 lg:basis-0 lg:items-end min-w-0">
          <div className="flex h-[40px] sm:h-[44px] w-auto items-center justify-center gap-1.5">
            {isExchanging ? (
              <div className="flex items-center gap-2 px-1">
                <motion.button
                  onClick={onCancelExchange}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex h-[40px] sm:h-[44px] items-center gap-1.5 px-3.5 rounded-xl font-bold text-xs sm:text-sm transition-colors bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-700/60 cursor-pointer shadow-md shadow-rose-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                {/* Recall Move */}
                <motion.button
                  onClick={onCancelMove}
                  disabled={!hasTemporaryTiles || isSubmitting}
                  whileHover={hasTemporaryTiles ? { scale: 1.05 } : undefined}
                  whileTap={hasTemporaryTiles ? { scale: 0.94 } : undefined}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`flex h-[40px] sm:h-[44px] min-w-[70px] sm:min-w-[76px] items-center justify-center gap-1.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all select-none ${
                    hasTemporaryTiles
                      ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 text-white shadow-[0_0_16px_rgba(244,63,94,0.5)] border border-rose-400/80 cursor-pointer hover:brightness-110'
                      : 'bg-[#152338]/70 text-slate-500 border border-white/[0.08] cursor-not-allowed shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                  }`}
                  title="Recall placed tiles to rack"
                >
                  <RotateCcw className={`w-4 h-4 ${hasTemporaryTiles ? 'text-white' : 'text-slate-500'}`} />
                  <span className="hidden xs:inline sm:inline">Recall{hasTemporaryTiles ? ` ${stagedTileCount}` : ''}</span>
                </motion.button>

                {/* Shuffle */}
                <motion.button
                  onClick={onShuffleRack}
                  disabled={tileCount < 2 || isSubmitting}
                  whileHover={tileCount >= 2 && !isSubmitting ? { scale: 1.05 } : undefined}
                  whileTap={tileCount >= 2 && !isSubmitting ? { scale: 0.94 } : undefined}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex h-[40px] sm:h-[44px] min-w-[70px] sm:min-w-[76px] items-center justify-center gap-1.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-[#F1F5F9] hover:text-white bg-gradient-to-b from-[#223956] to-[#142336] hover:from-[#2e4d75] hover:to-[#1c314b] disabled:text-slate-500 disabled:bg-[#152338]/70 disabled:border-white/[0.08] disabled:cursor-not-allowed border border-[rgba(140,180,220,0.3)] hover:border-amber-400/60 shadow-md hover:shadow-[0_0_14px_rgba(245,158,11,0.3)] transition-all cursor-pointer select-none"
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
                  className="flex h-[40px] sm:h-[44px] min-w-[70px] sm:min-w-[76px] items-center justify-center gap-1.5 px-3 rounded-xl font-bold text-xs sm:text-sm text-[#F1F5F9] hover:text-white bg-gradient-to-b from-[#223956] to-[#142336] hover:from-[#2e4d75] hover:to-[#1c314b] disabled:text-slate-500 disabled:bg-[#152338]/70 disabled:border-white/[0.08] disabled:cursor-not-allowed border border-[rgba(140,180,220,0.3)] hover:border-sky-400/60 shadow-md hover:shadow-[0_0_14px_rgba(56,189,248,0.3)] transition-all cursor-pointer select-none"
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
        <div className="h-6 w-px bg-slate-700/60 mx-0.5 lg:hidden" />

        {/* RIGHT WING: TURN ACTIONS (Symmetrical matching width) */}
        <div className="game-turn-module game-turn-actions flex shrink flex-col items-center justify-center lg:order-3 lg:flex-1 lg:basis-0 lg:items-start min-w-0">
          <div className="relative flex h-[40px] sm:h-[44px] w-auto items-center justify-center gap-1.5">
            {isExchanging ? (
              <motion.button
                onClick={onConfirmExchange}
                disabled={!canConfirmExchange}
                whileHover={canConfirmExchange ? { scale: 1.05 } : undefined}
                whileTap={canConfirmExchange ? { scale: 0.94 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className={`flex h-[40px] sm:h-[44px] items-center gap-2 px-4 sm:px-5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  canConfirmExchange
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:brightness-110 shadow-[0_0_20px_rgba(14,165,233,0.6)] cursor-pointer border border-sky-300 ring-2 ring-sky-400/40'
                    : 'bg-[#152338]/70 text-slate-500 border border-white/[0.08] cursor-not-allowed shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{isSubmitting ? 'Exchanging...' : `Exchange ${exchangeCount} Tile${exchangeCount === 1 ? '' : 's'}`}</span>
              </motion.button>
            ) : (
              <>
                {/* Pass Button — with inline confirm step */}
                {passConfirming ? (
                  <div className="flex h-[40px] sm:h-[44px] items-center gap-1">
                    <span className="text-[10px] sm:text-[11px] text-slate-300 font-bold whitespace-nowrap tracking-wide">
                      Pass?
                    </span>
                    <motion.button
                      onClick={() => { setPassConfirming(false); onPassTurn(); }}
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.93 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                      className="flex h-[36px] items-center gap-1 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 cursor-pointer shadow-md"
                      title="Confirm pass"
                    >
                      <Check className="w-4 h-4 text-white" />
                      <span>Yes</span>
                    </motion.button>
                    <motion.button
                      onClick={() => setPassConfirming(false)}
                      whileHover={{ scale: 1.06 }}
                      whileTap={{ scale: 0.93 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                      className="flex h-[36px] items-center gap-1 px-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all bg-[#223956] hover:bg-[#2e4d75] text-slate-300 hover:text-white border border-white/10 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    onClick={() => setPassConfirming(true)}
                    disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
                    whileHover={isMyTurn && !hasTemporaryTiles ? { scale: 1.05 } : undefined}
                    whileTap={isMyTurn && !hasTemporaryTiles ? { scale: 0.94 } : undefined}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`game-pass-action flex h-[40px] sm:h-[44px] min-w-[70px] sm:min-w-[76px] items-center justify-center gap-1.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all select-none ${
                      isMyTurn && !hasTemporaryTiles
                        ? 'bg-gradient-to-b from-[#223956] to-[#142336] hover:from-[#2e4d75] hover:to-[#1c314b] text-[#E2E8F0] hover:text-white border border-[rgba(140,180,220,0.3)] hover:border-sky-400/50 shadow-md cursor-pointer'
                        : 'bg-[#152338]/70 text-slate-500 border border-white/[0.08] cursor-not-allowed shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                    }`}
                    title="Pass your turn"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span className="hidden xs:inline sm:inline">Pass</span>
                  </motion.button>
                )}

                {/* Primary Action Button (PLAY MOVE / SCORE) */}
                <motion.button
                  onClick={onConfirmMove}
                  disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                  whileHover={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 1.05 } : undefined}
                  whileTap={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 0.95 } : undefined}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className={`game-primary-action relative flex h-[40px] sm:h-[44px] min-w-[124px] sm:min-w-[145px] items-center justify-center gap-1.5 rounded-xl px-4 font-black text-xs sm:text-sm transition-all select-none overflow-hidden ${
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,0.7),inset_0_1px_0_rgba(255,255,255,0.4)] border border-emerald-300 ring-2 ring-emerald-400/50 hover:brightness-110 cursor-pointer'
                      : isMyTurn && hasTemporaryTiles && placementValid === false
                      ? 'bg-gradient-to-r from-rose-950 via-rose-900 to-slate-950 text-rose-300 border border-rose-500/70 shadow-[0_0_16px_rgba(244,63,94,0.4)] cursor-not-allowed'
                      : 'bg-[#152338]/70 text-slate-500 border border-white/[0.08] cursor-not-allowed shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                  }`}
                >
                  <Check className={`w-4 h-4 sm:w-5 sm:h-5 stroke-[3] ${
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'text-slate-950'
                      : isMyTurn && hasTemporaryTiles && placementValid === false
                      ? 'text-rose-400'
                      : 'text-slate-500'
                  }`} />
                  <span className="inline tracking-wide font-black">
                    {isSubmitting
                      ? 'Submitting...'
                      : placementValid === false && hasTemporaryTiles
                      ? 'INVALID'
                      : placementValid === true && estimatedScore !== undefined && estimatedScore > 0
                      ? `PLAY · +${estimatedScore} PTS`
                      : 'PLAY MOVE'}
                  </span>
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
