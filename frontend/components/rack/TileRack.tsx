'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tile } from '../../lib/types';
import { RotateCcw, Check, SkipForward, Shuffle, ArrowLeftRight, X } from 'lucide-react';
import { ConstellationGraphic } from '../effects/ConstellationGraphic';

interface TileRackProps {
  /** Fixed seats. `null` means the seat is empty — either the tile is on the board or the bag ran dry. */
  slots: (Tile | null)[];
  selectedTileId: string | null;
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
  onRackViewportChange: (rect: { left: number; top: number; width: number; height: number }) => void;
  isExternalDragActive: boolean;
  isMyTurn: boolean;
  canStageMove: boolean;
  hasTemporaryTiles: boolean;
  /** Server verdict on the tiles placed on the board: `null` while it is being checked. */
  placementValid: boolean | null;
  isSubmitting: boolean;
  estimatedScore?: number;
}

export const TileRack: React.FC<TileRackProps> = ({
  slots,
  selectedTileId,
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
  onRackViewportChange,
  isExternalDragActive,
  isMyTurn,
  canStageMove,
  hasTemporaryTiles,
  placementValid,
  isSubmitting,
  estimatedScore,
}) => {
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  /** The tile left the stand and the board drag (which draws its own floating tile) took over. */
  const [isHandedToBoard, setIsHandedToBoard] = useState(false);
  /** True when the user has clicked Pass once and we're waiting for confirm/cancel. */
  const [passConfirming, setPassConfirming] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const externalDragRef = useRef(false);
  const rackRef = useRef<HTMLDivElement | null>(null);
  const dragPositionFrameRef = useRef<number | null>(null);
  const pendingDragPositionRef = useRef<{ x: number; y: number } | null>(null);

  const tileCount = slots.reduce((total, tile) => (tile ? total + 1 : total), 0);
  const isExchanging = exchangeTileIds !== null;
  const exchangeCount = exchangeTileIds?.length ?? 0;
  // Rules §5: exchanging is only allowed while the bag still holds at least 7 tiles.
  const canStartExchange = isMyTurn && canStageMove && !hasTemporaryTiles && !isSubmitting && tileCount > 0 && tileBagCount >= 7;
  const canConfirmExchange = isMyTurn && !isSubmitting && exchangeCount > 0 && exchangeCount <= tileBagCount;

  useEffect(() => {
    const updateViewport = () => {
      const rect = rackRef.current?.getBoundingClientRect();
      if (rect) onRackViewportChange({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [onRackViewportChange, slots.length]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, slotIndex: number) => {
    // While exchanging, a tap marks the tile instead of lifting it.
    if (!canStageMove || isExchanging) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    didDragRef.current = false;
    externalDragRef.current = false;
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
        if (pendingDragPositionRef.current) setDragPosition(pendingDragPositionRef.current);
      });
    }
    const rackRect = rackRef.current?.getBoundingClientRect();
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

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-5xl mx-auto px-2 pointer-events-auto">
      {/* Portalled to <body>: the rack bar's backdrop-blur makes it the containing block for `fixed`
          children, which drew this tile a whole bar-height below the pointer. */}
      {draggedTile && dragPosition && !isHandedToBoard && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 rotate-2 scale-105 flex-col items-center justify-center rounded-xl border border-sky-400/50 bg-gradient-to-b from-[#23407a] via-[#1a305e] to-[#122244] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_28px_rgba(0,0,0,0.7)] overflow-hidden"
          style={{ left: dragPosition.x, top: dragPosition.y }}
          aria-hidden="true"
        >
          {/* Top Glass Highlight */}
          <div className="absolute inset-x-1 top-0.5 h-[36%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10" />
          {/* Letter Celestial Constellation */}
          <ConstellationGraphic letter={draggedTile.letter} />
          {draggedTile.letter.toUpperCase() === 'BLANK' || draggedTile.letter === '?' ? (
            <div className="relative z-20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_14px_rgba(56,189,248,0.95)] animate-pulse" fill="currentColor">
                <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
              </svg>
            </div>
          ) : (
            <span className="relative z-20 text-[38px] font-normal leading-none font-quakduck text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">{draggedTile.letter}</span>
          )}
          <span className="absolute z-20 bottom-1 right-1.5 text-[12px] font-mono font-bold text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">{draggedTile.value}</span>
        </div>,
        document.body
      )}

      {/* Premium Player Control Hub: 3-column layout (Left Pod, Center Tray, Right Pod) */}
      <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-3 lg:gap-4 w-full">
        {/* LEFT POD: GAME MANAGEMENT */}
        <div className="flex flex-col items-center md:items-start shrink-0">
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              {isExchanging ? 'Exchange Mode' : 'Game Management'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-xl shadow-black/60 ring-1 ring-cyan-500/15 min-h-[58px]">
            {isExchanging ? (
              <div className="flex items-center gap-2 px-1">
                <button
                  onClick={onCancelExchange}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-700/60 cursor-pointer shadow-md shadow-rose-950/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4 text-rose-400" />
                  <span>Cancel</span>
                </button>
                <span className="text-xs text-slate-400 max-w-[150px] leading-tight">
                  {exchangeCount > tileBagCount
                    ? `Only ${tileBagCount} left`
                    : 'Tap tiles to return'}
                </span>
              </div>
            ) : (
              <>
                {/* Cancel Move */}
                <button
                  onClick={onCancelMove}
                  disabled={!hasTemporaryTiles || isSubmitting}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all ${
                    hasTemporaryTiles
                      ? 'bg-rose-950/70 text-rose-300 hover:bg-rose-900/90 border border-rose-600/60 cursor-pointer shadow-md shadow-rose-950/40 active:scale-95'
                      : 'bg-slate-800/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                  }`}
                  title="Recall placed tiles to rack"
                >
                  <RotateCcw className={`w-4 h-4 ${hasTemporaryTiles ? 'text-rose-400' : 'text-slate-600'}`} />
                  <span>Cancel</span>
                </button>

                {/* Shuffle */}
                <button
                  onClick={onShuffleRack}
                  disabled={tileCount < 2 || isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 disabled:text-slate-600 disabled:bg-slate-800/30 disabled:border-slate-800/60 disabled:cursor-not-allowed border border-slate-700/70 shadow-sm transition-all cursor-pointer"
                  title="Shuffle rack tiles"
                >
                  <Shuffle className="w-4 h-4 text-amber-400" />
                  <span>Shuffle</span>
                </button>

                {/* Exchange */}
                <button
                  onClick={onStartExchange}
                  disabled={!canStartExchange}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs sm:text-sm text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 disabled:text-slate-600 disabled:bg-slate-800/30 disabled:border-slate-800/60 disabled:cursor-not-allowed border border-slate-700/70 shadow-sm transition-all cursor-pointer"
                  title={tileBagCount < 7 ? 'Exchanging needs at least 7 tiles in the bag' : 'Swap tiles with the bag (uses your turn)'}
                >
                  <ArrowLeftRight className="w-4 h-4 text-sky-400" />
                  <span>Exchange</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* CENTER POD: COSMIC BLUE TILE TRAY WITH NEON LED UNDER-LIGHTING */}
        <div className="relative flex flex-col items-center shrink-0">
          {/* LED under-lighting glow (Blue/Cyan Neon) */}
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600/30 via-cyan-500/40 to-blue-600/30 blur-md pointer-events-none opacity-90" />

          {/* Tray Stand (Blue Theme) */}
          <div
            ref={rackRef}
            className={`relative flex items-center justify-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 bg-gradient-to-b from-[#0e1d3d] via-[#081226] to-[#040814] backdrop-blur-md rounded-2xl border-2 shadow-[inset_0_1px_2px_rgba(255,255,255,0.22),0_12px_28px_rgba(0,0,0,0.7),0_0_22px_rgba(37,99,235,0.35)] min-h-[72px] sm:min-h-[78px] ${
              isExternalDragActive ? 'border-cyan-300 ring-2 ring-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.5)]' : 'border-blue-500/70 hover:border-blue-400/90'
            } transition-all`}
          >
        {slots.map((tile, slotIndex) => {
          if (!tile) {
            const isDropTarget = dragOverSlot === slotIndex;
            return (
              <div
                key={`slot-${slotIndex}`}
                data-rack-slot={slotIndex}
                aria-hidden="true"
                className={`relative w-11 h-12 sm:w-13 sm:h-14 rounded-xl border border-blue-900/40 bg-[#060d1c]/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.75)] transition-all ${
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
          const isMarkedForExchange = exchangeTileIds?.includes(tile.id) ?? false;
          const isDragging = draggedSlot === slotIndex;
          const isDropTarget = dragOverSlot === slotIndex;
          return (
            <button
              key={tile.id}
              data-rack-slot={slotIndex}
              data-rack-tile-id={tile.id}
              onClick={() => handleTileClick(tile)}
              onPointerDown={(event) => handlePointerDown(event, slotIndex)}
              onPointerMove={(event) => handlePointerMove(event, tile)}
              onPointerUp={handlePointerUp}
              disabled={!canStageMove}
              aria-pressed={isExchanging ? isMarkedForExchange : undefined}
              className={`group relative flex flex-col items-center justify-center w-11 h-12 sm:w-13 sm:h-14 rounded-xl font-sans transition-all select-none touch-none overflow-hidden ${
                isDragging
                  ? 'z-10 scale-105 -translate-y-2 opacity-40 bg-[#16274e] border border-blue-400/50 shadow-2xl cursor-grabbing'
                  : isDropTarget
                  ? 'translate-x-1 ring-2 ring-sky-400/80'
                  : isMarkedForExchange
                  ? '-translate-y-3 bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 border-2 border-amber-300 shadow-amber-500/40 ring-4 ring-amber-400/50 cursor-pointer'
                  : isSelected
                  ? '-translate-y-3 bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] border-2 border-cyan-300 shadow-[0_0_18px_rgba(59,130,246,0.7)] ring-4 ring-cyan-400/60'
                  : canStageMove
                  ? 'bg-gradient-to-b from-[#23407a] via-[#1a305e] to-[#122244] border border-blue-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_6px_12px_rgba(0,0,0,0.55),0_2px_4px_rgba(0,0,0,0.4)] hover:brightness-110 hover:-translate-y-1 active:translate-y-0.5 cursor-pointer'
                  : 'bg-[#16274e]/60 border border-blue-900/30 opacity-60 cursor-not-allowed shadow-md'
              }`}
            >
              {/* 3D Specular Top Bevel Glass Highlight */}
              <div className="absolute inset-x-1 top-0.5 h-[36%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10" />

              {/* Unique Letter Constellation Star Cluster */}
              <ConstellationGraphic
                letter={tile.letter}
                isGolden={isMarkedForExchange}
                className="opacity-75 group-hover:opacity-95 transition-opacity"
              />

              {/* High-Contrast Prominent Letter OR Cosmic Wildcard Star */}
              {tile.letter.toUpperCase() === 'BLANK' || tile.letter === '?' ? (
                <div className="relative z-20 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.95)] animate-pulse" fill="currentColor">
                    <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
                  </svg>
                </div>
              ) : (
                <span className="relative z-20 text-[30px] sm:text-[36px] font-normal text-white leading-none font-quakduck drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {tile.letter}
                </span>
              )}

              {/* Glowing Value Badge */}
              <span className="absolute z-20 bottom-1 right-1.5 text-[11px] sm:text-[13px] font-mono font-bold text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
                {tile.value}
              </span>
            </button>
          );
        })}
          </div>
        </div>

        {/* RIGHT POD: TURN ACTIONS */}
        <div className="flex flex-col items-center md:items-end shrink-0">
          <div className="flex items-center justify-between w-full px-2 mb-1.5 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                {isExchanging ? 'Confirm Action' : 'Turn Actions'}
              </span>
            </div>
            {/* Points / Validity preview badge */}
            {!isExchanging && hasTemporaryTiles && estimatedScore !== undefined && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wider ${
                  placementValid === false
                    ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                    : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 animate-pulse'
                }`}
              >
                {placementValid === false ? 'INVALID' : `+${estimatedScore} PTS`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-xl shadow-black/60 ring-1 ring-emerald-500/15 min-h-[58px]">
            {isExchanging ? (
              <button
                onClick={onConfirmExchange}
                disabled={!canConfirmExchange}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                  canConfirmExchange
                    ? 'bg-sky-600 text-white hover:bg-sky-500 active:scale-95 shadow-[0_0_20px_rgba(14,165,233,0.5)] cursor-pointer border-2 border-sky-400/50 ring-2 ring-sky-400/30'
                    : 'bg-slate-800/40 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{isSubmitting ? 'Exchanging...' : `Exchange ${exchangeCount} Tile${exchangeCount === 1 ? '' : 's'}`}</span>
              </button>
            ) : (
              <>
                {/* Pass Button — with inline confirm step */}
                {passConfirming ? (
                  <>
                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap tracking-wide">
                      Skip turn?
                    </span>
                    <button
                      onClick={() => { setPassConfirming(false); onPassTurn(); }}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all bg-slate-700 hover:bg-slate-600 text-white border border-slate-500/70 cursor-pointer shadow-sm active:scale-95"
                      title="Confirm pass"
                    >
                      <Check className="w-4 h-4 text-sky-400" />
                      <span>Confirm</span>
                    </button>
                    <button
                      onClick={() => setPassConfirming(false)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 border border-slate-700/50 cursor-pointer active:scale-95"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setPassConfirming(true)}
                    disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs sm:text-sm transition-all ${
                      isMyTurn && !hasTemporaryTiles
                        ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600/60 cursor-pointer shadow-sm active:scale-95'
                        : 'bg-slate-800/30 text-slate-600 border border-slate-800/60 cursor-not-allowed'
                    }`}
                    title="Pass your turn"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Pass</span>
                  </button>
                )}

                {/* Confirm Move: Largest, prominent, glowing button */}
                <button
                  onClick={onConfirmMove}
                  disabled={!isMyTurn || !hasTemporaryTiles || placementValid !== true || isSubmitting}
                  className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl font-bold text-sm sm:text-base transition-all ${
                    isMyTurn && hasTemporaryTiles && placementValid === true
                      ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-[0_0_24px_rgba(16,185,129,0.65)] border-2 border-emerald-300 ring-2 ring-emerald-400/40 animate-pulse hover:brightness-110 active:scale-95 cursor-pointer'
                      : 'bg-slate-800/40 text-slate-600 border border-slate-700/30 cursor-not-allowed'
                  }`}
                >
                  <Check className={`w-5 h-5 ${isMyTurn && hasTemporaryTiles && placementValid === true ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]' : 'text-slate-600'}`} />
                  <span>{isSubmitting ? 'Confirming...' : 'Confirm Move'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
