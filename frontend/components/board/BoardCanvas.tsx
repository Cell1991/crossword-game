'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BoardCell, CellPosition, HintTile, PlacedTile } from '@/lib/types';
import { BoardCamera } from '@/hooks/useBoardCamera';
import { BoardModel, BoardScene, drawBoard } from './boardRenderer';
import { PremiumCellOverlay } from './PremiumCellOverlay';
import { TILE_THEME } from '@/lib/tileTheme';

/** Weaker devices skip costly effects and use a lower canvas resolution cap. */
function detectLowPowerDevice() {
  if (typeof navigator === 'undefined') return false;
  if (window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches) return true;
  const device = navigator as Navigator & { deviceMemory?: number };
  return (device.hardwareConcurrency ?? 8) <= 8 || (device.deviceMemory ?? 8) <= 8;
}

function canvasPixelRatio(lowPower: boolean) {
  return Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
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
  hintTiles?: HintTile[] | null;
  pendingArmedCell?: CellPosition | null;
  pendingArmedCard?: string | null;
  dragHoverCell?: CellPosition | null;
  onRegisterHoverHandler?: (handler: (cell: CellPosition | null) => void) => void;
}

/**
 * The board: a canvas for the grid and tiles, the premium-square overlay above it, and the
 * pointer input (pan, pinch, wheel zoom, clicks and dragging staged tiles).
 *
 * Drawing happens only when something changed: a prop (in a layout effect, so the canvas and
 * the DOM update in the same frame), a camera move (subscribed directly, no React render), a
 * resize, a web font finishing loading, or a twinkle frame while there are tiles to twinkle.
 */
