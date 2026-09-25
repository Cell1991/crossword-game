'use client';

import { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BoardCell, CellPosition, PlacedTile, Tile } from '@/lib/types';
import { isCellCommitted } from '@/lib/tiles';
import { moveFixedElement } from '@/lib/dom';

export interface DragSession {
  tile: Tile;
  source: 'rack' | 'board';
  origin: CellPosition | null;
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
}

const isInside = (rect: DOMRect | null, x: number, y: number): rect is DOMRect => Boolean(
  rect && x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
);

/**
 * Dragging a tile across the page: from the rack onto the board, between board cells, or from
 * the board back to the rack. The rack's own seat-to-seat drags stay inside TileRack.
 *
 * Pointer moves never re-render: the floating tile is moved directly (see `ghostRef`) and React
 * only hears about the drag when it starts, ends, or crosses into another board cell.
 */
export function useTileDrag(options: UseTileDragOptions) {
  const { canStageMove, boardState, temporaryTiles, boardRef, rackRef, deselectTile } = options;
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [dragHoverCell, setDragHoverCell] = useState<CellPosition | null>(null);
  /** The floating tile that follows the pointer. */
  const ghostRef = useRef<HTMLDivElement>(null);
  // Refs mirror the drag so the handlers stay stable and see it the moment it changes.
  const sessionRef = useRef<DragSession | null>(null);
  const hoverCellRef = useRef<CellPosition | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
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
      moveFixedElement(ghostRef.current, position.x, position.y);
      const nextCell = cellUnderPointer(position.x, position.y);
      const previous = hoverCellRef.current;
      if (previous?.row === nextCell?.row && previous?.col === nextCell?.col) return;
      hoverCellRef.current = nextCell;
      setDragHoverCell(nextCell);
    });
  }, [cellUnderPointer]);

  const endDrag = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    sessionRef.current = null;
    hoverCellRef.current = null;
    setDragSession(null);
    setDragHoverCell(null);
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
      if (session.source === 'board') {
        const droppedSeat = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-rack-slot]');
        const targetSlot = droppedSeat ? Number(droppedSeat.dataset.rackSlot) : NaN;
        latest.seatReturningTile(session.tile.id, Number.isInteger(targetSlot) ? targetSlot : 0);
        latest.unstageTile(session.tile.id);
      }
      return;
    }
    if (!targetCell) return;

    const occupiedByCommitted = isCellCommitted(latest.boardState, targetCell.row, targetCell.col);
    const occupiedByPending = latest.temporaryTiles.some(tile =>
      tile.row === targetCell.row &&
      tile.col === targetCell.col &&
      !(session.source === 'board' && tile.tile_id === session.tile.id)
    );
    const targetPendingTile = latest.temporaryTiles.find(tile =>
      tile.row === targetCell.row &&
      tile.col === targetCell.col &&
      tile.tile_id !== session.tile.id
    );

    if (session.source === 'board' && session.origin && targetPendingTile && !occupiedByCommitted) {
      latest.swapStagedTiles(session.tile.id, session.origin, targetPendingTile);
    } else if (!occupiedByCommitted && !occupiedByPending) {
      latest.stageTile(session.tile, targetCell);
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

  const startRackDrag = useCallback((tile: Tile, clientX: number, clientY: number) => {
    if (!canStageMove) return;
    deselectTile();
    beginDrag({ tile, source: 'rack', origin: null, start: { x: clientX, y: clientY } });
  }, [beginDrag, canStageMove, deselectTile]);

  const startPendingDrag = useCallback((tile: PlacedTile, clientX: number, clientY: number) => {
    if (!canStageMove) return;
    beginDrag({
      tile: { id: tile.tile_id, letter: tile.letter, value: tile.value },
      source: 'board',
      origin: { row: tile.row, col: tile.col },
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
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [endDrag, finishDrag, isDragging, updateDragHover]);

  const dragHoverIsValid = useMemo(() => {
    if (!dragSession || !dragHoverCell) return null;
    const committed = isCellCommitted(boardState, dragHoverCell.row, dragHoverCell.col);
    const pending = temporaryTiles.some(tile =>
      tile.row === dragHoverCell.row &&
      tile.col === dragHoverCell.col &&
      !(dragSession.source === 'board' && tile.tile_id === dragSession.tile.id)
    );
    return !committed && (!pending || dragSession.source === 'board');
  }, [boardState, dragHoverCell, dragSession, temporaryTiles]);

  return {
    dragSession,
    dragHoverCell,
    dragHoverIsValid,
    ghostRef,
    updateDragHover,
    finishDrag,
    cancelDrag: endDrag,
    startRackDrag,
    startPendingDrag,
  };
}
