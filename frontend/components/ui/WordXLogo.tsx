'use client';

import React from 'react';

interface WordXLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export default function WordXLogo({ size = 'md', className = '', showText = true }: WordXLogoProps) {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  const iconDim = isLarge ? 84 : isSmall ? 44 : 64;
  const titleClasses = isLarge
    ? 'text-4xl sm:text-5xl md:text-6xl'
    : isSmall
    ? 'text-xl sm:text-2xl'
    : 'text-3xl sm:text-4xl';

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Ambient RGB Cyber Glow */}
      <div className="pointer-events-none absolute -inset-6 sm:-inset-8 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-cyan-500/20 blur-3xl opacity-75" />

      {/* Main Logo Composition */}
      <div className="relative flex items-center gap-3.5 sm:gap-5 cursor-pointer group">
        
        {/* 3D Mechanical Keycap Icon */}
        <div className="relative flex items-center justify-center transform group-hover:scale-105 group-hover:-translate-y-1 transition-all duration-300">
          <svg
            width={iconDim}
            height={iconDim}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)]"
          >
            <defs>
              {/* Top Face Keycap Gradient */}
              <linearGradient id="keycapTop" x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="40%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>

              {/* Front Face Keycap Gradient */}
              <linearGradient id="keycapFront" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="50%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>

              {/* Right Face Keycap Gradient (Shaded) */}
              <linearGradient id="keycapRight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>

              {/* Glowing Bevel Stroke */}
              <linearGradient id="keycapBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="35%" stopColor="#F59E0B" />
                <stop offset="70%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>

              {/* Top Rim Specular Highlight */}
              <linearGradient id="topRim" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#CBD5E1" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#64748B" stopOpacity="0.4" />
              </linearGradient>

              {/* Blazing X Core Fire Gradient */}
              <linearGradient id="xGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFBEB" />
                <stop offset="30%" stopColor="#FDE047" />
                <stop offset="70%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>

              {/* Word Legend Gradient */}
              <linearGradient id="wordLegend" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#E2E8F0" />
                <stop offset="50%" stopColor="#CBD5E1" />
                <stop offset="100%" stopColor="#94A3B8" />
              </linearGradient>

              {/* Underglow RGB Filter */}
              <filter id="rgbGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* RGB Mechanical Switch Underglow Base */}
            <path
              d="M16 80 L60 106 L104 80"
              stroke="#F59E0B"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.6"
              filter="url(#rgbGlow)"
            />
            <path
              d="M16 80 L60 106 L104 80"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.8"
            />

            {/* 1. KEYCAP RIGHT SIDE WALL */}
            <path
              d="M60 62 L100 38 L104 78 L60 104 Z"
              fill="url(#keycapRight)"
              stroke="#1E293B"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* 2. KEYCAP FRONT SIDE WALL */}
            <path
              d="M20 38 L60 62 L60 104 L16 78 Z"
              fill="url(#keycapFront)"
              stroke="#334155"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* "WORD" Text Engraved on Front Keycap Wall (Isometric Skew) */}
            <g transform="translate(18, 54) skewY(28) scale(0.9, 0.85)">
              <text
                x="6"
                y="18"
                fill="url(#wordLegend)"
                fontSize="15"
                fontWeight="900"
                fontFamily="system-ui, -apple-system, sans-serif"
                letterSpacing="2.5"
                opacity="0.95"
                filter="drop-shadow(0 1px 2px rgba(0,0,0,0.9))"
              >
                WORD
              </text>
            </g>

            {/* 3. KEYCAP TOP SURFACE DISH */}
            <path
              d="M60 14 L98 37 L60 60 L22 37 Z"
              fill="url(#keycapTop)"
              stroke="url(#topRim)"
              strokeWidth="2"
              strokeLinejoin="round"
            />

            {/* Inner Chamfer Bevel on Top Surface */}
            <path
              d="M60 19 L92 37 L60 55 L28 37 Z"
              fill="#0F172A"
              fillOpacity="0.4"
              stroke="url(#keycapBorder)"
              strokeWidth="1"
              strokeOpacity="0.6"
              strokeLinejoin="round"
            />

            {/* 4. BOLD GLOWING "X" ON TOP SURFACE (ISOMETRIC PROJECTED) */}
            <g transform="translate(60, 37) rotate(0)">
              {/* Isometric X Arms */}
              {/* Arm 1: Top-Left to Bottom-Right */}
              <polygon
                points="-14,-10 -7,-14 14,10 7,14"
                fill="url(#xGlow)"
                filter="url(#rgbGlow)"
              />
              <polygon
                points="-14,-10 -7,-14 14,10 7,14"
                fill="url(#xGlow)"
              />

              {/* Arm 2: Top-Right to Bottom-Left */}
              <polygon
                points="14,-10 7,-14 -14,10 -7,14"
                fill="url(#xGlow)"
                filter="url(#rgbGlow)"
              />
              <polygon
                points="14,-10 7,-14 -14,10 -7,14"
                fill="url(#xGlow)"
              />

              {/* Specular Core Jewel on X Center */}
              <circle
                cx="0"
                cy="0"
                r="3"
                fill="#FFFFFF"
                className="animate-pulse"
                opacity="0.9"
              />
            </g>

            {/* Top-Left Crisp Edge Highlight Reflection */}
            <path
              d="M60 14 L22 37 L16 78"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.5"
            />
          </svg>
        </div>

        {/* Text Title Beside Logo */}
        {showText && (
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
        )}

      </div>
    </div>
  );
}
