'use client';

import React, { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import {
  CENTER_COL,
  CENTER_ROW,
  DOUBLE_LETTER,
  DOUBLE_WORD,
  SECRET_POWER,
  TRIPLE_LETTER,
  TRIPLE_WORD,
} from '@/lib/board';
import { BoardCamera } from '@/hooks/useBoardCamera';
import { BoardModel } from '@/lib/engine/boardModel';

const toCells = (keys: Set<string>) => [...keys].map((key) => key.split('_').map(Number) as [number, number]);
const POWER_CELLS = toCells(SECRET_POWER);
const DOUBLE_CELLS = toCells(DOUBLE_LETTER);
const DOUBLE_WORD_CELLS = toCells(DOUBLE_WORD);
const TRIPLE_WORD_CELLS = toCells(TRIPLE_WORD);
const TRIPLE_CELLS = toCells(TRIPLE_LETTER);

interface PremiumCellOverlayProps {
  camera: BoardCamera;
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  remotePlacements: CellPosition[];
  model?: BoardModel;
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
}: PremiumCellOverlayProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  // Pure GPU transform: 0ms DOM reflow, 60-144 FPS
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
  const doubleWordEchoes = useMemo(() => candidateEchoes.filter(e => e.type === 'double-word'), [candidateEchoes]);
  const tripleWordEchoes = useMemo(() => candidateEchoes.filter(e => e.type === 'triple-word'), [candidateEchoes]);

  const baseCellSize = camera.baseCellSize;
  const squareSize = baseCellSize - 2;
  const baseFontSize = 13;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" style={{ contain: 'strict' }}>
      <div ref={layerRef} className="absolute left-0 top-0" style={{ willChange: 'transform' }}>
        {/* 1. Lightning Power Cells (Restored original /light.png with 3D depth) */}
        {[
          ...POWER_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, alpha, isEcho: false };
          }),
          ...powerEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`power-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className="tile-3d-power absolute flex items-center justify-center transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '5px',
                opacity: alpha,
              }}
            >
              <span className="board-lightning-halo absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
              <span className="absolute inset-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/light.png"
                  alt=""
                  className="board-lightning-logo h-[72%] w-[72%] object-contain"
                  style={{ animationDelay: `${-((row * 7 + col * 2) % 11) / 10}s` }}
                />
              </span>
              <i className="board-lightning-spark absolute left-[20%] top-[22%] h-1 w-1 rounded-full bg-yellow-100 shadow-[0_0_6px_1px_rgba(253,224,71,0.7)]" style={{ animationDelay: `${-((row + col) % 7) / 10}s` }} />
              <i className="board-lightning-spark absolute bottom-[20%] right-[20%] h-1 w-1 rounded-full bg-cyan-100 shadow-[0_0_6px_1px_rgba(165,243,252,0.7)]" style={{ animationDelay: `${-((row * 2 + col) % 9) / 10}s` }} />
            </span>
          );
        })}

        {/* 2. Triple Letter Ruby Red Cells (3L) with Flame Depth */}
        {[
          ...TRIPLE_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, alpha, isEcho: false };
          }),
          ...tripleEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`triple-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className="tile-3d-3l absolute flex items-center justify-center transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '5px',
                opacity: alpha,
              }}
            >
              <span className="board-fire-core absolute inset-[20%] rounded-full bg-rose-400/25" />
              <span
                className="board-premium-label z-10 flex items-center justify-center leading-none text-white"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                3<span className="board-premium-letter text-rose-100">L</span>
              </span>
            </span>
          );
        })}

        {/* 3. Double Letter Emerald Green Cells (2L) with Mountain Depth */}
        {[
          ...DOUBLE_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, alpha, isEcho: false };
          }),
          ...doubleEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`double-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className="tile-3d-2l absolute flex items-center justify-center transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '5px',
                opacity: alpha,
              }}
            >
              <span className="board-earth-mountain board-earth-mountain-back absolute inset-x-0 bottom-0 h-[62%]" />
              <span className="board-earth-mountain board-earth-mountain-front absolute inset-x-0 bottom-0 h-[52%]" />
              <span
                className="board-premium-label z-10 flex items-center justify-center leading-none text-white"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                2<span className="board-premium-letter text-emerald-100">L</span>
              </span>
            </span>
          );
        })}

        {/* 4. Double Word Amethyst Purple Cells (2W) with Crystal Depth */}
        {[
          ...DOUBLE_WORD_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, alpha, isEcho: false };
          }),
          ...doubleWordEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`double-word-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className="tile-3d-2w absolute flex items-center justify-center transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '5px',
                opacity: alpha,
              }}
            >
              <span className="board-cosmic-crystal-back absolute inset-[22%] rounded-sm opacity-60" />
              <span
                className="board-premium-label z-10 flex items-center justify-center leading-none text-white"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                2<span className="board-premium-letter board-premium-letter-w text-purple-100">W</span>
              </span>
            </span>
          );
        })}

        {/* 5. Triple Word Golden Amber Cells (3W) with Solar Depth */}
        {[
          ...TRIPLE_WORD_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, alpha, isEcho: false };
          }),
          ...tripleWordEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`triple-word-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className="tile-3d-3w absolute flex items-center justify-center transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '5px',
                opacity: alpha,
              }}
            >
              <span className="board-sun-ring absolute inset-[18%] rounded-full opacity-60" />
              <span
                className="board-premium-label z-10 flex items-center justify-center leading-none text-white"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                3<span className="board-premium-letter board-premium-letter-w text-yellow-100">W</span>
              </span>
            </span>
          );
        })}

        {/* 6. Center Start Star (3D Deep Sapphire with Gold Star) */}
        {!isCellOccupied(CENTER_ROW, CENTER_COL) && (
          <span
            className="tile-3d-center absolute flex items-center justify-center transition-[opacity] duration-200"
            style={{
              left: `${CENTER_COL * baseCellSize + 1}px`,
              top: `${CENTER_ROW * baseCellSize + 1}px`,
              width: `${squareSize}px`,
              height: `${squareSize}px`,
              borderRadius: '5px',
            }}
          >
            <span className="text-amber-400 text-sm drop-shadow-[0_0_6px_rgba(251,191,36,0.85)] leading-none select-none">
              ★
            </span>
          </span>
        )}
      </div>
    </div>
  );
});
