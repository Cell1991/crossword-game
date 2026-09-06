'use client';

import { useState, useCallback, useRef } from 'react';

const BASE_CELL_SIZE = 40;
const BOARD_SIZE = 15;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3.0;

export function useBoardCamera() {
  const [scale, setScale] = useState(0.85);
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
    const defaultScale = 0.85;
    setScale(defaultScale);
    const totalBoardPx = BOARD_SIZE * BASE_CELL_SIZE * defaultScale;
    setOffset({
      x: (viewportWidth - totalBoardPx) / 2,
      y: (viewportHeight - totalBoardPx) / 2,
    });
  }, []);

  const zoomAtPoint = useCallback((delta: number, clientX: number, clientY: number) => {
    setScale((prevScale) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale * (delta > 0 ? 0.9 : 1.1)));
      const ratio = newScale / prevScale;
      setOffset((prevOffset) => ({
        x: clientX - (clientX - prevOffset.x) * ratio,
        y: clientY - (clientY - prevOffset.y) * ratio,
      }));
      return newScale;
    });
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s * 1.25));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s * 0.8));
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
