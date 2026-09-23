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

const POWER_CELLS = [...SECRET_POWER].map((key) => key.split('_').map(Number) as [number, number]);
const DOUBLE_CELLS = [...DOUBLE_LETTER].map((key) => key.split('_').map(Number) as [number, number]);
const TRIPLE_CELLS = [...TRIPLE_LETTER].map((key) => key.split('_').map(Number) as [number, number]);

const getCellAlpha = (row: number, col: number): number => {
  const dx = (col - CENTER_COL) / 13.0;
  const dy = (row - CENTER_ROW) / 9.0;
  const norm = Math.hypot(dx, dy); // 0 at center (9,13), 1.0 at 27x19 board edge midpoints

  // Playable 27x19 board area is 100% solid visible
  if (norm <= 0.95) return 1.0;

  // Extended grid lines beyond 27x19 fade out smoothly into space
  const t = (norm - 0.95) / 1.15;
  return Math.max(0, Math.min(1, 1 - Math.pow(Math.max(0, t), 1.4)));
};

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
  frozenTile?: { row: number; col: number } | null;
  hintCell?: { row: number; col: number } | null;
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
  frozenTile = null,
  hintCell = null,
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
    setViewport,
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
      setViewport(clientWidth, clientHeight);
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

    // Shadow layer
    ctx.fillStyle = isRemote ? 'rgba(0,0,0,0.3)' : 'rgba(0, 0, 0, 0.4)';
    drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
    ctx.fill();

    // Is this tile in a golden state? (Both confirmed/committed tiles AND valid temporary tiles)
    const isGolden = !isRemote && (!isTemporary || temporaryTilesValid === true);

    // Tile face fill
    if (isRemote) {
      ctx.fillStyle = '#cbd5e1';
    } else if (isGolden) {
      // Confirmed on board OR Valid temporary move → radiant golden amber gradient
      const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      grad.addColorStop(0, '#fde68a');
      grad.addColorStop(0.4, '#f1b824');
      grad.addColorStop(1, '#d97706');
      ctx.fillStyle = grad;
    } else {
      // In-progress / unverified placement on board → natural navy gradient
      const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      grad.addColorStop(0, '#23407a');
      grad.addColorStop(0.5, '#1a305e');
      grad.addColorStop(1, '#122244');
      ctx.fillStyle = grad;
    }
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.fill();

    // Stroke
    if (isRemote) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
    } else if (isGolden) {
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = isTemporary ? 1.8 : 1.2;
    } else {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();

    if (showLetter && cellSize >= 12) {
      // Dark text on golden & remote tiles, white text on navy in-progress tiles
      ctx.fillStyle = isGolden || isRemote ? '#0f172a' : '#ffffff';
      const fontSize = Math.max(12, Math.round(cellSize * 0.70));
      ctx.font = `${fontSize}px 'QuakDuck', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textX = Math.round(x + cellSize / 2);
      const textY = Math.round(y + cellSize / 2 - (cellSize >= 20 ? 1 : 0));
      ctx.fillText(letter, textX, textY);

      if (cellSize >= 24) {
        ctx.fillStyle = isGolden || isRemote ? '#334155' : 'rgba(226, 232, 240, 0.85)';
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

    // Board bounding rectangle. The surface texture lives in a DOM layer below this canvas.
    const boardWidthPx = BOARD_COLS * cellSize;
    const boardHeightPx = BOARD_ROWS * cellSize;

    // Viewport bounds in cell coordinates (extending grid lines far beyond 27x19 board)
    const EXTEND_MARGIN_COLS = 16;
    const EXTEND_MARGIN_ROWS = 12;
    const minCol = Math.max(-EXTEND_MARGIN_COLS, Math.floor(-offset.x / cellSize));
    const maxCol = Math.min(BOARD_COLS + EXTEND_MARGIN_COLS, Math.ceil((width - offset.x) / cellSize));
    const minRow = Math.max(-EXTEND_MARGIN_ROWS, Math.floor(-offset.y / cellSize));
    const maxRow = Math.min(BOARD_ROWS + EXTEND_MARGIN_ROWS, Math.ceil((height - offset.y) / cellSize));

    // Draw Extended Grid Lines & Cell Backgrounds
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const x = offset.x + c * cellSize;
        const y = offset.y + r * cellSize;
        const lineAlpha = getCellAlpha(r, c);

        if (lineAlpha <= 0.005) continue;

        ctx.save();
        ctx.globalAlpha = lineAlpha;

        // Special cell fills and Center Star (only for 27x19 playable board cells)
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
          const cellKey = `${r}_${c}`;
          const isCenter = r === CENTER_ROW && c === CENTER_COL;
          const isTriple = TRIPLE_LETTER.has(cellKey);
          const isDouble = DOUBLE_LETTER.has(cellKey);
          const isPower = SECRET_POWER.has(cellKey);
          const specialRadius = Math.max(3, cellSize * 0.12);

          if (isTriple) {
            ctx.fillStyle = '#7f1d1d';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          } else if (isDouble) {
            ctx.fillStyle = '#854d0e';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          } else if (isPower) {
            ctx.fillStyle = '#075985';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          }
          if (isCenter) {
            ctx.fillStyle = '#1e1b4b'; // Soft indigo center
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          }

          if (isCenter && cellSize >= 16) {
            ctx.fillStyle = '#fbbf24';
            ctx.font = `${Math.max(10, cellSize * 0.45)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', x + cellSize / 2, y + cellSize / 2);
          }
        }

        // Extended Grid lines
        ctx.strokeStyle = 'rgba(245, 190, 72, 0.24)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellSize, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + cellSize);
        ctx.stroke();

        ctx.restore();
      }
    }

    // Draw Committed Tiles
    for (const key in boardState) {
      const cell = boardState[key];
      if (cell.row >= minRow && cell.row <= maxRow && cell.col >= minCol && cell.col <= maxCol) {
        drawTile(ctx, cell.row, cell.col, cell.letter, cell.value, false);
      }
    }

    // Freeze/Hint overlays
    if (frozenTile && frozenTile.row >= minRow && frozenTile.row <= maxRow && frozenTile.col >= minCol && frozenTile.col <= maxCol) {
      const x = offset.x + frozenTile.col * cellSize;
      const y = offset.y + frozenTile.row * cellSize;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
      if (cellSize >= 16) {
        ctx.font = `${Math.max(10, cellSize * 0.4)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❄️', x + cellSize / 2, y + cellSize * 0.24);
      }
    }
    if (hintCell && hintCell.row >= minRow && hintCell.row <= maxRow && hintCell.col >= minCol && hintCell.col <= maxCol) {
      const x = offset.x + hintCell.col * cellSize;
      const y = offset.y + hintCell.row * cellSize;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
      ctx.setLineDash([]);
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

    ctx.restore();
  }, [offset, cellSize, boardState, temporaryTiles, remotePlacements, selectedCell, drawTile, dragPreviewCell, dragPreviewTile, dragPreviewIsValid, draggingTileId, frozenTile, hintCell]);

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

  const isCellOccupied = (row: number, col: number) => (
    Object.values(boardState).some((cell) => cell.row === row && cell.col === col) ||
    temporaryTiles.some((tile) => tile.row === row && tile.col === col) ||
    remotePlacements.some((placement) => placement.row === row && placement.col === col)
  );

  const boardWidth = BOARD_COLS * cellSize;
  const boardHeight = BOARD_ROWS * cellSize;
  const boardEdgeFadeMask = 'radial-gradient(ellipse at center, black 10%, rgba(0, 0, 0, 0.65) 30%, rgba(0, 0, 0, 0.22) 50%, rgba(0, 0, 0, 0.03) 68%, transparent 82%)';

  const boardEdgeFade = {
    maskImage: boardEdgeFadeMask,
    WebkitMaskImage: boardEdgeFadeMask,
    maskSize: `${boardWidth}px ${boardHeight}px`,
    WebkitMaskSize: `${boardWidth}px ${boardHeight}px`,
    maskPosition: `${offset.x}px ${offset.y}px`,
    WebkitMaskPosition: `${offset.x}px ${offset.y}px`,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  } as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      // touch-none: the board handles one-finger pan and two-finger pinch itself, instead of the browser.
      className="relative w-full h-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing bg-transparent"
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
      <canvas ref={canvasRef} className="absolute inset-0 z-10 block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {POWER_CELLS.filter(([row, col]) => !isCellOccupied(row, col)).map(([row, col]) => {
          const alpha = getCellAlpha(row, col, camera.scale);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`power-${row}-${col}`}
              className="absolute rounded-sm border border-amber-300/35 bg-amber-400/10 shadow-[0_0_16px_rgba(251,191,36,0.3)] board-power-pulse"
              style={{
                left: offset.x + col * cellSize + 1,
                top: offset.y + row * cellSize + 1,
                width: cellSize - 2,
                height: cellSize - 2,
                borderRadius: `${Math.max(3, cellSize * 0.12)}px`,
                animationDelay: `${-((row * 5 + col * 3) % 13) / 10}s`,
                opacity: alpha,
              }}
            >
              <span className="board-lightning-halo absolute left-1/2 top-1/2 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
              <span className="absolute inset-0 flex items-center justify-center">
                <img
                  src="/light.png"
                  alt=""
                  className="board-lightning-logo h-[76%] w-[76%] object-contain"
                  style={{ animationDelay: `${-((row * 7 + col * 2) % 11) / 10}s` }}
                />
              </span>
              <i className="board-lightning-spark absolute left-[20%] top-[24%] h-1 w-1 rounded-full bg-amber-100" style={{ animationDelay: `${-((row + col) % 7) / 10}s` }} />
              <i className="board-lightning-spark absolute bottom-[20%] right-[20%] h-1 w-1 rounded-full bg-orange-100" style={{ animationDelay: `${-((row * 2 + col) % 9) / 10}s` }} />
            </span>
          );
        })}
        {TRIPLE_CELLS.filter(([row, col]) => !isCellOccupied(row, col)).map(([row, col]) => {
          const alpha = getCellAlpha(row, col, camera.scale);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`triple-${row}-${col}`}
              className="board-triple-aura absolute rounded-sm border border-red-300/60 bg-red-950/20"
              style={{
                left: offset.x + col * cellSize + 1,
                top: offset.y + row * cellSize + 1,
                width: cellSize - 2,
                height: cellSize - 2,
                borderRadius: `${Math.max(3, cellSize * 0.12)}px`,
                opacity: alpha,
              }}
            >
              <span className="board-fire-core absolute inset-[18%] rounded-full bg-red-400/40" />
              <span
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white"
                style={{ fontSize: `${Math.max(10, Math.min(20, cellSize * 0.32))}px` }}
              >
                3<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}
        {DOUBLE_CELLS.filter(([row, col]) => !isCellOccupied(row, col)).map(([row, col]) => {
          const alpha = getCellAlpha(row, col, camera.scale);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`double-${row}-${col}`}
              className="board-double-aura absolute rounded-sm border border-orange-300/45 bg-orange-400/10"
              style={{
                left: offset.x + col * cellSize + 1,
                top: offset.y + row * cellSize + 1,
                width: cellSize - 2,
                height: cellSize - 2,
                borderRadius: `${Math.max(3, cellSize * 0.12)}px`,
                opacity: alpha,
              }}
            >
              <span className="board-earth-glow absolute inset-[12%] rounded-full" />
              <span className="board-earth-mountain board-earth-mountain-back absolute inset-x-0 bottom-0 h-[70%]" />
              <span className="board-earth-mountain board-earth-mountain-front absolute inset-x-0 bottom-0 h-[62%]" />
              <i className="board-earth-speck absolute left-[22%] top-[27%] h-1 w-1 rounded-full" />
              <i className="board-earth-speck absolute right-[20%] top-[38%] h-1 w-1 rounded-full [animation-delay:0.7s]" />
              <span
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white"
                style={{ fontSize: `${Math.max(10, Math.min(20, cellSize * 0.32))}px` }}
              >
                2<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}
        {!isCellOccupied(CENTER_ROW, CENTER_COL) && (
          <span
            className="absolute rounded-sm border border-amber-300/35 shadow-[0_0_18px_rgba(251,191,36,0.25)] board-center-pulse"
            style={{ left: offset.x + CENTER_COL * cellSize + 1, top: offset.y + CENTER_ROW * cellSize + 1, width: cellSize - 2, height: cellSize - 2, borderRadius: `${Math.max(3, cellSize * 0.12)}px` }}
          />
        )}
      </div>
    </div>
  );
};
