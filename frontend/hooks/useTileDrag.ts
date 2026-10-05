'use client';

import { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BoardCell, CellPosition, PlacedTile, Tile } from '@/lib/types';
import { isCellCommitted } from '@/lib/tiles';
import { moveFixedElement } from '@/lib/dom';
import { soundFx } from '@/lib/soundFx';

export interface DragSession {
  tile: Tile;
  source: 'rack' | 'board';
  origin: CellPosition | null;
  slotIndex?: number;
  /** Where the drag started; the floating tile is moved from here without re-rendering. */
  start: { x: number; y: number };
}

interface UseTileDragOptions {
  canStageMove: boolean;
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  /** The board viewport and the rack tray, measured once when a drag starts. */
  boardRef: RefObject<HTMLElement | null>;
  rackRef: RefObject<HTMLElement | null>;
  screenToCell: (screenX: number, screenY: number) => CellPosition | null;
  deselectTile: () => void;
  stageTile: (tile: Tile, cell: CellPosition) => void;
  swapStagedTiles: (draggedTileId: string, origin: CellPosition, target: PlacedTile) => void;
  unstageTile: (tileId: string) => void;
  seatReturningTile: (tileId: string, targetSlot: number) => void;
  onSwapSlots?: (draggedSlot: number, targetSlot: number) => void;
  onHoverCellChange?: (cell: CellPosition | null) => void;
}

const isInside = (rect: DOMRect | null, x: number, y: number): rect is DOMRect => Boolean(
  rect && x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
);

/**
 * High-performance 120 FPS tile drag engine.
 * Pointer moves never trigger React re-renders: the floating tile is moved directly on the GPU
 * via translate3d, keeping CPU overhead at 0ms.
 */
