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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white"
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
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-white"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                2<span className="board-premium-letter">L</span>
              </span>
            </span>
          );
        })}

        {/* 4. Double Word Cosmic Violet Cells (2W) */}
        {[
          ...DOUBLE_WORD_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, isSolid: true, alpha, isEcho: false };
          }),
          ...doubleWordEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, isSolid: e.isSolid, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, isSolid, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`double-word-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className={`absolute border border-purple-400/70 bg-purple-950/30 transition-[opacity,filter] duration-300 ${isSolid ? 'board-double-word-aura' : ''}`}
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
                filter: isSolid ? 'brightness(1.15)' : undefined,
              }}
            >
              <span className="board-cosmic-glow absolute inset-[12%] rounded-full" />
              <span
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-purple-100"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                2<span className="board-premium-letter board-premium-letter-w text-purple-200">W</span>
              </span>
            </span>
          );
        })}

        {/* 5. Triple Word Amber / Egg Cells (3W) */}
        {[
          ...TRIPLE_WORD_CELLS.filter(([r, c]) => !isCellOccupied(r, c)).map(([r, c]) => {
            const alpha = model.getCellAlpha(r, c);
            return { row: r, col: c, isSolid: true, alpha, isEcho: false };
          }),
          ...tripleWordEchoes.filter(e => !isCellOccupied(e.row, e.col)).map(e => ({ row: e.row, col: e.col, isSolid: e.isSolid, alpha: e.alpha, isEcho: true })),
        ].map(({ row, col, isSolid, alpha, isEcho }) => {
          if (alpha <= 0.01) return null;
          return (
            <span
              key={`triple-word-${row}-${col}-${isEcho ? 'echo' : 'board'}`}
              className={`absolute border border-amber-400/70 bg-amber-950/30 transition-[opacity,filter] duration-300 ${isSolid ? 'board-triple-word-aura' : ''}`}
              style={{
                left: `${col * baseCellSize + 1}px`,
                top: `${row * baseCellSize + 1}px`,
                width: `${squareSize}px`,
                height: `${squareSize}px`,
                borderRadius: isEcho ? '6px' : '4px',
                opacity: alpha,
                filter: isSolid ? 'brightness(1.15)' : undefined,
              }}
            >
              <span className="board-egg-glow absolute inset-[12%] rounded-full" />
              <span
                className="board-premium-label absolute inset-0 z-30 flex items-center justify-center leading-none text-amber-100"
                style={{ fontSize: `${baseFontSize}px` }}
              >
                3<span className="board-premium-letter board-premium-letter-w text-amber-200">W</span>
              </span>
            </span>
          );
        })}

        {/* 6. Center Start Star */}
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
