'use client';

import React, { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import {
  BOARD_COLS,
  BOARD_ROWS,
  CENTER_COL,
  CENTER_ROW,
  DOUBLE_LETTER,
  isDoubleLetterCell,
  isPowerCell,
  isTripleLetterCell,
  SECRET_POWER,
  TRIPLE_LETTER,
} from '@/lib/board';
import { BoardCamera } from '@/hooks/useBoardCamera';
import { cellKey } from '@/lib/tiles';
import { getCellAlpha } from './boardRenderer';

const toCells = (keys: Set<string>) => [...keys].map((key) => key.split('_').map(Number) as [number, number]);
const POWER_CELLS = toCells(SECRET_POWER);
const DOUBLE_CELLS = toCells(DOUBLE_LETTER);
const TRIPLE_CELLS = toCells(TRIPLE_LETTER);
const PREMIUM_ECHO_ALPHA = 0.28;

/**
 * Follows the camera with pure GPU transform (translate3d + scale).
 * Base elements sit at fixed base grid coordinates (40px per cell),
 * eliminating all DOM reflow and layout recalculations during zoom & pan.
 */
interface PremiumCellOverlayProps {
  camera: BoardCamera;
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  remotePlacements: CellPosition[];
}

/**
 * The animated premium squares (lightning, 3L fire, 2L earth, centre pulse).
 * Renders base starter squares + local mirrored echoes within active words/borders.
 */
export const PremiumCellOverlay = memo(function PremiumCellOverlay({
  camera,
  boardState,
  temporaryTiles,
  remotePlacements,
}: PremiumCellOverlayProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  // Runs after every render, then on each camera move (zero DOM reflow / zero layout thrash)
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.style.transformOrigin = '0 0';
    layer.style.willChange = 'transform';

    const applyCamera = () => {
      const { scale, offset } = camera.getView();
      layer.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`;
    };
    applyCamera();
    return camera.subscribe(applyCamera);
  }, [camera]);

  const occupied = useMemo(() => {
    const keys = new Set(Object.keys(boardState));
    for (const tile of temporaryTiles) keys.add(cellKey(tile.row, tile.col));
    for (const placement of remotePlacements) keys.add(cellKey(placement.row, placement.col));
    return keys;
  }, [boardState, remotePlacements, temporaryTiles]);

  const occupiedPositions = useMemo(() => [
    ...Object.values(boardState).map(({ row, col }) => ({ row, col })),
    ...temporaryTiles.map(({ row, col }) => ({ row, col })),
    ...remotePlacements,
  ], [boardState, remotePlacements, temporaryTiles]);

  // Efficient local candidate echoes: examine 8-cell radius around occupied tiles + starter perimeter
  const candidateEchoes = useMemo(() => {
    const echoes = new Map<string, { row: number; col: number; type: 'power' | 'triple' | 'double' }>();

    // 1. Around each placed tile (up to 8 cells away)
    for (let i = 0; i < occupiedPositions.length; i++) {
      const tile = occupiedPositions[i];
      for (let dr = -8; dr <= 8; dr++) {
        for (let dc = -8; dc <= 8; dc++) {
          const r = tile.row + dr;
          const c = tile.col + dc;
          if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) continue;
          const key = `${r}_${c}`;
          if (echoes.has(key)) continue;
          if (isPowerCell(r, c)) {
            echoes.set(key, { row: r, col: c, type: 'power' });
          } else if (isTripleLetterCell(r, c)) {
            echoes.set(key, { row: r, col: c, type: 'triple' });
          } else if (isDoubleLetterCell(r, c)) {
            echoes.set(key, { row: r, col: c, type: 'double' });
          }
        }
      }
    }

    // 2. Around starter board edges (up to 3 cells away)
    for (let r = -3; r <= BOARD_ROWS + 2; r++) {
      for (let c = -3; c <= BOARD_COLS + 2; c++) {
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) continue;
        const key = `${r}_${c}`;
        if (echoes.has(key)) continue;
        if (isPowerCell(r, c)) {
          echoes.set(key, { row: r, col: c, type: 'power' });
        } else if (isTripleLetterCell(r, c)) {
          echoes.set(key, { row: r, col: c, type: 'triple' });
        } else if (isDoubleLetterCell(r, c)) {
          echoes.set(key, { row: r, col: c, type: 'double' });
        }
      }
    }

    return [...echoes.values()];
  }, [occupiedPositions]);

  const isCellOccupied = (row: number, col: number) => occupied.has(cellKey(row, col));
  const getEchoDistance = (row: number, col: number) => {
    if (occupiedPositions.length === 0) return Infinity;
    let minD = Infinity;
    for (let i = 0; i < occupiedPositions.length; i++) {
      const t = occupiedPositions[i];
      const d = Math.max(Math.abs(t.row - row), Math.abs(t.col - col));
      if (d < minD) minD = d;
    }
    return minD;
  };

  const powerEchoes = useMemo(() => candidateEchoes.filter(e => e.type === 'power').map(e => [e.row, e.col] as [number, number]), [candidateEchoes]);
  const tripleEchoes = useMemo(() => candidateEchoes.filter(e => e.type === 'triple').map(e => [e.row, e.col] as [number, number]), [candidateEchoes]);
  const doubleEchoes = useMemo(() => candidateEchoes.filter(e => e.type === 'double').map(e => [e.row, e.col] as [number, number]), [candidateEchoes]);

  const baseCellSize = camera.baseCellSize;
  const squareSize = baseCellSize - 2;
  const baseFontSize = 13;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div ref={layerRef} className="absolute left-0 top-0">
        {[...POWER_CELLS.map(cell => [...cell, false] as const), ...powerEchoes.map(cell => [...cell, true] as const)]
          .filter(([row, col]) => !isCellOccupied(row, col))
          .map(([row, col, isEcho]) => {
          const distance = isEcho ? getEchoDistance(row, col) : 0;
          const isSolid = !isEcho || distance <= 5;
          const baseAlpha = getCellAlpha(row, col, occupiedPositions);
          const alpha = isSolid ? baseAlpha : baseAlpha * PREMIUM_ECHO_ALPHA;
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`power-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className={`absolute border border-cyan-200/75 bg-cyan-400/20 shadow-[inset_0_0_10px_rgba(165,243,252,0.18),0_0_22px_rgba(34,211,238,0.55)] transition-[opacity,filter] duration-300 ${isSolid ? 'board-power-pulse' : ''}`}
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                animationDelay: `${-((row * 5 + col * 3) % 13) / 10}s`,
                opacity: alpha,
                filter: isSolid ? 'brightness(1.15)' : undefined,
              }}
            >
              <span className="board-lightning-halo absolute left-1/2 top-1/2 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
              <span className="absolute inset-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- a tiny decorative sprite repeated per square; next/image adds nothing here */}
                <img
                  src="/light.png"
                  alt=""
                  className="board-lightning-logo h-[76%] w-[76%] object-contain"
                  style={{ animationDelay: `${-((row * 7 + col * 2) % 11) / 10}s` }}
                />
              </span>
              <i className="board-lightning-spark absolute left-[20%] top-[24%] h-1 w-1 rounded-full bg-yellow-100 shadow-[0_0_8px_2px_rgba(253,224,71,0.9)]" style={{ animationDelay: `${-((row + col) % 7) / 10}s` }} />
              <i className="board-lightning-spark absolute bottom-[20%] right-[20%] h-1 w-1 rounded-full bg-cyan-100 shadow-[0_0_8px_2px_rgba(165,243,252,0.9)]" style={{ animationDelay: `${-((row * 2 + col) % 9) / 10}s` }} />
            </span>
          );
        })}
        {[...TRIPLE_CELLS.map(cell => [...cell, false] as const), ...tripleEchoes.map(cell => [...cell, true] as const)]
          .filter(([row, col]) => !isCellOccupied(row, col))
          .map(([row, col, isEcho]) => {
          const distance = isEcho ? getEchoDistance(row, col) : 0;
          const isSolid = !isEcho || distance <= 5;
          const baseAlpha = getCellAlpha(row, col, occupiedPositions);
          const alpha = isSolid ? baseAlpha : baseAlpha * PREMIUM_ECHO_ALPHA;
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`triple-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className={`absolute border border-red-300/60 bg-red-950/20 transition-[opacity,filter] duration-300 ${isSolid ? 'board-triple-aura' : ''}`}
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
                filter: isSolid ? 'brightness(1.1)' : undefined,
              }}
            >
              <span className="board-fire-core absolute inset-[18%] rounded-full bg-red-400/40" />
              <span
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white font-bold"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                3<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}
        {[...DOUBLE_CELLS.map(cell => [...cell, false] as const), ...doubleEchoes.map(cell => [...cell, true] as const)]
          .filter(([row, col]) => !isCellOccupied(row, col))
          .map(([row, col, isEcho]) => {
          const distance = isEcho ? getEchoDistance(row, col) : 0;
          const isSolid = !isEcho || distance <= 5;
          const baseAlpha = getCellAlpha(row, col, occupiedPositions);
          const alpha = isSolid ? baseAlpha : baseAlpha * PREMIUM_ECHO_ALPHA;
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`double-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className={`absolute border border-orange-300/45 bg-orange-400/10 transition-[opacity,filter] duration-300 ${isSolid ? 'board-double-aura' : ''}`}
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
                filter: isSolid ? 'brightness(1.1)' : undefined,
              }}
            >
              <span className="board-earth-glow absolute inset-[12%] rounded-full" />
              <span className="board-earth-mountain board-earth-mountain-back absolute inset-x-0 bottom-0 h-[70%]" />
              <span className="board-earth-mountain board-earth-mountain-front absolute inset-x-0 bottom-0 h-[62%]" />
              <i className="board-earth-speck absolute left-[22%] top-[27%] h-1 w-1 rounded-full" />
              <i className="board-earth-speck absolute right-[20%] top-[38%] h-1 w-1 rounded-full [animation-delay:0.7s]" />
              <span
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white font-bold"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                2<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}
        {!isCellOccupied(CENTER_ROW, CENTER_COL) && (
          <span
            className="absolute border border-amber-300/35 shadow-[0_0_18px_rgba(251,191,36,0.25)] board-center-pulse"
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

