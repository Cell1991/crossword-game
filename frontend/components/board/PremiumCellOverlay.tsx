'use client';

import React, { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import { BOARD_COLS, BOARD_ROWS, CENTER_COL, CENTER_ROW, DOUBLE_LETTER, SECRET_POWER, TRIPLE_LETTER } from '@/lib/board';
import { BoardCamera } from '@/hooks/useBoardCamera';
import { cellKey } from '@/lib/tiles';
import { getBoardVisualExpansion, getCellAlpha } from './boardRenderer';

const toCells = (keys: Set<string>) => [...keys].map((key) => key.split('_').map(Number) as [number, number]);
const POWER_CELLS = toCells(SECRET_POWER);
const DOUBLE_CELLS = toCells(DOUBLE_LETTER);
const TRIPLE_CELLS = toCells(TRIPLE_LETTER);
const PREMIUM_ECHO_ALPHA = 0.28;
const PREMIUM_ECHO_APPROACH_ALPHA = 0.68;
const PREMIUM_EXTENSION_RINGS = [1.25, 1.5, 1.75];
const MAX_PREMIUM_EXTENSION_CELLS = 5;
const MAX_VERTICAL_PREMIUM_EXTENSION_CELLS = 2;

function extendPremiumCells(cells: [number, number][]) {
  const echoes = new Map<string, [number, number]>();
  const roundFromCenter = (value: number) => Math.sign(value) * Math.round(Math.abs(value));
  for (const [row, col] of cells) {
    for (const scale of PREMIUM_EXTENSION_RINGS) {
      const echo: [number, number] = [
        CENTER_ROW + roundFromCenter((row - CENTER_ROW) * scale),
        CENTER_COL + roundFromCenter((col - CENTER_COL) * scale),
      ];
      const isOutsideBoard = echo[0] < 0 || echo[0] >= 19 || echo[1] < 0 || echo[1] >= 27;
      const verticalDistance = Math.max(0, -echo[0], echo[0] - (BOARD_ROWS - 1));
      const horizontalDistance = Math.max(0, -echo[1], echo[1] - (BOARD_COLS - 1));
      if (
        isOutsideBoard &&
        verticalDistance <= MAX_VERTICAL_PREMIUM_EXTENSION_CELLS &&
        horizontalDistance <= MAX_PREMIUM_EXTENSION_CELLS &&
        getCellAlpha(echo[0], echo[1]) > 0.03
      ) {
        echoes.set(`${echo[0]}_${echo[1]}`, echo);
      }
    }
  }
  return [...echoes.values()];
}

const POWER_ECHOES = extendPremiumCells(POWER_CELLS);
const DOUBLE_ECHOES = extendPremiumCells(DOUBLE_CELLS);
const TRIPLE_ECHOES = extendPremiumCells(TRIPLE_CELLS);

/**
 * Follows the camera without React. Panning only translates the layer (the squares sit in board
 * coordinates inside it). Zooming writes each square's box and label size directly; a CSS
 * variable would be tidier, but changing an inherited variable restyles every animated element
 * under the layer and measured about 3× slower per zoom frame.
 */
function layoutSquares(layer: HTMLElement, cellSize: number) {
  const size = `${cellSize - 2}px`;
  const radius = `${Math.max(3, cellSize * 0.12)}px`;
  for (const square of layer.children as HTMLCollectionOf<HTMLElement>) {
    const style = square.style;
    style.left = `${Number(square.dataset.col) * cellSize + 1}px`;
    style.top = `${Number(square.dataset.row) * cellSize + 1}px`;
    style.width = size;
    style.height = size;
    style.borderRadius = square.dataset.echo === 'true' ? `${Math.max(5, cellSize * 0.24)}px` : radius;
  }
  const fontSize = `${Math.max(10, Math.min(20, cellSize * 0.32))}px`;
  for (const label of layer.querySelectorAll<HTMLElement>('.board-premium-label')) {
    label.style.fontSize = fontSize;
  }
}

interface PremiumCellOverlayProps {
  camera: BoardCamera;
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  remotePlacements: CellPosition[];
}

/**
 * The animated premium squares (lightning, 3L fire, 2L earth, centre pulse). They are DOM, not
 * canvas, because their effects are CSS animations; a square disappears once a tile covers it.
 */
export const PremiumCellOverlay = memo(function PremiumCellOverlay({
  camera,
  boardState,
  temporaryTiles,
  remotePlacements,
}: PremiumCellOverlayProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  // Runs after every render (squares come and go as tiles cover them), then on each camera move.
  useLayoutEffect(() => {
    let laidOutScale = NaN;
    const applyCamera = () => {
      const layer = layerRef.current;
      if (!layer) return;
      const { scale, offset } = camera.getView();
      layer.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
      if (scale === laidOutScale) return;
      laidOutScale = scale;
      layoutSquares(layer, camera.baseCellSize * scale);
    };
    applyCamera();
    return camera.subscribe(applyCamera);
  });

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
  const boardExpansion = getBoardVisualExpansion(occupiedPositions);
  const isCellOccupied = (row: number, col: number) => occupied.has(cellKey(row, col));
  const getEchoApproach = (row: number, col: number) => {
    const nearestDistance = occupiedPositions.reduce((nearest, tile) => Math.min(
      nearest,
      Math.max(Math.abs(tile.row - row), Math.abs(tile.col - col))
    ), Infinity);
    return nearestDistance <= 2 ? Math.max(0, 1 - (nearestDistance - 1) * 0.5) : 0;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div ref={layerRef} className="absolute left-0 top-0">
        {[...POWER_CELLS.map(cell => [...cell, false] as const), ...POWER_ECHOES.map(cell => [...cell, true] as const)]
          .filter(([row, col]) => !isCellOccupied(row, col))
          .map(([row, col, isEcho]) => {
          const approach = isEcho ? getEchoApproach(row, col) : 0;
          const alpha = getCellAlpha(row, col, boardExpansion) * (isEcho ? PREMIUM_ECHO_ALPHA + approach * PREMIUM_ECHO_APPROACH_ALPHA : 1);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`power-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              data-row={row}
              data-col={col}
              data-echo={isEcho || undefined}
              className={`absolute rounded-sm border border-cyan-200/75 bg-cyan-400/20 shadow-[inset_0_0_10px_rgba(165,243,252,0.18),0_0_22px_rgba(34,211,238,0.55)] transition-[opacity,filter] duration-300 ${isEcho ? '' : 'board-power-pulse'}`}
              style={{
                animationDelay: `${-((row * 5 + col * 3) % 13) / 10}s`,
                opacity: alpha,
                filter: isEcho ? `brightness(${1 + approach * 0.55})` : undefined,
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
        {[...TRIPLE_CELLS.map(cell => [...cell, false] as const), ...TRIPLE_ECHOES.map(cell => [...cell, true] as const)]
          .filter(([row, col]) => !isCellOccupied(row, col))
          .map(([row, col, isEcho]) => {
          const approach = isEcho ? getEchoApproach(row, col) : 0;
          const alpha = getCellAlpha(row, col, boardExpansion) * (isEcho ? PREMIUM_ECHO_ALPHA + approach * PREMIUM_ECHO_APPROACH_ALPHA : 1);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`triple-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              data-row={row}
              data-col={col}
              data-echo={isEcho || undefined}
              className={`absolute rounded-sm border border-red-300/60 bg-red-950/20 transition-[opacity,filter] duration-300 ${isEcho ? '' : 'board-triple-aura'}`}
              style={{ opacity: alpha, filter: isEcho ? `brightness(${1 + approach * 0.55})` : undefined }}
            >
              <span className="board-fire-core absolute inset-[18%] rounded-full bg-red-400/40" />
              <span className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white">
                3<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}
        {[...DOUBLE_CELLS.map(cell => [...cell, false] as const), ...DOUBLE_ECHOES.map(cell => [...cell, true] as const)]
          .filter(([row, col]) => !isCellOccupied(row, col))
          .map(([row, col, isEcho]) => {
          const approach = isEcho ? getEchoApproach(row, col) : 0;
          const alpha = getCellAlpha(row, col, boardExpansion) * (isEcho ? PREMIUM_ECHO_ALPHA + approach * PREMIUM_ECHO_APPROACH_ALPHA : 1);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`double-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              data-row={row}
              data-col={col}
              data-echo={isEcho || undefined}
              className={`absolute rounded-sm border border-orange-300/45 bg-orange-400/10 transition-[opacity,filter] duration-300 ${isEcho ? '' : 'board-double-aura'}`}
              style={{ opacity: alpha, filter: isEcho ? `brightness(${1 + approach * 0.55})` : undefined }}
            >
              <span className="board-earth-glow absolute inset-[12%] rounded-full" />
              <span className="board-earth-mountain board-earth-mountain-back absolute inset-x-0 bottom-0 h-[70%]" />
              <span className="board-earth-mountain board-earth-mountain-front absolute inset-x-0 bottom-0 h-[62%]" />
              <i className="board-earth-speck absolute left-[22%] top-[27%] h-1 w-1 rounded-full" />
              <i className="board-earth-speck absolute right-[20%] top-[38%] h-1 w-1 rounded-full [animation-delay:0.7s]" />
              <span className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white">
                2<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}
        {!isCellOccupied(CENTER_ROW, CENTER_COL) && (
          <span
            data-row={CENTER_ROW}
            data-col={CENTER_COL}
            className="absolute rounded-sm border border-amber-300/35 shadow-[0_0_18px_rgba(251,191,36,0.25)] board-center-pulse"
          />
        )}
      </div>
    </div>
  );
});
