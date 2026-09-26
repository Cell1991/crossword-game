'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import { BoardCamera, Offset } from '@/hooks/useBoardCamera';
import { BoardScene, drawBoard } from './boardRenderer';
import { PremiumCellOverlay } from './PremiumCellOverlay';
import { TILE_THEME } from '@/lib/tileTheme';

/** Tile constellations twinkle at a bounded rate so the board stays responsive under load. */
const TWINKLE_FRAME_MS = 1000 / 24;

/** Weaker devices get a 1× canvas and no glows or twinkling. */
function detectLowPowerDevice() {
  if (typeof navigator === 'undefined') return false;
  if (window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches) return true;
  const device = navigator as Navigator & { deviceMemory?: number };
  return (device.hardwareConcurrency ?? 8) <= 8 || (device.deviceMemory ?? 8) <= 8;
}

function canvasPixelRatio(lowPower: boolean) {
  return Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
}

/** What the board shows, apart from the camera and the canvas size. */
type SceneContent = Omit<BoardScene, 'width' | 'height' | 'offset' | 'cellSize' | 'lowPower' | 'tilePalette' | 'time'>;

interface BoardCanvasProps {
  /** The board's viewport element; also used to hit-test drags that end over the board. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  remotePlacements: CellPosition[];
  temporaryTilesValid: boolean | null;
  selectedCell: CellPosition | null;
  onCellClick: (row: number, col: number) => void;
  onStartPendingDrag: (tile: PlacedTile, clientX: number, clientY: number) => void;
  onFinishPendingDrag: (clientX?: number, clientY?: number) => void;
  onCollectPendingTile: (tileId: string) => void;
  onPendingDragMove: (clientX: number, clientY: number) => void;
  dragPreviewCell: CellPosition | null;
  draggingTileId: string | null;
  dragPreviewTile: { letter: string; value: number } | null;
  dragPreviewIsValid: boolean | null;
  canStageMove: boolean;
  camera: BoardCamera;
  frozenTile?: CellPosition | null;
  hintCell?: CellPosition | null;
}

/**
 * The board: a canvas for the grid and tiles, the premium-square overlay above it, and the
 * pointer input (pan, pinch, wheel zoom, clicks and dragging staged tiles).
 *
 * Drawing happens only when something changed: a prop (in a layout effect, so the canvas and
 * the DOM update in the same frame), a camera move (subscribed directly, no React render), a
 * resize, a web font finishing loading, or a twinkle frame while there are tiles to twinkle.
 */
export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  containerRef,
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
  const sceneRef = useRef<SceneContent | null>(null);
  const [lowPower] = useState(detectLowPowerDevice);
  const wheelFrameRef = useRef<number | null>(null);
  const pendingWheelRef = useRef<{ delta: number; x: number; y: number } | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const pendingPanDeltaRef = useRef<Offset>({ x: 0, y: 0 });
  const pendingPointerRef = useRef<{ tile: PlacedTile; x: number; y: number; pointerId: number } | null>(null);
  const pendingDragRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  /** Where the current pan started, and whether it has moved far enough to stop counting as a click. */
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panMovedRef = useRef(false);
  /** Fingers on the board. Two of them pinch: zoom by how far they spread, pan by how their midpoint moves. */
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const content = sceneRef.current;
    if (!canvas || !content) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = canvasPixelRatio(lowPower);
    const { scale, offset } = camera.getView();
    drawBoard(ctx, dpr, {
      ...content,
      width: canvas.width / dpr,
      height: canvas.height / dpr,
      offset,
      cellSize: camera.baseCellSize * scale,
      lowPower,
      tilePalette: window.innerWidth >= 1024 ? TILE_THEME.desktop : TILE_THEME.mobile,
      time: performance.now() / 1000,
    });
  }, [camera, lowPower]);

  // New board content: remember it for the imperative draws and draw it before the browser paints.
  useLayoutEffect(() => {
    sceneRef.current = {
      boardState,
      temporaryTiles,
      temporaryTilesValid,
      remotePlacements,
      selectedCell,
      dragPreviewCell,
      dragPreviewTile,
      dragPreviewIsValid,
      draggingTileId,
      frozenTile,
      hintCell,
    };
    draw();
  }, [boardState, dragPreviewCell, dragPreviewIsValid, dragPreviewTile, draggingTileId, draw, frozenTile, hintCell, remotePlacements, selectedCell, temporaryTiles, temporaryTilesValid]);

  // Size the canvas to its container, and centre the board the first time it has a size.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    let hasCentered = false;
    const resize = () => {
      const { clientWidth, clientHeight } = container;
      camera.setViewport(clientWidth, clientHeight);
      const dpr = canvasPixelRatio(lowPower);
      // Assigning the size clears the canvas, so only do it when the size really changes.
      if (canvas.width !== Math.trunc(clientWidth * dpr) || canvas.height !== Math.trunc(clientHeight * dpr)) {
        canvas.width = clientWidth * dpr;
        canvas.height = clientHeight * dpr;
      }
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
      if (!hasCentered && clientWidth > 0 && clientHeight > 0) {
        hasCentered = true;
        camera.centerBoard(clientWidth, clientHeight);
      }
      draw();
    };
    resize();
    // The container can change size without the window resizing (and vice versa for a DPR change).
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    let windowFrame: number | null = null;
    const handleWindowResize = () => {
      if (windowFrame !== null) return;
      windowFrame = requestAnimationFrame(() => {
        windowFrame = null;
        resize();
      });
    };
    window.addEventListener('resize', handleWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (windowFrame !== null) cancelAnimationFrame(windowFrame);
    };
  }, [camera, containerRef, draw, lowPower]);

  // Pan and zoom redraw straight from the camera, without a React render.
  useLayoutEffect(() => camera.subscribe(draw), [camera, draw]);

  // Canvas text uses web fonts; redraw once they arrive so no tile keeps the fallback font.
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let active = true;
    const redraw = () => { if (active) draw(); };
    fonts.addEventListener('loadingdone', redraw);
    void fonts.ready.then(redraw);
    return () => {
      active = false;
      fonts.removeEventListener('loadingdone', redraw);
    };
  }, [draw]);

  // Constellations on tiles twinkle over time; with no tiles (or on low-power devices) nothing moves.
  const hasTwinklingTiles = !lowPower && (
    Object.keys(boardState).length > 0 || temporaryTiles.length > 0 || dragPreviewTile !== null
  );
  useEffect(() => {
    if (!hasTwinklingTiles) return;
    let frame = 0;
    let lastDrawAt = 0;
    const loop = (time: number) => {
      if (document.visibilityState === 'visible' && time - lastDrawAt >= TWINKLE_FRAME_MS) {
        draw();
        lastDrawAt = time;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [draw, hasTwinklingTiles]);

  const queuePan = (dx: number, dy: number) => {
    pendingPanDeltaRef.current.x += dx;
    pendingPanDeltaRef.current.y += dy;
    if (panFrameRef.current !== null) return;
    panFrameRef.current = requestAnimationFrame(() => {
      panFrameRef.current = null;
      const delta = pendingPanDeltaRef.current;
      pendingPanDeltaRef.current = { x: 0, y: 0 };
      if (delta.x === 0 && delta.y === 0) return;
      camera.setOffset(previous => ({
        x: previous.x + delta.x,
        y: previous.y + delta.y,
      }));
    });
  };

  const measurePinch = () => {
    const [a, b] = [...touchPointsRef.current.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

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
          isPanningRef.current = false;
          pinchRef.current = measurePinch();
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        return;
      }
    }
    if (e.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cell = camera.screenToCell(e.clientX - rect.left, e.clientY - rect.top);
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
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panMovedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    isPanningRef.current = true;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && touchPointsRef.current.has(e.pointerId)) {
      touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchRef.current;
      if (pinch && touchPointsRef.current.size >= 2) {
        const next = measurePinch();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          camera.setOffset(prev => ({ x: prev.x + next.x - pinch.x, y: prev.y + next.y - pinch.y }));
          if (pinch.distance > 0) camera.zoomBy(next.distance / pinch.distance, next.x - rect.left, next.y - rect.top);
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
    if (isPanningRef.current) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      queuePan(dx, dy);
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
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
    if (isPanningRef.current) {
      isPanningRef.current = false;

      // A press that never moved away from where it started is a cell click; a pan is not.
      const start = panStartRef.current ?? { x: e.clientX, y: e.clientY };
      if (!panMovedRef.current && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const cell = camera.screenToCell(e.clientX - rect.left, e.clientY - rect.top);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
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
        if (pendingWheel) camera.zoomAtPoint(Math.max(-300, Math.min(300, pendingWheel.delta)), pendingWheel.x, pendingWheel.y);
        pendingWheelRef.current = null;
        wheelFrameRef.current = null;
      });
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelFrameRef.current !== null) cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
      pendingWheelRef.current = null;
    };
  }, [camera, containerRef]);

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
        isPanningRef.current = false;
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-10 block h-full w-full" />
      <PremiumCellOverlay
        camera={camera}
        boardState={boardState}
        temporaryTiles={temporaryTiles}
        remotePlacements={remotePlacements}
      />
    </div>
  );
};
