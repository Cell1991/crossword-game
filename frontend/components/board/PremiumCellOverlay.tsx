'use client';

import React, { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import {
  CENTER_COL,
  CENTER_ROW,
  DOUBLE_LETTER,
  SECRET_POWER,
  TRIPLE_LETTER,
} from '@/lib/board';
import { BoardCamera } from '@/hooks/useBoardCamera';
import { BoardModel } from '@/lib/engine/boardModel';

const toCells = (keys: Set<string>) => [...keys].map((key) => key.split('_').map(Number) as [number, number]);

/**
 * Lets the browser skip rendering (and animating) a badge's contents while it sits out of view.
 * Panning moves this layer by CSS transform without re-rendering React, so culling these nodes in
 * JS would mean putting camera coordinates into React state and re-rendering every frame;
 * content-visibility gets the same saving natively and keeps the camera decoupled. Safe without
 * contain-intrinsic-size because every badge is absolutely positioned at a fixed width and height.
 */
const CULL_OFFSCREEN: React.CSSProperties = { contentVisibility: 'auto', contain: 'content' };
const POWER_CELLS = toCells(SECRET_POWER);
const DOUBLE_CELLS = toCells(DOUBLE_LETTER);
const TRIPLE_CELLS = toCells(TRIPLE_LETTER);

interface PremiumCellOverlayProps {
  camera: BoardCamera;
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  remotePlacements: CellPosition[];
  model?: BoardModel;
  lowPower?: boolean;
}

/**
 * Animated premium squares (Lightning, 3L Fire, 2L Earth, Centre Pulse).
 * Rendered using pure GPU Hardware Acceleration (translate3d + scale).
 */
export const PremiumCellOverlay = memo(function PremiumCellOverlay({
  camera,
  boardState,
  temporaryTiles,
  remotePlacements,
  model: propModel,
  lowPower = false,
}: PremiumCellOverlayProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  // Pure GPU transform: 0ms DOM reflow, 60-144 FPS batched via RAF
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.style.transformOrigin = '0 0';
    layer.style.willChange = 'transform';

    let rafId: number | null = null;
    const updateTransform = () => {
      const { scale, offset } = camera.getView();
      layer.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`;
    };
    updateTransform();

    const applyCamera = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateTransform();
      });
    };
    const unsubscribe = camera.subscribe(applyCamera);
    return () => {
      unsubscribe();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [camera]);

  const occupied = useMemo(() => {
    const keys = new Set(Object.keys(boardState));
    for (let i = 0; i < temporaryTiles.length; i++) keys.add(`${temporaryTiles[i].row}_${temporaryTiles[i].col}`);
    for (let i = 0; i < remotePlacements.length; i++) keys.add(`${remotePlacements[i].row}_${remotePlacements[i].col}`);
    return keys;
  }, [boardState, temporaryTiles, remotePlacements]);

  const model = useMemo(() => {
    const m = new BoardModel();
    m.updateState(boardState, temporaryTiles, remotePlacements);
    return m;
  }, [boardState, remotePlacements, temporaryTiles]);

  const isCellOccupied = (r: number, c: number) => occupied.has(`${r}_${c}`);

  const candidateEchoes = useMemo(() => model.getCandidateEchoes(), [model]);
  const powerEchoes = useMemo(() => candidateEchoes.filter(e => e.type === 'power'), [candidateEchoes]);
  const tripleEchoes = useMemo(() => candidateEchoes.filter(e => e.type === 'triple'), [candidateEchoes]);
  const doubleEchoes = useMemo(() => candidateEchoes.filter(e => e.type === 'double'), [candidateEchoes]);

  const baseCellSize = camera.baseCellSize;
  const squareSize = baseCellSize - 2;
  const baseFontSize = 13;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div ref={layerRef} className="absolute left-0 top-0">
        {/* 1. Lightning Power Cells */}
        {[
          ...POWER_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, isSolid: true, alpha, isEcho: false };
          }),
          ...powerEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, isSolid: e.isSolid, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, isSolid, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`power-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className={`absolute border border-cyan-200/75 bg-cyan-400/20 [contain:paint] ${
                isSolid && !lowPower ? 'board-power-pulse shadow-[inset_0_0_10px_rgba(165,243,252,0.18),0_0_18px_rgba(34,211,238,0.45)]' : ''
              }`}
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                animationDelay: !lowPower ? `${-((row * 5 + col * 3) % 13) / 10}s` : undefined,
                opacity: alpha,
                filter: isSolid && !lowPower ? 'brightness(1.15)' : undefined,
                ...CULL_OFFSCREEN,
              }}
            >
              {!lowPower && (
                <span className="board-lightning-halo absolute left-1/2 top-1/2 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
              )}
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/light.png"
                  alt=""
                  className="board-lightning-logo h-[76%] w-[76%] object-contain pointer-events-none"
                />
              </span>
            </span>
          );
        })}

        {/* 2. Triple Letter Fire Cells (3L) */}
        {[
          ...TRIPLE_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, isSolid: true, alpha, isEcho: false };
          }),
          ...tripleEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, isSolid: e.isSolid, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, isSolid, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`triple-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className={`absolute border border-red-300/60 bg-red-950/20 [contain:paint] ${
                isSolid && !lowPower ? 'board-triple-aura' : ''
              }`}
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
                filter: isSolid && !lowPower ? 'brightness(1.1)' : undefined,
                ...CULL_OFFSCREEN,
              }}
            >
              {!lowPower && (
                <span className="board-fire-core absolute inset-[18%] rounded-full bg-red-400/40 pointer-events-none" />
              )}
              <span
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white font-bold pointer-events-none"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                3<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}

        {/* 3. Double Letter Earth Cells (2L) */}
        {[
          ...DOUBLE_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, isSolid: true, alpha, isEcho: false };
          }),
          ...doubleEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, isSolid: e.isSolid, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, isSolid, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`double-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className={`absolute border border-orange-300/45 bg-orange-400/10 [contain:paint] ${
                isSolid && !lowPower ? 'board-double-aura' : ''
              }`}
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
                filter: isSolid && !lowPower ? 'brightness(1.1)' : undefined,
                ...CULL_OFFSCREEN,
              }}
            >
              {!lowPower && (
                <>
                  <span className="board-earth-glow absolute inset-[12%] rounded-full pointer-events-none" />
                  <span className="board-earth-mountain board-earth-mountain-back absolute inset-x-0 bottom-0 h-[70%]" />
                  <span className="board-earth-mountain board-earth-mountain-front absolute inset-x-0 bottom-0 h-[62%]" />
                </>
              )}
              <span
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white font-bold pointer-events-none"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                2<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}

        {/* 4. Center Start Star */}
        {!isCellOccupied(CENTER_ROW, CENTER_COL) && (
          <span
            className={`absolute border border-amber-300/35 [contain:paint] ${
              !lowPower ? 'shadow-[0_0_18px_rgba(251,191,36,0.25)] board-center-pulse' : ''
            }`}
            style={{
              left: `${CENTER_COL * baseCellSize + 1}px`,
              top: `${CENTER_ROW * baseCellSize + 1}px`,
              width: `${squareSize}px`,
              height: `${squareSize}px`,
              borderRadius: '4px',
            }}
          />
        )}
      </div>
    </div>
  );
});
