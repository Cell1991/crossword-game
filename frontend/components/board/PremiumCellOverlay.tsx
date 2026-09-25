'use client';

import React, { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import { CENTER_COL, CENTER_ROW, DOUBLE_LETTER, SECRET_POWER, TRIPLE_LETTER } from '@/lib/board';
import { BoardCamera } from '@/hooks/useBoardCamera';
import { cellKey } from '@/lib/tiles';
import { getCellAlpha } from './boardRenderer';

const toCells = (keys: Set<string>) => [...keys].map((key) => key.split('_').map(Number) as [number, number]);
const POWER_CELLS = toCells(SECRET_POWER);
const DOUBLE_CELLS = toCells(DOUBLE_LETTER);
const TRIPLE_CELLS = toCells(TRIPLE_LETTER);

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
    style.borderRadius = radius;
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
  const isCellOccupied = (row: number, col: number) => occupied.has(cellKey(row, col));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div ref={layerRef} className="absolute left-0 top-0">
        {POWER_CELLS.filter(([row, col]) => !isCellOccupied(row, col)).map(([row, col]) => {
          const alpha = getCellAlpha(row, col);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`power-${row}-${col}`}
              data-row={row}
              data-col={col}
              className="absolute rounded-sm border border-amber-300/35 bg-amber-400/10 shadow-[0_0_16px_rgba(251,191,36,0.3)] board-power-pulse"
              style={{
                animationDelay: `${-((row * 5 + col * 3) % 13) / 10}s`,
                opacity: alpha,
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
              <i className="board-lightning-spark absolute left-[20%] top-[24%] h-1 w-1 rounded-full bg-amber-100" style={{ animationDelay: `${-((row + col) % 7) / 10}s` }} />
              <i className="board-lightning-spark absolute bottom-[20%] right-[20%] h-1 w-1 rounded-full bg-orange-100" style={{ animationDelay: `${-((row * 2 + col) % 9) / 10}s` }} />
            </span>
          );
        })}
        {TRIPLE_CELLS.filter(([row, col]) => !isCellOccupied(row, col)).map(([row, col]) => {
          const alpha = getCellAlpha(row, col);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`triple-${row}-${col}`}
              data-row={row}
              data-col={col}
              className="board-triple-aura absolute rounded-sm border border-red-300/60 bg-red-950/20"
              style={{ opacity: alpha }}
            >
              <span className="board-fire-core absolute inset-[18%] rounded-full bg-red-400/40" />
              <span className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white">
                3<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}
        {DOUBLE_CELLS.filter(([row, col]) => !isCellOccupied(row, col)).map(([row, col]) => {
          const alpha = getCellAlpha(row, col);
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`double-${row}-${col}`}
              data-row={row}
              data-col={col}
              className="board-double-aura absolute rounded-sm border border-orange-300/45 bg-orange-400/10"
              style={{ opacity: alpha }}
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
