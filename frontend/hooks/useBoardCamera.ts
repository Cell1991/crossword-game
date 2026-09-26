'use client';

import { useMemo, useRef, useSyncExternalStore } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '@/lib/board';

export interface Offset {
  x: number;
  y: number;
}

export interface CameraView {
  scale: number;
  offset: Offset;
}

const BASE_CELL_SIZE = 40;
// Balanced zoom limit to prevent zooming out too far away
const MIN_SCALE = 0.52;
const TOUCH_MIN_SCALE = 0.65;
const MAX_SCALE = 1.8;
const DEFAULT_SCALE = 1;
/** Zoom follows how far the wheel/trackpad moved (no fixed steps): a mouse-wheel notch (100px) is about 14%. */
const WHEEL_ZOOM_SPEED = 0.0015;
/** The zoom buttons change the zoom by 20% per press. */
export const BUTTON_ZOOM_FACTOR = 1.2;

function clampScale(scale: number, minScale: number) {
  return Math.min(MAX_SCALE, Math.max(minScale, scale));
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

/**
 * The board camera (zoom + pan). It changes every frame while the player pans or zooms, so it
 * lives outside React state: the canvas and the premium-square overlay subscribe and redraw
 * themselves, and nothing else re-renders. Components that show the zoom level read it with
 * `useCameraScale`, which only updates them when the scale actually changes.
 */
export function useBoardCamera() {
  const viewRef = useRef<CameraView>({ scale: DEFAULT_SCALE, offset: { x: 0, y: 0 } });
  const viewportRef = useRef({ width: 1200, height: 800 });
  const minScaleRef = useRef(MIN_SCALE);
  const listenersRef = useRef(new Set<() => void>());

  return useMemo(() => {
    const setView = (next: CameraView) => {
      const previous = viewRef.current;
      if (previous.scale === next.scale && previous.offset.x === next.offset.x && previous.offset.y === next.offset.y) return;
      viewRef.current = next;
      listenersRef.current.forEach(listener => listener());
    };

    const getView = () => viewRef.current;

    const subscribe = (listener: () => void) => {
      listenersRef.current.add(listener);
      return () => { listenersRef.current.delete(listener); };
    };

    const setViewport = (width: number, height: number) => {
      if (width > 0 && height > 0) {
        viewportRef.current = { width, height };
        const touchViewport = width < 768 || window.matchMedia('(pointer: coarse)').matches;
        minScaleRef.current = touchViewport ? TOUCH_MIN_SCALE : MIN_SCALE;
        const previous = viewRef.current;
        if (previous.scale < minScaleRef.current) {
          setView({
            scale: minScaleRef.current,
            offset: clampOffset(previous.offset, minScaleRef.current, width, height),
          });
        }
      }
    };

    const setOffset = (update: Offset | ((previous: Offset) => Offset)) => {
      const previous = viewRef.current;
      const nextRaw = typeof update === 'function' ? update(previous.offset) : update;
      const { width, height } = viewportRef.current;
      setView({ ...previous, offset: clampOffset(nextRaw, previous.scale, width, height) });
    };

    const centerBoard = (viewportWidth: number, viewportHeight: number) => {
      setViewport(viewportWidth, viewportHeight);
      const previous = viewRef.current;
      const cellSize = BASE_CELL_SIZE * previous.scale;
      const rawOffset = {
        x: (viewportWidth - BOARD_COLS * cellSize) / 2,
        y: (viewportHeight - BOARD_ROWS * cellSize) / 2,
      };
      setView({ ...previous, offset: clampOffset(rawOffset, previous.scale, viewportWidth, viewportHeight) });
    };

    /** Back to 100%, centred in the board's own area. */
    const resetCamera = () => {
      const { width, height } = viewportRef.current;
      const cellSize = BASE_CELL_SIZE * DEFAULT_SCALE;
      const rawOffset = {
        x: (width - BOARD_COLS * cellSize) / 2,
        y: (height - BOARD_ROWS * cellSize) / 2,
      };
      setView({ scale: DEFAULT_SCALE, offset: clampOffset(rawOffset, DEFAULT_SCALE, width, height) });
    };

    /** Multiplies the zoom by `factor`, keeping the board point under (clientX, clientY) under it. */
    const zoomBy = (factor: number, clientX: number, clientY: number) => {
      if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return;
      const previous = viewRef.current;
      const newScale = clampScale(previous.scale * factor, minScaleRef.current);
      const ratio = newScale / previous.scale;
      if (ratio === 1) return;
      const rawOffset = {
        x: clientX - (clientX - previous.offset.x) * ratio,
        y: clientY - (clientY - previous.offset.y) * ratio,
      };
      const { width, height } = viewportRef.current;
      setView({ scale: newScale, offset: clampOffset(rawOffset, newScale, width, height) });
    };

    /** The zoom buttons zoom around the middle of the board area. */
    const zoomAtCenter = (factor: number) => {
      const { width, height } = viewportRef.current;
      zoomBy(factor, width / 2, height / 2);
    };

    /** Wheel zoom: scrolling down (positive delta, in pixels) zooms out, in proportion to the distance scrolled. */
    const zoomAtPoint = (delta: number, clientX: number, clientY: number) => {
      zoomBy(Math.exp(-delta * WHEEL_ZOOM_SPEED), clientX, clientY);
    };

    const screenToCell = (screenX: number, screenY: number): { row: number; col: number } | null => {
      const { scale, offset } = viewRef.current;
      const cellSize = BASE_CELL_SIZE * scale;
      const col = Math.floor((screenX - offset.x) / cellSize);
      const row = Math.floor((screenY - offset.y) / cellSize);
      if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS) {
        return { row, col };
      }
      return null;
    };

    return {
      get minScale() { return minScaleRef.current; },
      maxScale: MAX_SCALE,
      baseCellSize: BASE_CELL_SIZE,
      getView,
      subscribe,
      setViewport,
      setOffset,
      centerBoard,
      resetCamera,
      zoomBy,
      zoomAtCenter,
      zoomAtPoint,
      screenToCell,
    };
  }, []);
}

export type BoardCamera = ReturnType<typeof useBoardCamera>;

/** The current zoom level; re-renders the caller only when it changes (not on every pan frame). */
export function useCameraScale(camera: BoardCamera): number {
  return useSyncExternalStore(camera.subscribe, () => camera.getView().scale, () => DEFAULT_SCALE);
}
