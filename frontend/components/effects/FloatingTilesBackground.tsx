'use client';

import React, { useMemo } from 'react';

interface FloatingTileData {
  letter: string;
  value?: number;
  icon?: string;
  top: string;
  left: string;
  size: number;
  rotation: number;
  duration: number;
  delay: number;
  opacity: number;
  accent: 'gold' | 'cyan' | 'purple' | 'emerald' | 'rose';
}

const ACCENT_STYLES = {
  gold: {
    bg: 'from-amber-400 via-amber-500 to-amber-700',
    border: 'border-amber-300/40',
    glow: 'rgba(251, 191, 36, 0.25)',
    textColor: 'text-white',
    scoreColor: 'text-amber-200',
  },
  cyan: {
    bg: 'from-cyan-400 via-cyan-600 to-blue-800',
    border: 'border-cyan-300/40',
    glow: 'rgba(6, 182, 212, 0.25)',
    textColor: 'text-white',
    scoreColor: 'text-cyan-200',
  },
  purple: {
    bg: 'from-purple-400 via-indigo-600 to-slate-900',
    border: 'border-purple-300/40',
    glow: 'rgba(168, 85, 247, 0.25)',
    textColor: 'text-white',
    scoreColor: 'text-purple-200',
  },
  emerald: {
    bg: 'from-emerald-400 via-teal-600 to-slate-900',
    border: 'border-emerald-300/40',
    glow: 'rgba(16, 185, 129, 0.25)',
    textColor: 'text-white',
    scoreColor: 'text-emerald-200',
  },
  rose: {
    bg: 'from-rose-400 via-red-600 to-slate-950',
    border: 'border-rose-300/40',
    glow: 'rgba(244, 63, 94, 0.25)',
    textColor: 'text-white',
    scoreColor: 'text-rose-200',
  },
};

export default function FloatingTilesBackground() {
  const tiles: FloatingTileData[] = useMemo(
    () => [
      { letter: 'W', value: 4, top: '12%', left: '8%', size: 52, rotation: -12, duration: 9, delay: 0, opacity: 0.7, accent: 'gold' },
      { letter: 'O', value: 1, top: '22%', left: '86%', size: 48, rotation: 15, duration: 11, delay: 1.5, opacity: 0.65, accent: 'gold' },
      { letter: 'R', value: 1, top: '78%', left: '10%', size: 50, rotation: 8, duration: 10, delay: 3, opacity: 0.6, accent: 'gold' },
      { letter: 'D', value: 2, top: '72%', left: '88%', size: 54, rotation: -16, duration: 12, delay: 2, opacity: 0.65, accent: 'gold' },
      { letter: 'X', value: 8, top: '8%', left: '76%', size: 56, rotation: 22, duration: 8, delay: 0.5, opacity: 0.75, accent: 'gold' },
      { letter: '⚡', icon: '⚡', top: '48%', left: '4%', size: 44, rotation: -8, duration: 10, delay: 4, opacity: 0.55, accent: 'cyan' },
      { letter: '⚔️', icon: '⚔️', top: '56%', left: '92%', size: 42, rotation: 12, duration: 13, delay: 2.5, opacity: 0.5, accent: 'rose' },
      { letter: '🛡️', icon: '🛡️', top: '88%', left: '45%', size: 40, rotation: -5, duration: 11, delay: 5, opacity: 0.45, accent: 'cyan' },
      { letter: '🤖', icon: '🤖', top: '15%', left: '32%', size: 38, rotation: 10, duration: 14, delay: 1, opacity: 0.45, accent: 'purple' },
      { letter: '📖', icon: '📖', top: '85%', left: '70%', size: 38, rotation: -14, duration: 12, delay: 3.5, opacity: 0.4, accent: 'emerald' },
    ],
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0">
      {tiles.map((t, i) => {
        const style = ACCENT_STYLES[t.accent];
        return (
          <div
            key={i}
            className="absolute hidden sm:flex items-center justify-center rounded-2xl border shadow-2xl transition-transform"
            style={{
              top: t.top,
              left: t.left,
              width: `${t.size}px`,
              height: `${t.size}px`,
              opacity: t.opacity,
              transform: `rotate(${t.rotation}deg)`,
              boxShadow: `0 10px 30px rgba(0,0,0,0.6), 0 0 25px ${style.glow}`,
              animation: `floatTile ${t.duration}s ease-in-out infinite alternate`,
              animationDelay: `${t.delay}s`,
            }}
          >
            {/* 3D Tile Bevel Surface */}
            <div
              className={`relative flex h-full w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-b ${style.bg} ${style.border} border shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-3px_4px_rgba(0,0,0,0.4)]`}
            >
              {t.icon ? (
                <span className="text-xl sm:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] select-none">
                  {t.icon}
                </span>
              ) : (
                <>
                  <span
                    className={`font-black tracking-tight ${style.textColor} text-xl sm:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]`}
                    style={{ fontFamily: '"Inter Black Italic", sans-serif' }}
                  >
                    {t.letter}
                  </span>
                  {t.value !== undefined && (
                    <span
                      className={`absolute bottom-1 right-1.5 font-bold ${style.scoreColor} text-[9px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]`}
                    >
                      {t.value}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      <style jsx global>{`
        @keyframes floatTile {
          0% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          50% {
            transform: translateY(-16px) rotate(4deg) scale(1.03);
          }
          100% {
            transform: translateY(6px) rotate(-3deg) scale(0.98);
          }
        }
      `}</style>
    </div>
  );
}
