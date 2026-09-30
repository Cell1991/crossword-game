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
        {/* 1. Lightning Power Cells (Vibrant Cyan & Gold) */}
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
              className="absolute flex items-center justify-center border border-cyan-300/80 bg-gradient-to-br from-cyan-400/90 via-cyan-600/90 to-blue-700/95 shadow-[0_0_12px_rgba(34,211,238,0.5)] transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
              }}
            >
              <svg viewBox="0 0 24 24" className="h-[72%] w-[72%] fill-yellow-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
          );
        })}

        {/* 2. Triple Letter Ruby Red Cells (3L) */}
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
              className="absolute flex items-center justify-center border border-rose-300/80 bg-gradient-to-br from-rose-500/90 via-red-600/90 to-red-800/95 shadow-[0_0_12px_rgba(244,63,94,0.45)] transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
              }}
            >
              <span
                className="board-premium-label z-10 flex items-center justify-center leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                3<span className="board-premium-letter text-rose-100">L</span>
              </span>
            </span>
          );
        })}

        {/* 3. Double Letter Emerald Green Cells (2L) */}
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
              className="absolute flex items-center justify-center border border-emerald-300/80 bg-gradient-to-br from-emerald-400/90 via-green-600/90 to-emerald-800/95 shadow-[0_0_12px_rgba(52,211,153,0.45)] transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
              }}
            >
              <span
                className="board-premium-label z-10 flex items-center justify-center leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                2<span className="board-premium-letter text-emerald-100">L</span>
              </span>
            </span>
          );
        })}

        {/* 4. Double Word Amethyst Purple Cells (2W) */}
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
              className="absolute flex items-center justify-center border border-purple-300/80 bg-gradient-to-br from-purple-400/90 via-violet-600/90 to-purple-800/95 shadow-[0_0_12px_rgba(192,132,252,0.45)] transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
              }}
            >
              <span
                className="board-premium-label z-10 flex items-center justify-center leading-none text-purple-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                2<span className="board-premium-letter board-premium-letter-w text-purple-200">W</span>
              </span>
            </span>
          );
        })}

        {/* 5. Triple Word Golden Amber Cells (3W) */}
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
              className="absolute flex items-center justify-center border border-amber-300/90 bg-gradient-to-br from-amber-400/90 via-amber-600/90 to-orange-800/95 shadow-[0_0_12px_rgba(251,191,36,0.5)] transition-[opacity] duration-200"
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
              }}
            >
              <span
                className="board-premium-label z-10 flex items-center justify-center leading-none text-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                3<span className="board-premium-letter board-premium-letter-w text-yellow-200">W</span>
              </span>
            </span>
          );
        })}

        {/* 6. Center Start Star */}
        {!isCellOccupied(CENTER_ROW, CENTER_COL) && (
          <span
            className="absolute flex items-center justify-center border border-amber-300/80 bg-gradient-to-br from-indigo-900/95 via-slate-900/95 to-indigo-950/95 shadow-[0_0_14px_rgba(251,191,36,0.5)] transition-[opacity] duration-200"
            style={{
              left: `${CENTER_COL * baseCellSize + 1}px`,
              top: `${CENTER_ROW * baseCellSize + 1}px`,
              width: `${squareSize}px`,
              height: `${squareSize}px`,
              borderRadius: '4px',
            }}
          >
            <span className="text-amber-400 text-sm drop-shadow-[0_0_4px_rgba(251,191,36,0.8)] leading-none select-none">
              ★
            </span>
          </span>
        )}
      </div>
    </div>
  );
});
