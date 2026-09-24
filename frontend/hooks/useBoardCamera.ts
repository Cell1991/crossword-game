'use client';

import { useState, useCallback, useRef } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '../lib/board';

export interface Offset {
  x: number;
  y: number;
}

const BASE_CELL_SIZE = 40;
// Balanced zoom limit to prevent zooming out too far away
const MIN_SCALE = 0.52;
const MAX_SCALE = 1.8;
const DEFAULT_SCALE = 1;
/** Zoom follows how far the wheel/trackpad moved (no fixed steps): a mouse-wheel notch (100px) is about 14%. */
const WHEEL_ZOOM_SPEED = 0.0015;
/** The zoom buttons change the zoom by 20% per press. */
export const BUTTON_ZOOM_FACTOR = 1.2;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function clampOffset(
  offset: Offset,
  scale: number,
  viewportWidth: number,
  viewportHeight: number
): Offset {
  const boardWidth = BOARD_COLS * BASE_CELL_SIZE * scale;
  const boardHeight = BOARD_ROWS * BASE_CELL_SIZE * scale;

  // Minimum pixels of board that must remain visible on screen
  const marginX = Math.min(viewportWidth * 0.35, boardWidth * 0.5);
  const marginY = Math.min(viewportHeight * 0.35, boardHeight * 0.5);

  // board left edge (offset.x) can go as far right as (viewport - margin)
  // board right edge (offset.x + boardWidth) must stay at least marginX from left
  const minX = marginX - boardWidth;
  const maxX = viewportWidth - marginX;
  const minY = marginY - boardHeight;
  const maxY = viewportHeight - marginY;

  return {
    x: Math.min(maxX, Math.max(minX, offset.x)),
    y: Math.min(maxY, Math.max(minY, offset.y)),
  };
}

export function useBoardCamera() {
  const viewportRef = useRef({ width: 1200, height: 800 });
  const [view, setView] = useState({ scale: DEFAULT_SCALE, offset: { x: 0, y: 0 } as Offset });
  const { scale, offset } = view;
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const setViewport = useCallback((width: number, height: number) => {
    if (width > 0 && height > 0) {
      viewportRef.current = { width, height };
    }
  }, []);

  const setOffset = useCallback((update: Offset | ((previous: Offset) => Offset)) => {
    setView((previous) => {
      const nextRaw = typeof update === 'function' ? update(previous.offset) : update;
      const clamped = clampOffset(nextRaw, previous.scale, viewportRef.current.width, viewportRef.current.height);
      return {
        ...previous,
        offset: clamped,
      };
    });
  }, []);

  const centerBoard = useCallback((viewportWidth: number, viewportHeight: number) => {
    if (viewportWidth > 0 && viewportHeight > 0) {
      viewportRef.current = { width: viewportWidth, height: viewportHeight };
    }
    setView((previous) => {
      const cellSize = BASE_CELL_SIZE * previous.scale;
      const rawOffset = {
        x: (viewportWidth - BOARD_COLS * cellSize) / 2,
        y: (viewportHeight - BOARD_ROWS * cellSize) / 2,
      };
      return {
        ...previous,
        offset: clampOffset(rawOffset, previous.scale, viewportWidth, viewportHeight),
      };
    });
  }, []);

  const resetCamera = useCallback((viewportWidth: number, viewportHeight: number) => {
    if (viewportWidth > 0 && viewportHeight > 0) {
      viewportRef.current = { width: viewportWidth, height: viewportHeight };
    }
    const cellSize = BASE_CELL_SIZE * DEFAULT_SCALE;
    const rawOffset = {
      x: (viewportWidth - BOARD_COLS * cellSize) / 2,
      y: (viewportHeight - BOARD_ROWS * cellSize) / 2,
    };
    setView({
      scale: DEFAULT_SCALE,
      offset: clampOffset(rawOffset, DEFAULT_SCALE, viewportWidth, viewportHeight),
    });
  }, []);

  /** Multiplies the zoom by `factor`, keeping the board point under (clientX, clientY) under it. */
  const zoomBy = useCallback((factor: number, clientX: number, clientY: number) => {
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return;
    setView((previous) => {
      const newScale = clampScale(previous.scale * factor);
      const ratio = newScale / previous.scale;
      if (ratio === 1) return previous;
      const rawOffset = {
        x: clientX - (clientX - previous.offset.x) * ratio,
        y: clientY - (clientY - previous.offset.y) * ratio,
      };
      const clamped = clampOffset(rawOffset, newScale, viewportRef.current.width, viewportRef.current.height);
      return {
        scale: newScale,
        offset: clamped,
      };
    });
  }, []);

  /** Wheel zoom: scrolling down (positive delta, in pixels) zooms out, in proportion to the distance scrolled. */
  const zoomAtPoint = useCallback((delta: number, clientX: number, clientY: number) => {
    zoomBy(Math.exp(-delta * WHEEL_ZOOM_SPEED), clientX, clientY);
  }, [zoomBy]);

  const screenToCell = useCallback((screenX: number, screenY: number): { row: number; col: number } | null => {
    const cellSize = BASE_CELL_SIZE * scale;
    const boardX = screenX - offset.x;
    const boardY = screenY - offset.y;

    const col = Math.floor(boardX / cellSize);
    const row = Math.floor(boardY / cellSize);

    if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS) {
      return { row, col };
    }
    return null;
  }, [scale, offset]);

  return {
    scale,
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
    offset,
    setOffset,
    setViewport,
    isPanning,
    setIsPanning,
    lastMousePos,
    cellSize: BASE_CELL_SIZE * scale,
    baseCellSize: BASE_CELL_SIZE,
    centerBoard,
    resetCamera,
    zoomAtPoint,
    zoomBy,
    screenToCell,
  };
}
