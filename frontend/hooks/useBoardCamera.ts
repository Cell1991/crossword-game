'use client';

import { useState, useCallback, useRef } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '../lib/board';

const BASE_CELL_SIZE = 40;
// Low enough to see the whole 27-column board on a phone.
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;
const DEFAULT_SCALE = 1;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(scale * 10) / 10));
}

type Offset = { x: number; y: number };

export function useBoardCamera() {
  // Scale and offset change together when zooming, so they live in one state. Zooming used to call
  // setOffset from inside the setScale updater; React may run an updater twice (Strict Mode), which
  // shifted the board twice and made the zoom drift away from the mouse cursor.
  const [view, setView] = useState({ scale: DEFAULT_SCALE, offset: { x: 0, y: 0 } as Offset });
  const { scale, offset } = view;
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const setOffset = useCallback((update: Offset | ((previous: Offset) => Offset)) => {
    setView((previous) => ({
      ...previous,
      offset: typeof update === 'function' ? update(previous.offset) : update,
    }));
  }, []);

  const centerBoard = useCallback((viewportWidth: number, viewportHeight: number) => {
    setView((previous) => {
      const cellSize = BASE_CELL_SIZE * previous.scale;
      return {
        ...previous,
        offset: {
          x: (viewportWidth - BOARD_COLS * cellSize) / 2,
          y: (viewportHeight - BOARD_ROWS * cellSize) / 2,
        },
      };
    });
  }, []);

  const resetCamera = useCallback((viewportWidth: number, viewportHeight: number) => {
    const cellSize = BASE_CELL_SIZE * DEFAULT_SCALE;
    setView({
      scale: DEFAULT_SCALE,
      offset: {
        x: (viewportWidth - BOARD_COLS * cellSize) / 2,
        y: (viewportHeight - BOARD_ROWS * cellSize) / 2,
      },
    });
  }, []);

  /** Zooms one step, keeping the board point under (clientX, clientY) under it. */
  const zoomAtPoint = useCallback((delta: number, clientX: number, clientY: number) => {
    if (delta === 0) return; // e.g. a sideways trackpad swipe: not a zoom
    setView((previous) => {
      const newScale = clampScale(previous.scale + (delta > 0 ? -SCALE_STEP : SCALE_STEP));
      const ratio = newScale / previous.scale;
      return {
        scale: newScale,
        offset: {
          x: clientX - (clientX - previous.offset.x) * ratio,
          y: clientY - (clientY - previous.offset.y) * ratio,
        },
      };
    });
  }, []);

  const zoomIn = useCallback(() => {
    setView((previous) => ({ ...previous, scale: clampScale(previous.scale + SCALE_STEP) }));
  }, []);

  const zoomOut = useCallback(() => {
    setView((previous) => ({ ...previous, scale: clampScale(previous.scale - SCALE_STEP) }));
  }, []);

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
