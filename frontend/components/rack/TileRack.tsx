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

      {/* Compact High-Tech Gaming Console Dock */}
      <div className="game-control-layout relative flex w-full flex-col lg:flex-row items-center justify-center gap-1.5 sm:gap-2 lg:gap-4">
        {/* Specular Edge Highlight Trim */}
        <div aria-hidden="true" className="pedestal-top-glint absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent pointer-events-none" />

        {/* LEFT / CENTER: 7-TILE RACK & POWER CARDS */}
        <div className="game-rack-module game-rack-center relative order-1 flex w-full max-w-full shrink-0 flex-col items-center gap-1.5 lg:w-auto">
          {/* 7-Tile Stand: Top on mobile (order-1), Lower on desktop (lg:order-2) */}
          <div className="order-1 lg:order-2 w-full overflow-x-auto overflow-y-hidden px-1 sm:px-0 flex justify-center hide-scrollbar scroll-smooth lg:overflow-visible">
            <div
              ref={rackRef}
              className={`game-tile-tray relative flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl border px-2 py-1.5 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-1.5 min-h-[52px] sm:min-h-[56px] ${
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
                      className={`relative shrink-0 h-[44px] w-[38px] sm:h-[46px] sm:w-[42px] rounded-[10px] border border-blue-900/40 bg-[#060d1c]/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.75)] transition-all sm:rounded-xl ${
                        isDropTarget
                          ? 'ring-2 ring-sky-400/90'
                          : isExternalDragActive
                          ? 'ring-1 ring-sky-400/40'
                          : ''
                      }`}
                    >
                      <span className="absolute inset-[6px] rounded-md border border-dashed border-sky-400/20" />
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
                    className="relative shrink-0 h-[44px] w-[38px] sm:h-[46px] sm:w-[42px]"
                  >
                    {/* Slot frame / seat behind tile */}
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
                      <span className="absolute inset-[6px] rounded-md border border-dashed border-sky-400/20" />
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
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Power Cards Bay: Middle on mobile (order-2), Upper on desktop (lg:order-1) */}
          {powerCardSlot && (
            <div className="game-power-strip order-2 lg:order-1 flex w-full max-w-full items-center justify-center">
              {powerCardSlot}
            </div>
          )}
        </div>

        {/* RIGHT / BOTTOM: ACTION CONTROLS */}
        {/* DESKTOP VIEW (>= 1024px): 2 BALANCED ROWS WITH FULL TEXT LABELS (Original PC UI) */}
        <div className="game-actions-container hidden lg:flex order-2 w-[320px] shrink-0 flex-col gap-1.5">
          {/* Desktop Row 1: Utility Controls (Recall, Shuffle, Swap) */}
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {isExchanging ? (
              <div className="col-span-3 flex items-center justify-between gap-2 px-2 py-1 bg-rose-950/40 border border-rose-700/50 rounded-xl">
                <motion.button
                  onClick={onCancelExchange}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex h-[32px] items-center gap-1 px-2.5 rounded-lg font-bold text-xs bg-rose-900/80 text-rose-200 hover:bg-rose-800 border border-rose-600 cursor-pointer shadow-sm"
                >
                  <X className="w-3.5 h-3.5 text-rose-300" />
                  <span>Cancel</span>
                </motion.button>
                <span className="text-[10.5px] text-slate-300 truncate font-medium">
                  {exchangeCount > tileBagCount ? `Only ${tileBagCount} in bag` : 'Select tiles to swap'}
                </span>
              </div>
            ) : (
              <>
                {/* Recall */}
                <motion.button
                  onClick={onCancelMove}
                  disabled={!hasTemporaryTiles || isSubmitting}
                  whileHover={hasTemporaryTiles ? { scale: 1.02 } : undefined}
                  whileTap={hasTemporaryTiles ? { scale: 0.96 } : undefined}
                  className={`flex h-[34px] sm:h-[36px] items-center justify-center gap-1.5 rounded-xl font-bold text-xs transition-all select-none ${
                    hasTemporaryTiles
                      ? 'bg-rose-950/90 text-rose-200 hover:bg-rose-900 border border-rose-600/80 cursor-pointer shadow-md shadow-rose-950/40'
                      : 'bg-[#152234]/80 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                  title="Recall placed tiles to rack"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${hasTemporaryTiles ? 'text-rose-400' : 'text-slate-500'}`} />
                  <span>Recall{hasTemporaryTiles ? ` (${stagedTileCount})` : ''}</span>
                </motion.button>

                {/* Shuffle */}
                <motion.button
                  onClick={onShuffleRack}
                  disabled={tileCount < 2 || isSubmitting}
                  whileHover={tileCount >= 2 && !isSubmitting ? { scale: 1.02 } : undefined}
                  whileTap={tileCount >= 2 && !isSubmitting ? { scale: 0.96 } : undefined}
                  className="flex h-[34px] sm:h-[36px] items-center justify-center gap-1.5 rounded-xl font-bold text-xs text-amber-200 hover:text-white bg-[#221808]/80 hover:bg-[#33240c] border border-amber-500/40 hover:border-amber-400 disabled:text-slate-500 disabled:bg-[#152234]/40 disabled:border-white/5 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
                  title="Shuffle rack tiles"
                >
                  <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Shuffle</span>
                </motion.button>

                {/* Swap */}
                <motion.button
                  onClick={onStartExchange}
                  disabled={!canStartExchange}
                  whileHover={canStartExchange ? { scale: 1.02 } : undefined}
                  whileTap={canStartExchange ? { scale: 0.96 } : undefined}
                  className="flex h-[34px] sm:h-[36px] items-center justify-center gap-1.5 rounded-xl font-bold text-xs text-sky-200 hover:text-white bg-[#0a1e32]/80 hover:bg-[#112d4a] border border-sky-500/40 hover:border-sky-400 disabled:text-slate-500 disabled:bg-[#152234]/40 disabled:border-white/5 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
                  title={tileBagCount < 7 ? 'Exchanging needs at least 7 tiles in the bag' : 'Swap tiles with the bag (uses your turn)'}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
                  <span>Swap</span>
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
                whileTap={canConfirmExchange ? { scale: 0.96 } : undefined}
                className={`flex w-full h-[38px] items-center justify-center gap-2 rounded-xl font-black text-xs transition-all ${
                  canConfirmExchange
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_0_16px_rgba(14,165,233,0.5)] border border-sky-300 cursor-pointer'
                    : 'bg-[#152234]/80 text-slate-500 border border-white/5 cursor-not-allowed'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{isSubmitting ? 'Swapping...' : `Confirm Swap (${exchangeCount} Tiles)`}</span>
              </motion.button>
            ) : passConfirming ? (
              <div className="grid grid-cols-[1fr_2fr] gap-1.5 w-full">
                {/* Cancel Pass */}
                <motion.button
                  onClick={() => setPassConfirming(false)}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex h-[38px] items-center justify-center rounded-xl text-xs sm:text-sm font-bold bg-[#152234] hover:bg-[#20344f] text-slate-300 hover:text-white border border-white/10 cursor-pointer transition-all shadow-sm"
                >
                  <span>Cancel</span>
                </motion.button>

                {/* Confirm Pass Button */}
                <motion.button
                  onClick={() => { setPassConfirming(false); onPassTurn(); }}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex h-[38px] items-center justify-center rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:brightness-110 text-white border border-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.6)] cursor-pointer transition-all"
                >
                  <span>{isSubmitting ? 'Passing...' : 'Confirm Pass'}</span>
                </motion.button>
              </div>
            ) : (
              <div className="grid grid-cols-[2fr_1fr] gap-1.5 w-full">
                {/* Primary Confirm / Play Move Button */}
                <motion.button
                  onClick={onConfirmMove}
                  disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                  whileHover={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 1.02 } : undefined}
                  whileTap={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 0.96 } : undefined}
                  className={`game-primary-action flex h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 font-black text-xs sm:text-sm transition-all select-none ${
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(52,211,153,0.7)] border border-emerald-200 hover:brightness-110 cursor-pointer font-black'
                      : isMyTurn && hasTemporaryTiles && placementValid === false
                      ? 'bg-rose-950/90 text-rose-300 border border-rose-600/80 cursor-not-allowed'
                      : 'bg-[#152234]/80 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  <Check className={`w-4 h-4 stroke-[3] ${isMyTurn && hasTemporaryTiles && placementValid === true ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span className="tracking-wide truncate font-black">
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
                  whileHover={isMyTurn && !hasTemporaryTiles ? { scale: 1.02 } : undefined}
                  whileTap={isMyTurn && !hasTemporaryTiles ? { scale: 0.96 } : undefined}
                  className={`flex h-[38px] items-center justify-center gap-1.5 rounded-xl font-bold text-xs transition-all select-none ${
                    isMyTurn && !hasTemporaryTiles
                      ? 'bg-[#152234] hover:bg-[#20344f] text-slate-200 hover:text-white border border-slate-600/60 hover:border-sky-400/60 cursor-pointer shadow-sm'
                      : 'bg-[#152234]/80 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                  title="Pass your turn"
                >
                  <SkipForward className="w-3.5 h-3.5 text-slate-400" />
                  <span>Pass</span>
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE VIEW (< 1024px): 1 ULTRA-SLEEK COMPACT ROW (Icons only) */}
        <div className="game-actions-container flex lg:hidden order-2 w-full max-w-[340px] sm:max-w-[360px] shrink-0 flex-col">
          {isExchanging ? (
            <div className="grid grid-cols-[1fr_2fr] gap-1.5 w-full">
              {/* Cancel Exchange */}
              <motion.button
                onClick={onCancelExchange}
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="flex h-[36px] items-center justify-center gap-1 px-2.5 rounded-xl font-bold text-xs bg-rose-900/80 text-rose-200 hover:bg-rose-800 border border-rose-600 cursor-pointer shadow-sm"
                title="Cancel Swap"
                aria-label="Cancel Swap"
              >
                <X className="w-4 h-4 text-rose-300" />
                <span>Cancel</span>
              </motion.button>

              {/* Confirm Exchange */}
              <motion.button
                onClick={onConfirmExchange}
                disabled={!canConfirmExchange}
                whileHover={canConfirmExchange ? { scale: 1.02 } : undefined}
                whileTap={canConfirmExchange ? { scale: 0.96 } : undefined}
                className={`flex h-[36px] items-center justify-center gap-1.5 rounded-xl font-black text-xs transition-all ${
                  canConfirmExchange
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_0_16px_rgba(14,165,233,0.5)] border border-sky-300 cursor-pointer'
                    : 'bg-[#152234]/80 text-slate-500 border border-white/5 cursor-not-allowed'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{isSubmitting ? 'Swapping...' : `Swap (${exchangeCount})`}</span>
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
                className="flex h-[36px] items-center justify-center gap-1 rounded-xl text-xs font-bold bg-[#152234] hover:bg-[#20344f] text-slate-300 hover:text-white border border-white/10 cursor-pointer transition-all shadow-sm"
              >
                <X className="w-4 h-4 text-slate-400" />
                <span>Cancel</span>
              </motion.button>

              {/* Confirm Pass Button */}
              <motion.button
                onClick={() => { setPassConfirming(false); onPassTurn(); }}
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="flex h-[36px] items-center justify-center gap-1.5 rounded-xl font-black text-xs bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:brightness-110 text-white border border-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.6)] cursor-pointer transition-all"
              >
                <SkipForward className="w-4 h-4" />
                <span>{isSubmitting ? 'Passing...' : 'Confirm Pass'}</span>
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
                className={`flex h-[36px] items-center justify-center gap-1 rounded-xl transition-all select-none ${
                  hasTemporaryTiles
                    ? 'bg-rose-950/90 text-rose-200 hover:bg-rose-900 border border-rose-600/80 cursor-pointer shadow-md shadow-rose-950/40'
                    : 'bg-[#152234]/80 text-slate-500 border border-white/5 cursor-not-allowed'
                }`}
                title={`Recall placed tiles${hasTemporaryTiles ? ` (${stagedTileCount})` : ''}`}
                aria-label="Recall placed tiles"
              >
                <RotateCcw className={`w-4 h-4 ${hasTemporaryTiles ? 'text-rose-400' : 'text-slate-500'}`} />
                {hasTemporaryTiles && (
                  <span className="text-[10px] font-mono font-bold leading-none text-rose-200">{stagedTileCount}</span>
                )}
              </motion.button>

              {/* 2. Shuffle */}
              <motion.button
                onClick={onShuffleRack}
                disabled={tileCount < 2 || isSubmitting}
                whileHover={tileCount >= 2 && !isSubmitting ? { scale: 1.05 } : undefined}
                whileTap={tileCount >= 2 && !isSubmitting ? { scale: 0.95 } : undefined}
                className="flex h-[36px] items-center justify-center rounded-xl text-amber-200 hover:text-white bg-[#221808]/80 hover:bg-[#33240c] border border-amber-500/40 hover:border-amber-400 disabled:text-slate-500 disabled:bg-[#152234]/40 disabled:border-white/5 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
                title="Shuffle rack tiles"
                aria-label="Shuffle rack tiles"
              >
                <Shuffle className="w-4 h-4 text-amber-400" />
              </motion.button>

              {/* 3. Swap */}
              <motion.button
                onClick={onStartExchange}
                disabled={!canStartExchange}
                whileHover={canStartExchange ? { scale: 1.05 } : undefined}
                whileTap={canStartExchange ? { scale: 0.95 } : undefined}
                className="flex h-[36px] items-center justify-center rounded-xl text-sky-200 hover:text-white bg-[#0a1e32]/80 hover:bg-[#112d4a] border border-sky-500/40 hover:border-sky-400 disabled:text-slate-500 disabled:bg-[#152234]/40 disabled:border-white/5 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
                title={tileBagCount < 7 ? 'Exchanging needs at least 7 tiles in bag' : 'Swap tiles with bag'}
                aria-label="Swap tiles with bag"
              >
                <ArrowLeftRight className="w-4 h-4 text-sky-400" />
              </motion.button>

              {/* 4. Pass */}
              <motion.button
                onClick={() => setPassConfirming(true)}
                disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
                whileHover={isMyTurn && !hasTemporaryTiles ? { scale: 1.05 } : undefined}
                whileTap={isMyTurn && !hasTemporaryTiles ? { scale: 0.95 } : undefined}
                className={`flex h-[36px] items-center justify-center rounded-xl transition-all select-none ${
                  isMyTurn && !hasTemporaryTiles
                    ? 'bg-[#152234] hover:bg-[#20344f] text-slate-200 hover:text-white border border-slate-600/60 hover:border-sky-400/60 cursor-pointer shadow-sm'
                    : 'bg-[#152234]/80 text-slate-500 border border-white/5 cursor-not-allowed'
                }`}
                title="Pass your turn"
                aria-label="Pass your turn"
              >
                <SkipForward className="w-4 h-4 text-slate-400" />
              </motion.button>

              {/* 5. Primary Confirm / Play Move Button */}
              <motion.button
                onClick={onConfirmMove}
                disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                whileHover={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 1.03 } : undefined}
                whileTap={isMyTurn && hasTemporaryTiles && placementValid === true ? { scale: 0.97 } : undefined}
                className={`game-primary-action flex h-[36px] items-center justify-center gap-1 rounded-xl px-2 font-black text-xs transition-all select-none ${
                  isMyTurn && hasTemporaryTiles && placementValid === true
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-slate-950 shadow-[0_0_18px_rgba(52,211,153,0.7)] border border-emerald-200 hover:brightness-110 cursor-pointer font-black'
                    : isMyTurn && hasTemporaryTiles && placementValid === false
                    ? 'bg-rose-950/90 text-rose-300 border border-rose-600/80 cursor-not-allowed'
                    : 'bg-[#152234]/80 text-slate-500 border border-white/5 cursor-not-allowed'
                }`}
                title={
                  placementValid === true && estimatedScore !== undefined && estimatedScore > 0
                    ? `Play word (+${estimatedScore} pts)`
                    : 'Play placed tiles'
                }
                aria-label="Confirm move"
              >
                <Check className={`w-4 h-4 stroke-[3] ${isMyTurn && hasTemporaryTiles && placementValid === true ? 'text-slate-950' : 'text-slate-500'}`} />
                {placementValid === true && estimatedScore !== undefined && estimatedScore > 0 && (
                  <span className="font-mono text-xs font-black tracking-tight text-slate-950">
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