export const BoardCanvas = React.memo<BoardCanvasProps>(function BoardCanvas({
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
  hintTiles = null,
  pendingArmedCell = null,
  pendingArmedCard = null,
  dragHoverCell,
  onRegisterHoverHandler,
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneContent | null>(null);
  const modelRef = useRef(new BoardModel());
  const [lowPower] = useState(detectLowPowerDevice);
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
  const tilePlacementTimesRef = useRef<Map<string, number>>(new Map());
  const prevTemporaryTilesRef = useRef<PlacedTile[]>([]);
  const prevRemotePlacementsRef = useRef<{ row: number; col: number }[]>([]);
  const prevBoardStateRef = useRef<Record<string, BoardCell>>({});
  const prevFrozenTileRef = useRef<CellPosition | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const hoverTrailMapRef = useRef<Map<string, { row: number; col: number; time: number }>>(new Map());
  const currentHoverCellRef = useRef<CellPosition | null>(dragHoverCell ?? null);
  const dragHoverAnimRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const content = sceneRef.current;
    if (!canvas || !content) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
      model: modelRef.current,
      animTime: performance.now(),
      tileAnimations: tilePlacementTimesRef.current,
      dragHoverCell: currentHoverCellRef.current,
      dragHoverTrails: hoverTrailMapRef.current,
    });
  }, [camera, lowPower]);

  const startHoverAnimLoop = useCallback(() => {
    if (lowPower) {
      // Mobile / lowPower: instant single draw on cell transition with 0ms CPU overhead
      draw();
      return;
    }
    if (dragHoverAnimRef.current !== null) return;
    const step = (time: number) => {
      draw();
      let stillAnimating = false;
      for (const [key, item] of hoverTrailMapRef.current.entries()) {
        if (time - item.time < 320) {
          stillAnimating = true;
        } else {
          hoverTrailMapRef.current.delete(key);
        }
      }
      if (stillAnimating) {
        dragHoverAnimRef.current = requestAnimationFrame(step);
      } else {
        dragHoverAnimRef.current = null;
        draw();
      }
    };
    dragHoverAnimRef.current = requestAnimationFrame(step);
  }, [draw, lowPower]);

  const handleHoverCellChange = useCallback((cell: CellPosition | null) => {
    const prev = currentHoverCellRef.current;
    if (
      (cell === null && prev === null) ||
      (cell !== null && prev !== null && cell.row === prev.row && cell.col === prev.col)
    ) {
      return;
    }
    currentHoverCellRef.current = cell;
    if (sceneRef.current) {
      sceneRef.current.dragHoverCell = cell;
      sceneRef.current.dragHoverTrails = hoverTrailMapRef.current;
    }
    if (cell && !lowPower) {
      hoverTrailMapRef.current.set(`${cell.row}_${cell.col}`, {
        row: cell.row,
        col: cell.col,
        time: performance.now(),
      });
    }
    startHoverAnimLoop();
  }, [lowPower, startHoverAnimLoop]);

  useEffect(() => {
    onRegisterHoverHandler?.(handleHoverCellChange);
  }, [onRegisterHoverHandler, handleHoverCellChange]);

  useEffect(() => {
    if (dragHoverCell !== undefined) {
      handleHoverCellChange(dragHoverCell);
    }
  }, [dragHoverCell, handleHoverCellChange]);

  useEffect(() => {
    return () => {
      if (dragHoverAnimRef.current) {
        cancelAnimationFrame(dragHoverAnimRef.current);
        dragHoverAnimRef.current = null;
      }
    };
  }, []);

  // Track tile placement timestamps and drive active spring & gleam animations
  useEffect(() => {
    const prevMap = new Map(prevTemporaryTilesRef.current.map(t => [t.tile_id, t]));
    const prevRemoteKeys = new Set(prevRemotePlacementsRef.current.map(r => `${r.row}_${r.col}`));
    const prevBoardKeys = new Set(Object.keys(prevBoardStateRef.current));
    const now = performance.now();
    let hasNew = false;
    for (const t of temporaryTiles) {
      const prev = prevMap.get(t.tile_id);
      if (!prev || prev.row !== t.row || prev.col !== t.col) {
        tilePlacementTimesRef.current.set(`${t.row}_${t.col}`, now);
        tilePlacementTimesRef.current.set(t.tile_id, now);
        hasNew = true;
      }
    }
    for (const r of remotePlacements) {
      const key = `${r.row}_${r.col}`;
      if (!prevRemoteKeys.has(key)) {
        tilePlacementTimesRef.current.set(key, now);
        hasNew = true;
      }
    }
    if (boardState) {
      for (const key of Object.keys(boardState)) {
        if (!prevBoardKeys.has(key)) {
          tilePlacementTimesRef.current.set(key, now);
          hasNew = true;
        }
      }
    }
    const prevFrozen = prevFrozenTileRef.current;
    if (frozenTile && (!prevFrozen || prevFrozen.row !== frozenTile.row || prevFrozen.col !== frozenTile.col)) {
      tilePlacementTimesRef.current.set(`${frozenTile.row}_${frozenTile.col}`, now);
      hasNew = true;
    }
    prevFrozenTileRef.current = frozenTile;

    // Clean up placements that were unstaged/recalled
    const currentKeys = new Set([
      ...temporaryTiles.map(t => `${t.row}_${t.col}`),
      ...remotePlacements.map(r => `${r.row}_${r.col}`),
      ...Object.keys(boardState || {}),
      ...(frozenTile ? [`${frozenTile.row}_${frozenTile.col}`] : []),
    ]);
    for (const key of Array.from(tilePlacementTimesRef.current.keys())) {
      if (key.includes('_') && !currentKeys.has(key)) {
        tilePlacementTimesRef.current.delete(key);
      }
    }
    prevTemporaryTilesRef.current = temporaryTiles;
    prevRemotePlacementsRef.current = remotePlacements;
    prevBoardStateRef.current = boardState || {};

    const startAnimLoop = () => {
      if (lowPower) {
        // Mobile / lowPower: instant single draw on tile placement, 0ms CPU overhead, zero stutter
        draw();
        return;
      }
      if (animFrameRef.current) return;
      const step = (time: number) => {
        draw();
        let stillAnimating = false;
        for (const ts of tilePlacementTimesRef.current.values()) {
          if (time - ts < 400) {
            stillAnimating = true;
            break;
          }
        }
        if (stillAnimating) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          animFrameRef.current = null;
          draw();
        }
      };
      animFrameRef.current = requestAnimationFrame(step);
    };

    if (hasNew) {
      startAnimLoop();
    }
  }, [temporaryTiles, remotePlacements, boardState, draw]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, []);

  // New board content: remember it for the imperative draws and draw it before the browser paints.
  useLayoutEffect(() => {
    modelRef.current.updateState(boardState, temporaryTiles, remotePlacements);
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
      dragHoverCell: currentHoverCellRef.current,
      dragHoverTrails: hoverTrailMapRef.current,
      frozenTile,
      hintCell,
      hintTiles,
      pendingArmedCell,
      pendingArmedCard,
      model: modelRef.current,
    };
    draw();
  }, [boardState, dragPreviewCell, dragPreviewIsValid, dragPreviewTile, draggingTileId, draw, frozenTile, hintCell, hintTiles, pendingArmedCell, pendingArmedCard, remotePlacements, selectedCell, temporaryTiles, temporaryTilesValid]);

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
      if (dx !== 0 || dy !== 0) {
        camera.setOffset(previous => ({
          x: previous.x + dx,
          y: previous.y + dy,
        }));
      }
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
      // Convert line/page scrolls to pixel deltas
      const deltaPixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * rect.height : e.deltaY;
      const cappedDelta = Math.max(-200, Math.min(200, deltaPixels));
      camera.zoomAtPoint(cappedDelta, e.clientX - rect.left, e.clientY - rect.top);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
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
        model={modelRef.current}
      />
    </div>
  );
});
