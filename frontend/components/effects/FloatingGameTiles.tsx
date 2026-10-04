'use client';

import React from 'react';

interface FloatingTile {
  letter: string;
  score?: string | number;
  type?: 'normal' | 'multiplier' | 'spell';
  top: string;
  left?: string;
  right?: string;
  size: number;
  rotate: number;
  delay: string;
  duration: string;
  blur?: string;
  opacity: number;
  color?: string;
}

const TILES: FloatingTile[] = [
  { letter: 'X', score: 8, type: 'normal', top: '15%', left: '8%', size: 48, rotate: -14, delay: '0s', duration: '8s', opacity: 0.28, color: 'from-amber-400/30 to-amber-900/10' },
  { letter: '3W', score: 'x3', type: 'multiplier', top: '22%', right: '10%', size: 44, rotate: 18, delay: '1.5s', duration: '9s', opacity: 0.22, color: 'from-rose-500/30 to-rose-950/10' },
  { letter: '⚡', score: 'SP', type: 'spell', top: '65%', left: '10%', size: 42, rotate: 12, delay: '3s', duration: '7.5s', opacity: 0.25, color: 'from-amber-300/35 to-amber-800/10' },
  { letter: '2L', score: 'x2', type: 'multiplier', top: '70%', right: '9%', size: 44, rotate: -16, delay: '2s', duration: '8.5s', opacity: 0.22, color: 'from-cyan-400/30 to-cyan-950/10' },
  { letter: 'W', score: 4, type: 'normal', top: '38%', left: '4%', size: 38, rotate: 22, delay: '4s', duration: '10s', blur: 'blur-[1px]', opacity: 0.18, color: 'from-indigo-400/20 to-slate-900/10' },
  { letter: 'D', score: 2, type: 'normal', top: '48%', right: '5%', size: 38, rotate: -10, delay: '2.5s', duration: '9.5s', blur: 'blur-[1px]', opacity: 0.18, color: 'from-purple-400/20 to-slate-900/10' },
  { letter: 'O', score: 1, type: 'normal', top: '82%', left: '22%', size: 34, rotate: -8, delay: '1s', duration: '11s', blur: 'blur-[1.5px]', opacity: 0.14, color: 'from-amber-400/20 to-slate-900/10' },
  { letter: 'R', score: 1, type: 'normal', top: '80%', right: '24%', size: 34, rotate: 14, delay: '3.5s', duration: '10.5s', blur: 'blur-[1.5px]', opacity: 0.14, color: 'from-cyan-400/20 to-slate-900/10' },
];

export default function FloatingGameTiles() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {TILES.map((t, idx) => (
        <div
          key={idx}
          style={{
            top: t.top,
            left: t.left,
            right: t.right,
            width: `${t.size}px`,
            height: `${t.size}px`,
            animationDelay: t.delay,
            animationDuration: t.duration,
            transform: `rotate(${t.rotate}deg)`,
            opacity: t.opacity,
          }}
          className={`absolute flex flex-col items-center justify-center rounded-xl border border-white/15 bg-gradient-to-br ${t.color || 'from-slate-700/30 to-slate-900/20'} shadow-lg backdrop-blur-sm animate-float-tile ${t.blur || ''}`}
        >
          {/* Tile Gloss Reflection */}
          <div className="absolute inset-x-1 top-1 h-1/3 rounded-t-lg bg-gradient-to-b from-white/20 to-transparent" />
          
          {/* Main Symbol */}
          <span className="text-base sm:text-lg font-black text-slate-200 drop-shadow">
            {t.letter}
          </span>
          
          {/* Score / Multiplier Subscript */}
          {t.score !== undefined && (
            <span className="absolute bottom-1 right-1.5 text-[8px] sm:text-[9px] font-black text-amber-300/80 leading-none">
              {t.score}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
