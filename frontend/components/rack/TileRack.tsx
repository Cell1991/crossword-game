'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Tile } from '../../lib/types';
import { RotateCcw, Check, SkipForward, Shuffle } from 'lucide-react';

interface TileRackProps {
  /** Fixed seats. `null` means the seat is empty — either the tile is on the board or the bag ran dry. */
  slots: (Tile | null)[];
  selectedTileId: string | null;
  onSelectTile: (tile: Tile) => void;
  onCancelMove: () => void;
  onConfirmMove: () => void;
  onPassTurn: () => void;
  onShuffleRack: () => void;
  onSwapSlots: (fromSlot: number, toSlot: number) => void;
  onStartTileDrag: (tile: Tile, clientX: number, clientY: number) => void;
  onFinishTileDrag: () => void;
  onRackViewportChange: (rect: { left: number; top: number; width: number; height: number }) => void;
  isExternalDragActive: boolean;
  isMyTurn: boolean;
  hasTemporaryTiles: boolean;
  isSubmitting: boolean;
  estimatedScore?: number;
}

export const TileRack: React.FC<TileRackProps> = ({
  slots,
  selectedTileId,
  onSelectTile,
  onCancelMove,
  onConfirmMove,
  onPassTurn,
  onShuffleRack,
  onSwapSlots,
  onStartTileDrag,
  onFinishTileDrag,
  onRackViewportChange,
  isExternalDragActive,
  isMyTurn,
  hasTemporaryTiles,
  isSubmitting,
  estimatedScore,
}) => {
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const externalDragRef = useRef(false);
  const rackRef = useRef<HTMLDivElement | null>(null);

  const tileCount = slots.reduce((total, tile) => (tile ? total + 1 : total), 0);

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
    if (!isMyTurn) return;
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
    setDragPosition({ x: event.clientX, y: event.clientY });
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) {
      didDragRef.current = true;
      const rackRect = rackRef.current?.getBoundingClientRect();
      const insideRack = Boolean(
        rackRect &&
        event.clientX >= rackRect.left &&
        event.clientX <= rackRect.right &&
        event.clientY >= rackRect.top &&
        event.clientY <= rackRect.bottom
      );
      if (!insideRack && !externalDragRef.current) {
        externalDragRef.current = true;
        onStartTileDrag(tile, event.clientX, event.clientY);
      }
    }
    if (!externalDragRef.current) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-rack-slot]');
      const targetSlot = target ? Number(target.dataset.rackSlot) : NaN;
      setDragOverSlot(Number.isInteger(targetSlot) && targetSlot !== draggedSlot ? targetSlot : null);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!externalDragRef.current && draggedSlot !== null && dragOverSlot !== null) {
      onSwapSlots(draggedSlot, dragOverSlot);
    }
    if (externalDragRef.current) onFinishTileDrag();
    pointerStartRef.current = null;
    setDraggedSlot(null);
    setDragOverSlot(null);
    setDragPosition(null);
    externalDragRef.current = false;
  };

  const handleTileClick = (tile: Tile) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (isMyTurn) onSelectTile(tile);
  };

  const draggedTile = draggedSlot !== null ? slots[draggedSlot] : null;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-2xl mx-auto px-4 pointer-events-auto">
      {draggedTile && dragPosition && (
        <div
          className="pointer-events-none fixed z-[100] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 rotate-3 scale-105 flex-col items-center justify-center rounded-xl border-2 border-amber-400 bg-amber-100 text-stone-900 shadow-2xl"
          style={{ left: dragPosition.x, top: dragPosition.y }}
          aria-hidden="true"
        >
          <span className="text-2xl font-black leading-none">{draggedTile.letter}</span>
          <span className="absolute bottom-1 right-1.5 text-[10px] font-bold text-stone-600">{draggedTile.value}</span>
        </div>
      )}
      {/* Action Buttons Toolbar */}
      <div className="flex items-center justify-between w-full bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/60 shadow-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancelMove}
            disabled={!isMyTurn || !hasTemporaryTiles || isSubmitting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm transition-all ${
              isMyTurn && hasTemporaryTiles
                ? 'bg-rose-950/70 text-rose-300 hover:bg-rose-900 border border-rose-700/50 cursor-pointer shadow-sm'
                : 'bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          <button
            onClick={onPassTurn}
            disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm transition-all ${
              isMyTurn && !hasTemporaryTiles
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/60 cursor-pointer shadow-sm'
                : 'bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed'
            }`}
          >
            <SkipForward className="w-4 h-4" />
            <span>Pass</span>
          </button>

          <button
            onClick={onShuffleRack}
            disabled={!isMyTurn || tileCount < 2 || isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm text-slate-300 hover:text-white hover:bg-slate-700 disabled:text-slate-600 disabled:cursor-not-allowed border border-slate-600/60 transition-all"
            title="Shuffle rack"
            aria-label="Shuffle rack"
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>
        </div>

        {/* Move preview / Points badge */}
        {hasTemporaryTiles && estimatedScore !== undefined && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-semibold animate-pulse">
            <span>PREVIEW:</span>
            <span className="text-amber-200 font-bold text-sm">+{estimatedScore} pts</span>
          </div>
        )}

        {/* Confirm Move */}
        <button
          onClick={onConfirmMove}
          disabled={!isMyTurn || !hasTemporaryTiles || isSubmitting}
          className={`flex items-center gap-2 px-5 py-1.5 rounded-xl font-semibold text-sm transition-all ${
            isMyTurn && hasTemporaryTiles
              ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 shadow-lg shadow-emerald-950/50 cursor-pointer border border-emerald-400/30'
              : 'bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{isSubmitting ? 'Confirming...' : 'Confirm Move'}</span>
        </button>
      </div>

      {/* Tiles Rack Stand — seats are fixed, an empty seat stays put instead of closing up */}
      <div ref={rackRef} className={`relative flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-b from-amber-950/70 to-amber-900/90 backdrop-blur-md rounded-2xl border-2 shadow-2xl shadow-amber-950/40 min-h-[82px] ${isExternalDragActive ? 'border-sky-400/80 ring-2 ring-sky-400/30' : 'border-amber-700/50'}`}>
        {slots.map((tile, slotIndex) => {
          if (!tile) {
            const isDropTarget = dragOverSlot === slotIndex;
            return (
              <div
                key={`slot-${slotIndex}`}
                data-rack-slot={slotIndex}
                aria-hidden="true"
                className={`relative w-11 h-12 sm:w-13 sm:h-14 rounded-xl border border-black/40 bg-amber-950/80 shadow-[inset_0_2px_5px_rgba(0,0,0,0.65)] transition-all ${
                  isDropTarget
                    ? 'ring-2 ring-sky-400/90'
                    : isExternalDragActive
                    ? 'ring-1 ring-sky-400/40'
                    : ''
                }`}
              >
                <span className="absolute inset-[7px] rounded-md border border-dashed border-amber-200/15" />
              </div>
            );
          }

          const isSelected = selectedTileId === tile.id;
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
              disabled={!isMyTurn}
              className={`group relative flex flex-col items-center justify-center w-11 h-12 sm:w-13 sm:h-14 rounded-xl font-sans transition-all select-none touch-none ${
                isDragging
                  ? 'z-10 scale-105 -translate-y-2 opacity-30 bg-amber-200 border-2 border-amber-400 shadow-xl shadow-amber-500/40 cursor-grabbing'
                  : isDropTarget
                  ? 'translate-x-1 ring-2 ring-sky-400/80'
                  : isSelected
                  ? '-translate-y-3 bg-amber-200 border-2 border-amber-500 shadow-amber-500/40 ring-4 ring-amber-400/40'
                  : isMyTurn
                  ? 'bg-amber-100 hover:bg-amber-50 active:translate-y-0.5 border border-amber-600/40 hover:-translate-y-1 cursor-pointer'
                  : 'bg-amber-100/50 border border-amber-700/30 opacity-70 cursor-not-allowed'
              } shadow-md`}
            >
              <span className="text-xl sm:text-2xl font-black text-stone-900 leading-none">
                {tile.letter}
              </span>
              <span className="absolute bottom-1 right-1.5 text-[9px] sm:text-[10px] font-bold text-stone-600">
                {tile.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
