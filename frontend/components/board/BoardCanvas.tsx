'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { BoardCell, PlacedTile } from '../../lib/types';
import { useBoardCamera } from '../../hooks/useBoardCamera';

interface BoardCanvasProps {
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  remotePlacements: { row: number; col: number }[];
  temporaryTilesValid: boolean | null;
  selectedCell: { row: number; col: number } | null;
  onCellClick: (row: number, col: number) => void;
  isMyTurn: boolean;
  camera: ReturnType<typeof useBoardCamera>;
}

const BOARD_SIZE = 15;
const CENTER_ROW = 7;
const CENTER_COL = 7;

export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  boardState,
  temporaryTiles,
  remotePlacements,
  temporaryTilesValid,
  selectedCell,
  onCellClick,
  isMyTurn,
  camera,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    scale,
    offset,
    setOffset,
    isPanning,
    setIsPanning,
    lastMousePos,
    cellSize,
    baseCellSize,
    screenToCell,
    centerBoard,
  } = camera;

  // Resize canvas to container
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      canvasRef.current.width = clientWidth * window.devicePixelRatio;
      canvasRef.current.height = clientHeight * window.devicePixelRatio;
      canvasRef.current.style.width = `${clientWidth}px`;
      canvasRef.current.style.height = `${clientHeight}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial center board
  useEffect(() => {
    if (containerRef.current) {
      centerBoard(containerRef.current.clientWidth, containerRef.current.clientHeight);
    }
  }, [centerBoard]);

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

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Board bounding rectangle
    const totalBoardPx = BOARD_SIZE * cellSize;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(offset.x, offset.y, totalBoardPx, totalBoardPx);

    // Viewport bounds in cell coordinates (culling)
    const minCol = Math.max(0, Math.floor(-offset.x / cellSize));
    const maxCol = Math.min(BOARD_SIZE - 1, Math.ceil((width - offset.x) / cellSize));
    const minRow = Math.max(0, Math.floor(-offset.y / cellSize));
    const maxRow = Math.min(BOARD_SIZE - 1, Math.ceil((height - offset.y) / cellSize));

    // Draw Grid Lines & Cell Backgrounds
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const x = offset.x + c * cellSize;
        const y = offset.y + r * cellSize;

        // Is Center cell
        const isCenter = r === CENTER_ROW && c === CENTER_COL;
        const isTriple = (r === 0 && c === 7) || (r === 1 && (c === 1 || c === 13)) ||
          (r === 7 && (c === 0 || c === 14)) || (r === 13 && (c === 1 || c === 13)) ||
          (r === 14 && c === 7);
        const isDouble = (r === 2 && (c === 5 || c === 9)) || (r === 4 && c === 7) ||
          (r === 5 && (c === 2 || c === 12)) || (r === 7 && (c === 4 || c === 10)) ||
          (r === 9 && (c === 2 || c === 12)) || (r === 10 && c === 7) ||
          (r === 12 && (c === 5 || c === 9));
        const isPower = (r === 2 && (c === 2 || c === 12)) || (r === 4 && (c === 4 || c === 10)) ||
          (r === 10 && (c === 4 || c === 10)) || (r === 12 && (c === 2 || c === 12));
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
      if (pt.row >= minRow && pt.row <= maxRow && pt.col >= minCol && pt.col <= maxCol) {
        drawTile(ctx, pt.row, pt.col, pt.letter, pt.value, true);
      }
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
    ctx.strokeRect(offset.x, offset.y, totalBoardPx, totalBoardPx);

    ctx.restore();
  }, [offset, cellSize, boardState, temporaryTiles, selectedCell]);

  const drawTile = (
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

    // Tile Shadow
    ctx.fillStyle = isTemporary ? 'rgba(245, 158, 11, 0.35)' : 'rgba(0, 0, 0, 0.4)';
    drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
    ctx.fill();

    // Tile Body
    ctx.fillStyle = isRemote
      ? '#cbd5e1'
      : isTemporary
      ? (temporaryTilesValid === false ? '#fecaca' : temporaryTilesValid === true ? '#bbf7d0' : '#fef08a')
      : '#fef3c7';
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.fill();

    // Tile Border
    ctx.strokeStyle = isTemporary ? '#d97706' : '#b45309';
    ctx.lineWidth = isTemporary ? 2 : 1;
    ctx.stroke();

    // Tile Letter
    if (showLetter && cellSize >= 12) {
      ctx.fillStyle = '#1c1917';
      ctx.font = `bold ${Math.max(10, cellSize * 0.52)}px 'Geist', 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, x + cellSize / 2, y + cellSize / 2 - (cellSize >= 20 ? 1 : 0));

      // Tile Point Value Subscript
      if (cellSize >= 24) {
        ctx.fillStyle = '#78716c';
        ctx.font = `bold ${Math.max(8, cellSize * 0.22)}px 'Geist', sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${value}`, x + cellSize - pad * 2 - 1, y + cellSize - pad * 2);
      }
    }
  };

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  useEffect(() => {
    let animId: number;
    const loop = () => {
      render();
      animId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [render]);

  // Mouse Handlers for Pan & Placement
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      setIsPanning(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      const dist = Math.hypot(e.clientX - lastMousePos.current.x, e.clientY - lastMousePos.current.y);
      setIsPanning(false);

      // If clicked without significant drag, trigger cell click
      if (dist < 5) {
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
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    camera.zoomAtPoint(e.deltaY, mouseX, mouseY);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-zinc-950"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
    </div>
  );
};
