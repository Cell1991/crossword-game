'use client';

import React, { useMemo } from 'react';
import { getConstellationData } from '../../lib/constellations';

interface ConstellationGraphicProps {
  letter: string;
  isGolden?: boolean;
  className?: string;
}

// Build 8-pointed starburst path centred at (cx, cy)
function starburstPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const points = 8;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    d += (i === 0 ? 'M' : 'L') + `${px.toFixed(2)},${py.toFixed(2)}`;
  }
  return d + 'Z';
}

export const ConstellationGraphic: React.FC<ConstellationGraphicProps> = ({
  letter,
  isGolden = false,
  className = '',
}) => {
  const data = useMemo(() => getConstellationData(letter), [letter]);

  // Colour palette — faint translucent starlight for golden tiles, crisp celestial cyan for blue tiles
  const lineColor  = isGolden ? 'rgba(255, 255, 255, 0.12)' : 'rgba(147, 220, 252, 0.22)';
  const glowColor  = isGolden ? 'rgba(254, 240, 138, 0.20)' : 'rgba(56,  189, 248, 0.65)';
  const coreColor  = isGolden ? 'rgba(255, 255, 255, 0.45)' : '#e0f2fe';
  const burstColor = isGolden ? 'rgba(255, 255, 255, 0.50)' : '#bae6fd';
  const filterId   = `cg-glow-${isGolden ? 'g' : 'b'}`;

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden rounded-xl ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          {/* Soft glow filter for star halos */}
          <filter id={filterId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <style>{`
            @keyframes cg-twinkle-a {
              0%, 100% { opacity: 0.30; transform: scale(0.88); }
              48%       { opacity: 1.00; transform: scale(1.18); }
            }
            @keyframes cg-twinkle-b {
              0%, 100% { opacity: 0.90; transform: scale(1.12); }
              52%       { opacity: 0.22; transform: scale(0.82); }
            }
            @keyframes cg-twinkle-c {
              0%, 100% { opacity: 0.40; transform: scale(0.92); }
              44%       { opacity: 1.00; transform: scale(1.22); }
            }
            @keyframes cg-line-pulse {
              0%, 100% { opacity: 0.55; }
              50%       { opacity: 1.00; }
            }
            .cg-tw-a { animation: cg-twinkle-a 3.1s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
            .cg-tw-b { animation: cg-twinkle-b 2.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
            .cg-tw-c { animation: cg-twinkle-c 3.7s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
            .cg-line  { animation: cg-line-pulse 5.0s ease-in-out infinite; }
          `}</style>
        </defs>

        {/* ── Background stardust specks ── */}
        {data.dust.map((speck, i) => (
          <circle
            key={`d${i}`}
            cx={speck.x * 100}
            cy={speck.y * 100}
            r={speck.r}
            fill={coreColor}
            opacity={speck.opacity * (isGolden ? 0.16 : 0.55)}
          />
        ))}

        {/* ── Constellation lines — thin, straight, solid ── */}
        {data.lines.map(([i, j], idx) => {
          const s1 = data.stars[i];
          const s2 = data.stars[j];
          if (!s1 || !s2) return null;
          return (
            <line
              key={`l${idx}`}
              x1={s1.x * 100}
              y1={s1.y * 100}
              x2={s2.x * 100}
              y2={s2.y * 100}
              stroke={lineColor}
              strokeWidth="0.85"
              strokeLinecap="round"
              className="cg-line"
              style={{ animationDelay: `${(idx * 0.55) % 4.5}s` }}
            />
          );
        })}

        {/* ── Stars ── */}
        {data.stars.map((star, idx) => {
          const cx = star.x * 100;
          const cy = star.y * 100;
          const sizeScale = star.size ?? 1.0;
          const twClass = ['cg-tw-a', 'cg-tw-b', 'cg-tw-c'][idx % 3];
          const delay = `${(idx * 0.65) % 3.5}s`;

          if (star.isStarburst) {
            // 8-pointed starburst for major stars
            const outer = sizeScale * 4.0;
            const inner = sizeScale * 1.6;
            return (
              <g key={`s${idx}`} className={twClass} style={{ animationDelay: delay }}>
                {/* Soft outer glow halo */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={outer * 1.6}
                  fill={glowColor}
                  opacity={0.28}
                  filter={`url(#${filterId})`}
                />
                {/* 8-pointed starburst */}
                <path
                  d={starburstPath(cx, cy, outer, inner)}
                  fill={burstColor}
                  opacity={0.92}
                  filter={`url(#${filterId})`}
                />
                {/* Bright core dot */}
                <circle cx={cx} cy={cy} r={sizeScale * 1.1} fill="#ffffff" opacity={0.95} />
              </g>
            );
          }

          // Regular star — round dot + soft halo
          const r = Math.max(1.1, sizeScale * 1.5);
          return (
            <g key={`s${idx}`} className={twClass} style={{ animationDelay: delay }}>
              {/* Soft halo */}
              <circle
                cx={cx}
                cy={cy}
                r={r * 2.2}
                fill={glowColor}
                opacity={0.22}
                filter={`url(#${filterId})`}
              />
              {/* Core dot */}
              <circle cx={cx} cy={cy} r={r} fill={coreColor} opacity={0.88} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
