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
// Desktop allows deep zoom out, while mobile is capped to a comfortable, lag-free minimum scale
const MIN_SCALE = 0.28;
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
  const cellSize = BASE_CELL_SIZE * scale;
  // Wide buffer allowing panning across extended infinite coordinates
  const minBoardCol = -150;
  const maxBoardCol = BOARD_COLS + 150;
  const minBoardRow = -150;
  const maxBoardRow = BOARD_ROWS + 150;

  const minX = viewportWidth * 0.1 - maxBoardCol * cellSize;
  const maxX = viewportWidth * 0.9 - minBoardCol * cellSize;
  const minY = viewportHeight * 0.1 - maxBoardRow * cellSize;
  const maxY = viewportHeight * 0.9 - minBoardRow * cellSize;

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
export function useBoardCamera(customTouchMinScale?: number, customMinScale?: number) {
  const touchMin = customTouchMinScale ?? TOUCH_MIN_SCALE;
  const desktopMin = customMinScale ?? MIN_SCALE;
  const viewRef = useRef<CameraView>({ scale: DEFAULT_SCALE, offset: { x: 0, y: 0 } });
  const viewportRef = useRef({ width: 1200, height: 800 });
  const minScaleRef = useRef(desktopMin);
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
        minScaleRef.current = touchViewport ? touchMin : desktopMin;
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

    /** Sets the zoom directly to a target scale, keeping the board point under (clientX, clientY) pinned. */
    const zoomToScale = (targetScale: number, clientX: number, clientY: number) => {
      if (!Number.isFinite(targetScale) || targetScale <= 0) return;
      const previous = viewRef.current;
      const newScale = clampScale(targetScale, minScaleRef.current);
      if (Math.abs(newScale - previous.scale) < 0.00001) return;
      const ratio = newScale / previous.scale;
      const rawOffset = {
        x: clientX - (clientX - previous.offset.x) * ratio,
        y: clientY - (clientY - previous.offset.y) * ratio,
      };
      const { width, height } = viewportRef.current;
      setView({ scale: newScale, offset: clampOffset(rawOffset, newScale, width, height) });
    };

    /** Multiplies the zoom by `factor`, keeping the board point under (clientX, clientY) under it. */
    const zoomBy = (factor: number, clientX: number, clientY: number) => {
      if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return;
      const previous = viewRef.current;
      zoomToScale(previous.scale * factor, clientX, clientY);
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

    const screenToCell = (screenX: number, screenY: number): { row: number; col: number } => {
      const { scale, offset } = viewRef.current;
      const cellSize = BASE_CELL_SIZE * scale;
      const col = Math.floor((screenX - offset.x) / cellSize);
      const row = Math.floor((screenY - offset.y) / cellSize);
      return { row, col };
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
      zoomToScale,
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
