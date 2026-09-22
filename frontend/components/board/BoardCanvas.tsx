'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { BoardCell, PlacedTile } from '../../lib/types';
import { useBoardCamera } from '../../hooks/useBoardCamera';
import {
  BOARD_COLS,
  BOARD_ROWS,
  CENTER_COL,
  CENTER_ROW,
  DOUBLE_LETTER,
  SECRET_POWER,
  TRIPLE_LETTER,
} from '../../lib/board';

interface BoardCanvasProps {
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  remotePlacements: { row: number; col: number }[];
  temporaryTilesValid: boolean | null;
  selectedCell: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  onStartPendingDrag: (tile: PlacedTile, clientX: number, clientY: number) => void;
  onFinishPendingDrag: (clientX?: number, clientY?: number) => void;
  onCollectPendingTile: (tileId: string) => void;
  onPendingDragMove: (clientX: number, clientY: number) => void;
  onViewportChange: (rect: { left: number; top: number; width: number; height: number }) => void;
  dragPreviewCell: { row: number; col: number } | null;
  draggingTileId: string | null;
  dragPreviewTile: { letter: string; value: number } | null;
  dragPreviewIsValid: boolean | null;
  canStageMove: boolean;
  camera: ReturnType<typeof useBoardCamera>;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  boardState,
  temporaryTiles,
  remotePlacements,
  temporaryTilesValid,
  selectedCell,
  onCellClick,
  onStartPendingDrag,
  onFinishPendingDrag,
  onCollectPendingTile,
  onPendingDragMove,
  onViewportChange,
  dragPreviewCell,
  draggingTileId,
  dragPreviewTile,
  dragPreviewIsValid,
  canStageMove,
  camera,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasCenteredBoardRef = useRef(false);
  const wheelFrameRef = useRef<number | null>(null);
  const pendingWheelRef = useRef<{ delta: number; x: number; y: number } | null>(null);
  const pendingPointerRef = useRef<{ tile: PlacedTile; x: number; y: number; pointerId: number } | null>(null);
  const pendingDragRef = useRef(false);
  /** Where the current pan started, and whether it has moved far enough to stop counting as a click. */
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panMovedRef = useRef(false);
  /** Fingers on the board. Two of them pinch: zoom by how far they spread, pan by how their midpoint moves. */
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; x: number; y: number } | null>(null);

  const {
    offset,
    setOffset,
    isPanning,
    setIsPanning,
    lastMousePos: lastMousePosRef,
    cellSize,
    screenToCell,
    centerBoard,
    zoomAtPoint,
    zoomBy,
  } = camera;

  const measurePinch = () => {
    const [a, b] = [...touchPointsRef.current.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  // Resize canvas to container
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      canvasRef.current.width = clientWidth * window.devicePixelRatio;
      canvasRef.current.height = clientHeight * window.devicePixelRatio;
      canvasRef.current.style.width = `${clientWidth}px`;
      canvasRef.current.style.height = `${clientHeight}px`;
      const rect = containerRef.current.getBoundingClientRect();
      onViewportChange({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onViewportChange]);

  // Initial center board
  useEffect(() => {
    if (containerRef.current && !hasCenteredBoardRef.current) {
      centerBoard(containerRef.current.clientWidth, containerRef.current.clientHeight);
      hasCenteredBoardRef.current = true;
    }
  }, [centerBoard]);

  function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const drawTile = useCallback((
    ctx: CanvasRenderingContext2D,
    row: number,
    col: number,
    letter: string,
    value: number,
    isTemporary: boolean,
    showLetter = true,
    isRemote = false
  ) => {
    const x = offset.x + col * cellSize;
    const y = offset.y + row * cellSize;
    const pad = Math.max(1, cellSize * 0.06);
    const tileW = cellSize - pad * 2;
    const radius = Math.max(2, cellSize * 0.12);

    ctx.fillStyle = isTemporary ? 'rgba(245, 158, 11, 0.35)' : 'rgba(0, 0, 0, 0.4)';
    drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
    ctx.fill();

    ctx.fillStyle = isRemote
      ? '#cbd5e1'
      : isTemporary
      ? (temporaryTilesValid === false ? '#fecaca' : temporaryTilesValid === true ? '#bbf7d0' : '#fef08a')
      : '#fef3c7';
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.fill();

    ctx.strokeStyle = isTemporary ? '#d97706' : '#b45309';
    ctx.lineWidth = isTemporary ? 2 : 1;
    ctx.stroke();

    if (showLetter && cellSize >= 12) {
      ctx.fillStyle = '#1c1917';
      ctx.font = `bold ${Math.max(10, cellSize * 0.52)}px 'Geist', 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, x + cellSize / 2, y + cellSize / 2 - (cellSize >= 20 ? 1 : 0));

      if (cellSize >= 24) {
        ctx.fillStyle = '#78716c';
        ctx.font = `bold ${Math.max(8, cellSize * 0.22)}px 'Geist', sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${value}`, x + cellSize - pad * 2 - 1, y + cellSize - pad * 2);
      }
    }
  }, [offset, cellSize, temporaryTilesValid]);

  // Render Loop with Viewport Culling
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background transparently to reveal background ParticleField (floating letters)
    ctx.clearRect(0, 0, width, height);

    // Board bounding rectangle
    const boardWidthPx = BOARD_COLS * cellSize;
    const boardHeightPx = BOARD_ROWS * cellSize;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(offset.x, offset.y, boardWidthPx, boardHeightPx);

    // Viewport bounds in cell coordinates (culling)
    const minCol = Math.max(0, Math.floor(-offset.x / cellSize));
    const maxCol = Math.min(BOARD_COLS - 1, Math.ceil((width - offset.x) / cellSize));
    const minRow = Math.max(0, Math.floor(-offset.y / cellSize));
    const maxRow = Math.min(BOARD_ROWS - 1, Math.ceil((height - offset.y) / cellSize));

    // Draw Grid Lines & Cell Backgrounds
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const x = offset.x + c * cellSize;
        const y = offset.y + r * cellSize;
        const cellKey = `${r}_${c}`;

        // Is Center cell
        const isCenter = r === CENTER_ROW && c === CENTER_COL;
        const isTriple = TRIPLE_LETTER.has(cellKey);
        const isDouble = DOUBLE_LETTER.has(cellKey);
        const isPower = SECRET_POWER.has(cellKey);
        if (isTriple) {
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(x, y, cellSize, cellSize);
        } else if (isDouble) {
          ctx.fillStyle = '#854d0e';
          ctx.fillRect(x, y, cellSize, cellSize);
        } else if (isPower) {
          ctx.fillStyle = '#075985';
          ctx.fillRect(x, y, cellSize, cellSize);
        }
        if (isCenter) {
          ctx.fillStyle = '#1e1b4b'; // Soft indigo center
          ctx.fillRect(x, y, cellSize, cellSize);
        }

        // Cell borders
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Center Star / Symbol
        if (isCenter && cellSize >= 16) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = `${Math.max(10, cellSize * 0.45)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', x + cellSize / 2, y + cellSize / 2);
        } else if ((isTriple || isDouble || isPower) && cellSize >= 16) {
          ctx.fillStyle = '#f8fafc';
          ctx.font = `${Math.max(8, cellSize * 0.28)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(isPower ? '⚡' : isTriple ? '3L' : '2L', x + cellSize / 2, y + cellSize / 2);
        }
      }
    }

    // Draw Committed Tiles
    for (const key in boardState) {
      const cell = boardState[key];
      if (cell.row >= minRow && cell.row <= maxRow && cell.col >= minCol && cell.col <= maxCol) {
        drawTile(ctx, cell.row, cell.col, cell.letter, cell.value, false);
      }
    }

    // Draw Temporary Placed Tiles
    for (const pt of temporaryTiles) {
      if (pt.tile_id === draggingTileId) continue;
      if (pt.row >= minRow && pt.row <= maxRow && pt.col >= minCol && pt.col <= maxCol) {
        drawTile(ctx, pt.row, pt.col, pt.letter, pt.value, true);
      }
    }

    if (dragPreviewCell && dragPreviewTile) {
      drawTile(ctx, dragPreviewCell.row, dragPreviewCell.col, dragPreviewTile.letter, dragPreviewTile.value, true);
      const previewX = offset.x + dragPreviewCell.col * cellSize;
      const previewY = offset.y + dragPreviewCell.row * cellSize;
      ctx.strokeStyle = dragPreviewIsValid ? '#38bdf8' : '#f87171';
      ctx.lineWidth = 3;
      ctx.strokeRect(previewX + 1, previewY + 1, cellSize - 2, cellSize - 2);
    }

    for (const placement of remotePlacements) {
      if (placement.row >= minRow && placement.row <= maxRow && placement.col >= minCol && placement.col <= maxCol) {
        drawTile(ctx, placement.row, placement.col, '', 0, true, false, true);
      }
    }

    // Highlight Selected Cell
    if (selectedCell && selectedCell.row >= minRow && selectedCell.row <= maxRow && selectedCell.col >= minCol && selectedCell.col <= maxCol) {
      const sx = offset.x + selectedCell.col * cellSize;
      const sy = offset.y + selectedCell.row * cellSize;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2);
    }

    // Board Outer Border
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(offset.x, offset.y, boardWidthPx, boardHeightPx);

    ctx.restore();
  }, [offset, cellSize, boardState, temporaryTiles, remotePlacements, selectedCell, drawTile, dragPreviewCell, dragPreviewTile, dragPreviewIsValid, draggingTileId]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    loop();
    // Only the render loop is stopped here: this effect re-runs on every board change, and cancelling a
    // pending wheel frame from here left wheelFrameRef set, which silently disabled zooming for good.
    return () => cancelAnimationFrame(animId);
  }, [render]);

  // Pending tiles wait for movement before entering drag mode. A click collects
  // immediately; committed tiles never enter this path.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPointsRef.current.size >= 2) {
        // A second finger turns the gesture into a pinch, unless a tile is already being dragged.
        if (touchPointsRef.current.size === 2 && !pendingDragRef.current) {
          pendingPointerRef.current = null;
          panMovedRef.current = true;
          setIsPanning(false);
          pinchRef.current = measurePinch();
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        return;
      }
    }
    if (e.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cell = screenToCell(e.clientX - rect.left, e.clientY - rect.top);
    const pendingTile = cell && temporaryTiles.find(tile => tile.row === cell.row && tile.col === cell.col);
    if (pendingTile && canStageMove) {
      e.preventDefault();
      pendingPointerRef.current = {
        tile: pendingTile,
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
      };
      pendingDragRef.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panMovedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && touchPointsRef.current.has(e.pointerId)) {
      touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchRef.current;
      if (pinch && touchPointsRef.current.size >= 2) {
        const next = measurePinch();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setOffset((prev) => ({ x: prev.x + next.x - pinch.x, y: prev.y + next.y - pinch.y }));
          if (pinch.distance > 0) zoomBy(next.distance / pinch.distance, next.x - rect.left, next.y - rect.top);
        }
        pinchRef.current = next;
        return;
      }
    }
    const pendingPointer = pendingPointerRef.current;
    if (pendingPointer && !pendingDragRef.current) {
      const distance = Math.hypot(e.clientX - pendingPointer.x, e.clientY - pendingPointer.y);
      if (distance >= 6) {
        pendingDragRef.current = true;
        onStartPendingDrag(pendingPointer.tile, e.clientX, e.clientY);
      }
    }
    if (pendingDragRef.current) onPendingDragMove(e.clientX, e.clientY);
    if (isPanning) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      const start = panStartRef.current;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 5) panMovedRef.current = true;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      touchPointsRef.current.delete(e.pointerId);
      if (pinchRef.current) {
        // Lifting a finger ends the pinch; the finger still down does not start a pan or a click.
        if (touchPointsRef.current.size < 2) pinchRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        return;
      }
    }
    const pendingPointer = pendingPointerRef.current;
    if (pendingPointer) {
      if (e.currentTarget.hasPointerCapture(pendingPointer.pointerId)) {
        e.currentTarget.releasePointerCapture(pendingPointer.pointerId);
      }
      pendingPointerRef.current = null;
      if (pendingDragRef.current) {
        pendingDragRef.current = false;
        onFinishPendingDrag(e.clientX, e.clientY);
        return;
      }
      onCollectPendingTile(pendingPointer.tile.tile_id);
      return;
    }
    if (isPanning) {
      setIsPanning(false);

      // A press that never moved away from where it started is a cell click; a pan is not.
      const start = panStartRef.current ?? { x: e.clientX, y: e.clientY };
      if (!panMovedRef.current && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          const cell = screenToCell(clickX, clickY);
          if (cell) {
            onCellClick(cell.row, cell.col);
          }
        }
      }
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Some mice report lines or pages instead of pixels; convert so every device zooms at the same speed.
    const deltaPixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * rect.height : e.deltaY;
    // Add up every wheel event in this frame: zoom follows the total distance scrolled, not a fixed step.
    pendingWheelRef.current = {
      delta: (pendingWheelRef.current?.delta ?? 0) + deltaPixels,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    if (wheelFrameRef.current !== null) return;
    wheelFrameRef.current = requestAnimationFrame(() => {
      const pendingWheel = pendingWheelRef.current;
      // Cap one frame's zoom so a fast flick of a free-spinning wheel does not jump straight to the limit.
      if (pendingWheel) zoomAtPoint(Math.max(-300, Math.min(300, pendingWheel.delta)), pendingWheel.x, pendingWheel.y);
      pendingWheelRef.current = null;
      wheelFrameRef.current = null;
    });
  }, [zoomAtPoint]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelFrameRef.current !== null) cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
      pendingWheelRef.current = null;
    };
  }, [handleWheel]);

  return (
    <div
      ref={containerRef}
      // touch-none: the board handles one-finger pan and two-finger pinch itself, instead of the browser.
      className="relative w-full h-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing bg-zinc-950"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={(e) => {
        touchPointsRef.current.delete(e.pointerId);
        if (touchPointsRef.current.size < 2) pinchRef.current = null;
        pendingPointerRef.current = null;
        pendingDragRef.current = false;
        setIsPanning(false);
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
    </div>
  );
};
