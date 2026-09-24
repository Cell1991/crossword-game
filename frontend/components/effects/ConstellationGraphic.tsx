'use client';

import React, { useMemo } from 'react';
import { getConstellation } from '../../lib/constellations';

interface ConstellationGraphicProps {
  letter: string;
  isGolden?: boolean;
  className?: string;
}

export const ConstellationGraphic: React.FC<ConstellationGraphicProps> = ({
  letter,
  isGolden = false,
  className = '',
}) => {
  const constellation = useMemo(() => getConstellation(letter), [letter]);

  const lineColor = isGolden ? 'rgba(254, 240, 138, 0.22)' : 'rgba(186, 230, 253, 0.20)';
  const starGlowColor = isGolden ? 'rgba(245, 158, 11, 0.75)' : 'rgba(56, 189, 248, 0.75)';
  const starCoreColor = isGolden ? '#fef08a' : '#e0f2fe';
  const nebulaGlow = isGolden ? 'rgba(245, 158, 11, 0.14)' : 'rgba(56, 189, 248, 0.12)';

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden rounded-xl ${className}`}>
      {/* Soft Ethereal Nebula Stardust Glow in Background */}
      <div
        className="absolute inset-2 rounded-full blur-md transition-opacity"
        style={{
          background: `radial-gradient(circle, ${nebulaGlow} 0%, transparent 70%)`,
        }}
      />

      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id={`celestial-glow-${isGolden ? 'gold' : 'blue'}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style>{`
          @keyframes celestial-twinkle-1 {
            0%, 100% { opacity: 0.25; transform: scale(0.85); }
            50% { opacity: 0.95; transform: scale(1.2); }
          }
          @keyframes celestial-twinkle-2 {
            0%, 100% { opacity: 0.85; transform: scale(1.15); }
            50% { opacity: 0.2; transform: scale(0.8); }
          }
          @keyframes celestial-twinkle-3 {
            0%, 100% { opacity: 0.35; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.25); }
          }
          @keyframes celestial-line-flow {
            0%, 100% { opacity: 0.16; stroke-dashoffset: 0; }
            50% { opacity: 0.32; stroke-dashoffset: 4; }
          }
          .animate-twinkle-0 { animation: celestial-twinkle-1 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .animate-twinkle-1 { animation: celestial-twinkle-2 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .animate-twinkle-2 { animation: celestial-twinkle-3 3.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .animate-const-line { animation: celestial-line-flow 4.5s ease-in-out infinite; }
        `}</style>

        {/* Faint, Soft Starlight Constellation Lines */}
        {constellation.lines.map(([i, j], idx) => {
          const s1 = constellation.stars[i];
          const s2 = constellation.stars[j];
          if (!s1 || !s2) return null;
          return (
            <line
              key={`line-${idx}`}
              x1={s1.x * 100}
              y1={s1.y * 100}
              x2={s2.x * 100}
              y2={s2.y * 100}
              stroke={lineColor}
              strokeWidth="0.9"
              strokeDasharray="2.5 2"
              strokeLinecap="round"
              className="animate-const-line"
              style={{ animationDelay: `${(idx * 0.4) % 3}s` }}
            />
          );
        })}

        {/* Soft, Animated Twinkling Constellation Stars */}
        {constellation.stars.map((star, idx) => {
          const cx = star.x * 100;
          const cy = star.y * 100;
          const animClass = `animate-twinkle-${idx % 3}`;

          if (star.isMajor) {
            // Major Star: 4-Point Diamond Flare Sparkle + Glowing Halo
            const arm = star.size * 2.0;
            return (
              <g
                key={`star-${idx}`}
                className={animClass}
                style={{ animationDelay: `${(idx * 0.6) % 3}s` }}
              >
                {/* Soft Star Halo */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={star.size * 2.2}
                  fill={starGlowColor}
                  opacity={0.5}
                  filter={`url(#celestial-glow-${isGolden ? 'gold' : 'blue'})`}
                />
                {/* Diamond 4-Point Sparkle Cross */}
                <path
                  d={`M ${cx} ${cy - arm} Q ${cx} ${cy} ${cx + arm} ${cy} Q ${cx} ${cy} ${cx} ${cy + arm} Q ${cx} ${cy} ${cx - arm} ${cy} Z`}
                  fill="#ffffff"
                  opacity={0.9}
                />
                {/* Core White Sparkle Center */}
                <circle cx={cx} cy={cy} r={star.size * 0.75} fill="#ffffff" />
              </g>
            );
          }

          return (
            <g
              key={`star-${idx}`}
              className={animClass}
              style={{ animationDelay: `${(idx * 0.7) % 3}s` }}
            >
              {/* Soft Star Halo */}
              <circle
                cx={cx}
                cy={cy}
                r={star.size * 1.5}
                fill={starGlowColor}
                opacity={0.38}
              />
              {/* Crisp Star Point */}
              <circle
                cx={cx}
                cy={cy}
                r={star.size * 0.75}
                fill={starCoreColor}
                opacity={0.85}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
