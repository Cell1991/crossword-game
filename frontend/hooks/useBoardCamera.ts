'use client';

import { useState, useCallback, useRef } from 'react';

const BASE_CELL_SIZE = 40;
const BOARD_SIZE = 15;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;
const DEFAULT_SCALE = 1;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(scale * 10) / 10));
}

export function useBoardCamera() {
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const centerBoard = useCallback((viewportWidth: number, viewportHeight: number) => {
    const totalBoardPx = BOARD_SIZE * BASE_CELL_SIZE * scale;
    setOffset({
      x: (viewportWidth - totalBoardPx) / 2,
      y: (viewportHeight - totalBoardPx) / 2,
    });
  }, [scale]);

  const resetCamera = useCallback((viewportWidth: number, viewportHeight: number) => {
    setScale(DEFAULT_SCALE);
    const totalBoardPx = BOARD_SIZE * BASE_CELL_SIZE * DEFAULT_SCALE;
    setOffset({
      x: (viewportWidth - totalBoardPx) / 2,
      y: (viewportHeight - totalBoardPx) / 2,
    });
  }, []);

  const zoomAtPoint = useCallback((delta: number, clientX: number, clientY: number) => {
    setScale((prevScale) => {
      const newScale = clampScale(prevScale + (delta > 0 ? -SCALE_STEP : SCALE_STEP));
      const ratio = newScale / prevScale;
      setOffset((prevOffset) => ({
        x: clientX - (clientX - prevOffset.x) * ratio,
        y: clientY - (clientY - prevOffset.y) * ratio,
      }));
      return newScale;
    });
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => clampScale(s + SCALE_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => clampScale(s - SCALE_STEP));
  }, []);

  const screenToCell = useCallback((screenX: number, screenY: number): { row: number; col: number } | null => {
    const cellSize = BASE_CELL_SIZE * scale;
    const boardX = screenX - offset.x;
    const boardY = screenY - offset.y;

    const col = Math.floor(boardX / cellSize);
    const row = Math.floor(boardY / cellSize);

    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
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
    isPanning,
    setIsPanning,
    lastMousePos,
    cellSize: BASE_CELL_SIZE * scale,
    baseCellSize: BASE_CELL_SIZE,
    centerBoard,
    resetCamera,
    zoomAtPoint,
    zoomIn,
    zoomOut,
    screenToCell,
  };
}