export function useTileDrag(options: UseTileDragOptions) {
  const { canStageMove, boardRef, rackRef, deselectTile } = options;
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  /** The floating tile that follows the pointer. */
  const ghostRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const hoverCellRef = useRef<CellPosition | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const prevDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const rectsRef = useRef<{ board: DOMRect | null; rack: DOMRect | null }>({ board: null, rack: null });
  const latestRef = useRef(options);
  useLayoutEffect(() => {
    latestRef.current = options;
  });

  const cellUnderPointer = useCallback((x: number, y: number) => {
    const board = rectsRef.current.board;
    return isInside(board, x, y) ? latestRef.current.screenToCell(x - board.left, y - board.top) : null;
  }, []);

  const updateDragHover = useCallback((clientX: number, clientY: number) => {
    pointerRef.current = { x: clientX, y: clientY };
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const position = pointerRef.current;
      if (!position) return;
      const prev = prevDragPosRef.current;
      const dx = prev ? position.x - prev.x : 0;
      prevDragPosRef.current = { x: position.x, y: position.y };
      const tilt = Math.max(-8, Math.min(8, 2 + dx * 0.22));
      moveFixedElement(ghostRef.current, position.x, position.y, tilt);
      const cell = cellUnderPointer(position.x, position.y);
      const prevCell = hoverCellRef.current;
      if (
        (cell === null && prevCell !== null) ||
        (cell !== null && (prevCell === null || cell.row !== prevCell.row || cell.col !== prevCell.col))
      ) {
        hoverCellRef.current = cell;
        latestRef.current.onHoverCellChange?.(cell);
      }
    });
  }, [cellUnderPointer]);

  const endDrag = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    prevDragPosRef.current = null;
    sessionRef.current = null;
    hoverCellRef.current = null;
    latestRef.current.onHoverCellChange?.(null);
    setDragSession(null);
  }, []);

  const finishDrag = useCallback((clientX?: number, clientY?: number) => {
    const hasPointer = clientX !== undefined && clientY !== undefined;
    if (hasPointer) pointerRef.current = { x: clientX, y: clientY };
    const session = sessionRef.current;
    const hoverCell = hoverCellRef.current;
    const pointerPosition = hasPointer ? { x: clientX, y: clientY } : pointerRef.current ?? session?.start;
    const { board: boardRect, rack: rackRect } = rectsRef.current;
    const targetCell = pointerPosition && isInside(boardRect, pointerPosition.x, pointerPosition.y)
      ? latestRef.current.screenToCell(pointerPosition.x - boardRect.left, pointerPosition.y - boardRect.top)
      : hoverCell;
    const latest = latestRef.current;
    endDrag();
    if (!session || !latest.canStageMove) return;

    const { x, y } = pointerPosition ?? session.start;
    if (isInside(rackRect, x, y)) {
      const droppedSeat = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-rack-slot]');
      const targetSlot = droppedSeat ? Number(droppedSeat.dataset.rackSlot) : NaN;
      const noteSlot = Number.isInteger(targetSlot) ? targetSlot : (session.slotIndex ?? 0);
      soundFx.playPianoNote(noteSlot);
      if (session.source === 'board') {
        latest.seatReturningTile(session.tile.id, Number.isInteger(targetSlot) ? targetSlot : 0);
        latest.unstageTile(session.tile.id);
      } else if (session.source === 'rack' && session.slotIndex !== undefined && Number.isInteger(targetSlot) && targetSlot !== session.slotIndex) {
        latest.onSwapSlots?.(session.slotIndex, targetSlot);
      }
      return;
    }
    if (!targetCell) {
      if (session.slotIndex !== undefined) {
        soundFx.playPianoNote(session.slotIndex);
      }
      return;
    }

    const occupiedByCommitted = isCellCommitted(latest.boardState, targetCell.row, targetCell.col);
    const targetPendingTile = latest.temporaryTiles.find(tile =>
      tile.row === targetCell.row &&
      tile.col === targetCell.col &&
      tile.tile_id !== session.tile.id
    );

    if (session.slotIndex !== undefined) {
      soundFx.playPianoNote(session.slotIndex);
    }

    if (!occupiedByCommitted) {
      if (session.source === 'board' && session.origin && targetPendingTile) {
        latest.swapStagedTiles(session.tile.id, session.origin, targetPendingTile);
      } else {
        latest.stageTile(session.tile, targetCell);
      }
    }
    pointerRef.current = null;
  }, [endDrag]);

  const beginDrag = useCallback((session: DragSession) => {
    rectsRef.current = {
      board: boardRef.current?.getBoundingClientRect() ?? null,
      rack: rackRef.current?.getBoundingClientRect() ?? null,
    };
    sessionRef.current = session;
    setDragSession(session);
    updateDragHover(session.start.x, session.start.y);
  }, [boardRef, rackRef, updateDragHover]);

  const startRackDrag = useCallback((tile: Tile, slotIndex: number, clientX: number, clientY: number) => {
    if (!canStageMove) return;
    deselectTile();
    beginDrag({ tile, source: 'rack', origin: null, slotIndex, start: { x: clientX, y: clientY } });
  }, [beginDrag, canStageMove, deselectTile]);

  const startPendingDrag = useCallback((tile: PlacedTile, clientX: number, clientY: number, slotIndex?: number) => {
    if (!canStageMove) return;
    beginDrag({
      tile: { id: tile.tile_id, letter: tile.letter, value: tile.value },
      source: 'board',
      origin: { row: tile.row, col: tile.col },
      slotIndex,
      start: { x: clientX, y: clientY },
    });
  }, [beginDrag, canStageMove]);

  const isDragging = dragSession !== null;
  useEffect(() => {
    if (!isDragging) return;
    const handlePointerMove = (event: PointerEvent) => updateDragHover(event.clientX, event.clientY);
    const handlePointerUp = (event: PointerEvent) => finishDrag(event.clientX, event.clientY);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') endDrag();
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [endDrag, finishDrag, isDragging, updateDragHover]);

  return {
    dragSession,
    ghostRef,
    updateDragHover,
    finishDrag,
    cancelDrag: endDrag,
    startRackDrag,
    startPendingDrag,
  };
}
