'use client';

import React from 'react';

interface WordXLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function WordXLogo({ size = 'md', className = '' }: WordXLogoProps) {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  const iconDim = isLarge ? 72 : isSmall ? 40 : 56;
  const titleClasses = isLarge
    ? 'text-5xl sm:text-6xl'
    : isSmall
    ? 'text-2xl sm:text-3xl'
    : 'text-4xl sm:text-5xl';

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute -inset-4 sm:-inset-6 rounded-full bg-gradient-to-r from-amber-500/25 via-cyan-500/20 to-orange-500/25 blur-3xl" />

      {/* Main Logo Composition */}
      <div className="relative flex items-center gap-3 sm:gap-4.5 cursor-pointer group">
        
        {/* Emblem Crest */}
        <div className="relative flex items-center justify-center transform group-hover:scale-105 group-hover:rotate-1 transition-all duration-300">
          <svg
            width={iconDim}
            height={iconDim}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]"
          >
            <defs>
              {/* Outer Golden Border Gradient */}
              <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="40%" stopColor="#F59E0B" />
                <stop offset="70%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#78350F" />
              </linearGradient>

              {/* Inner Shield Gradient */}
              <linearGradient id="shieldBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="60%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#030712" />
              </linearGradient>

              {/* Blazing X Core Gradient */}
              <linearGradient id="xFire" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFBEB" />
                <stop offset="25%" stopColor="#FDE047" />
                <stop offset="65%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>

              {/* Cyan Accent Gradient */}
              <linearGradient id="cyanGlow" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>

              {/* Drop Shadow Filter for Inset Depth */}
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Shield Background Hexagon / Rounded Diamond */}
            <path
              d="M50 4 L92 26 L92 74 L50 96 L8 74 L8 26 Z"
              fill="url(#shieldBg)"
              stroke="url(#goldBorder)"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />

            {/* Inner Cyber Rune Lines */}
            <path
              d="M50 14 L82 31 L82 69 L50 86 L18 69 L18 31 Z"
              fill="none"
              stroke="url(#cyanGlow)"
              strokeWidth="1.5"
              strokeOpacity="0.45"
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />

            {/* Corner Power Nodes */}
            <circle cx="50" cy="14" r="2.5" fill="#38BDF8" />
            <circle cx="82" cy="50" r="2.5" fill="#F59E0B" />
            <circle cx="18" cy="50" r="2.5" fill="#F59E0B" />
            <circle cx="50" cy="86" r="2.5" fill="#38BDF8" />

            {/* Stylized 3D Sharp Tactical "X" */}
            <g filter="url(#glowFilter)">
              {/* Arm 1 (Top-Left to Bottom-Right) */}
              <polygon
                points="30,28 39,24 72,72 63,76"
                fill="url(#xFire)"
              />
              <polygon
                points="30,28 35,32 67,80 63,76"
                fill="#B45309"
                opacity="0.8"
              />

              {/* Arm 2 (Top-Right to Bottom-Left) */}
              <polygon
                points="70,28 61,24 28,72 37,76"
                fill="url(#xFire)"
              />
              <polygon
                points="70,28 65,32 33,80 37,76"
                fill="#B45309"
                opacity="0.8"
              />

              {/* Center Diamond Core Jewel */}
              <polygon
                points="50,42 58,50 50,58 42,50"
                fill="#FFF"
                className="animate-pulse"
              />
            </g>
          </svg>
        </div>

        {/* Text Title */}
        <div className="flex items-baseline">
          <span
            className={`font-black tracking-wider uppercase bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] ${titleClasses}`}
          >
            Word
          </span>
          <span
            className={`font-black tracking-tight bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent ml-1 drop-shadow-[0_0_30px_rgba(245,158,11,0.9)] ${titleClasses}`}
          >
            X
          </span>
        </div>

      </div>
    </div>
  );
}
