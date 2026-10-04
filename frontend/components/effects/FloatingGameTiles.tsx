'use client';

import React from 'react';
import Image from 'next/image';

interface FloatingBlock {
  type: 'lightning' | '3L' | '2L' | 'star' | 'tile';
  letter?: string;
  score?: number;
  top: string;
  left?: string;
  right?: string;
  size: number;
  rotate: number;
  delay: string;
  duration: string;
  opacity: number;
}

const BLOCKS: FloatingBlock[] = [
  // 1. In-game Lightning Power Cell (Top-Left)
  { type: 'lightning', top: '16%', left: '7%', size: 48, rotate: -12, delay: '0s', duration: '8s', opacity: 0.85 },

  // 2. In-game 3L Triple Letter Cell (Top-Right)
  { type: '3L', top: '20%', right: '9%', size: 46, rotate: 16, delay: '1.2s', duration: '9s', opacity: 0.85 },

  // 3. In-game 2L Double Letter Cell (Bottom-Left)
  { type: '2L', top: '68%', left: '8%', size: 46, rotate: 14, delay: '2.5s', duration: '8.5s', opacity: 0.85 },

  // 4. In-game Center Star Cell (Bottom-Right)
  { type: 'star', top: '72%', right: '8%', size: 46, rotate: -15, delay: '1.8s', duration: '9.5s', opacity: 0.85 },

  // 5. In-game Letter Tiles (Authentic wood/ivory tile design)
  { type: 'tile', letter: 'X', score: 8, top: '40%', left: '4%', size: 42, rotate: -18, delay: '3.5s', duration: '10s', opacity: 0.8 },
  { type: 'tile', letter: 'W', score: 4, top: '46%', right: '5%', size: 42, rotate: 12, delay: '2s', duration: '9.8s', opacity: 0.8 },
  { type: 'tile', letter: 'A', score: 1, top: '82%', left: '20%', size: 36, rotate: -8, delay: '1s', duration: '11s', opacity: 0.65 },
  { type: 'tile', letter: 'D', score: 2, top: '80%', right: '22%', size: 36, rotate: 10, delay: '3s', duration: '10.5s', opacity: 0.65 },
];

export default function FloatingGameTiles() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {BLOCKS.map((b, idx) => (
        <div
          key={idx}
          style={{
            top: b.top,
            left: b.left,
            right: b.right,
            width: `${b.size}px`,
            height: `${b.size}px`,
            animationDelay: b.delay,
            animationDuration: b.duration,
            transform: `rotate(${b.rotate}deg)`,
            opacity: b.opacity,
          }}
          className="absolute animate-float-tile"
        >
          {/* 1. ACTUAL IN-GAME LIGHTNING CELL */}
          {b.type === 'lightning' && (
            <div className="relative flex h-full w-full items-center justify-center rounded-xl border border-cyan-200/75 bg-cyan-400/20 shadow-[inset_0_0_10px_rgba(165,243,252,0.2),0_0_20px_rgba(34,211,238,0.55)] backdrop-blur-md overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 to-blue-600/30" />
              <Image
                src="/light.png"
                alt="Lightning Cell"
                width={36}
                height={36}
                className="h-[75%] w-[75%] object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.9)] relative z-10"
              />
              <span className="absolute left-[20%] top-[20%] h-1 w-1 rounded-full bg-yellow-200 shadow-[0_0_6px_2px_rgba(253,224,71,0.9)]" />
              <span className="absolute bottom-[20%] right-[20%] h-1 w-1 rounded-full bg-cyan-200 shadow-[0_0_6px_2px_rgba(165,243,252,0.9)]" />
            </div>
          )}

          {/* 2. ACTUAL IN-GAME 3L CELL */}
          {b.type === '3L' && (
            <div className="relative flex h-full w-full items-center justify-center rounded-xl border border-red-300/60 bg-red-950/60 shadow-[0_0_18px_rgba(239,68,68,0.5)] backdrop-blur-md overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/30 via-rose-950/70 to-red-900/40" />
              <span className="relative z-10 font-black text-xl text-white font-maple drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                3<span className="text-red-200">L</span>
              </span>
            </div>
          )}

          {/* 3. ACTUAL IN-GAME 2L CELL */}
          {b.type === '2L' && (
            <div className="relative flex h-full w-full items-center justify-center rounded-xl border border-emerald-300/55 bg-emerald-950/60 shadow-[0_0_18px_rgba(34,197,94,0.45)] backdrop-blur-md overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-emerald-950/70 to-teal-900/40" />
              <span className="relative z-10 font-black text-xl text-white font-maple drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                2<span className="text-emerald-200">L</span>
              </span>
            </div>
          )}

          {/* 4. ACTUAL IN-GAME CENTER STAR CELL */}
          {b.type === 'star' && (
            <div className="relative flex h-full w-full items-center justify-center rounded-xl border border-amber-300/70 bg-[#1e1b4b]/80 shadow-[0_0_20px_rgba(251,191,36,0.45)] backdrop-blur-md overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 via-purple-950/70 to-amber-900/30" />
              <span className="relative z-10 text-2xl font-black text-[#fbbf24] drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]">
                ★
              </span>
            </div>
          )}

          {/* 5. ACTUAL IN-GAME WOOD/IVORY LETTER TILE */}
          {b.type === 'tile' && (
            <div className="relative flex h-full w-full flex-col items-center justify-center rounded-xl border border-amber-300/60 bg-gradient-to-b from-[#fdfbf7] via-[#faeed6] to-[#e8d5b5] shadow-[0_8px_20px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-2px_4px_rgba(120,53,15,0.3)]">
              <span className="font-black text-lg sm:text-xl text-[#3d2714] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)] leading-none">
                {b.letter}
              </span>
              {b.score !== undefined && (
                <span className="absolute bottom-1 right-1.5 text-[9px] font-black text-[#6c4728] leading-none">
                  {b.score}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
