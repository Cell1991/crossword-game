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

  const lineColor = isGolden ? 'rgba(254, 240, 138, 0.35)' : 'rgba(125, 211, 252, 0.30)';
  const starGlowColor = isGolden ? 'rgba(251, 191, 36, 0.9)' : 'rgba(56, 189, 248, 0.9)';
  const starFillColor = isGolden ? '#fef08a' : '#e0f2fe';
  const majorFillColor = '#ffffff';

  return (
    <svg
      viewBox="0 0 100 100"
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-visible ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id={`star-glow-${isGolden ? 'gold' : 'blue'}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Constellation Connection Lines */}
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
            strokeWidth="1.2"
            strokeDasharray="2 1.5"
            strokeLinecap="round"
          />
        );
      })}

      {/* Secondary & Minor Star Dots */}
      {constellation.stars.map((star, idx) => {
        const cx = star.x * 100;
        const cy = star.y * 100;

        if (star.isMajor) {
          // 4-point Diamond Star Sparkle for Major Stars
          const arm = star.size * 2.2;
          return (
            <g key={`star-${idx}`}>
              {/* Star Glow Disk */}
              <circle
                cx={cx}
                cy={cy}
                r={star.size * 2.4}
                fill={starGlowColor}
                opacity={0.65}
                filter={`url(#star-glow-${isGolden ? 'gold' : 'blue'})`}
              />
              {/* Diamond 4-Point Sparkle Cross */}
              <path
                d={`M ${cx} ${cy - arm} Q ${cx} ${cy} ${cx + arm} ${cy} Q ${cx} ${cy} ${cx} ${cy + arm} Q ${cx} ${cy} ${cx - arm} ${cy} Z`}
                fill={majorFillColor}
                opacity={0.95}
              />
              {/* Star Center Bright Dot */}
              <circle cx={cx} cy={cy} r={star.size * 0.9} fill="#ffffff" />
            </g>
          );
        }

        return (
          <g key={`star-${idx}`}>
            <circle
              cx={cx}
              cy={cy}
              r={star.size * 1.8}
              fill={starGlowColor}
              opacity={0.45}
            />
            <circle
              cx={cx}
              cy={cy}
              r={star.size * 0.9}
              fill={starFillColor}
            />
          </g>
        );
      })}
    </svg>
  );
};
