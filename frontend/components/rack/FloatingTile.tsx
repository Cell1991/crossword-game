'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { ConstellationGraphic } from '@/components/effects/ConstellationGraphic';
import { isBlankLetter } from '@/lib/tiles';
import { TILE_THEME_STYLE } from '@/lib/tileTheme';

interface FloatingTileProps {
  letter: string;
  value: number;
  /** Where the tile first appears. Afterwards the owner moves it with `moveFixedElement`. */
  position: { x: number; y: number };
  isDesignatedBlank?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The tile that follows the pointer while it is dragged. Portalled to <body>: the rack bar's
 * backdrop-blur makes it the containing block for `fixed` children, which drew this tile a
 * whole bar-height below the pointer.
 */
export const FloatingTile: React.FC<FloatingTileProps> = ({ letter, value, position, isDesignatedBlank = false, ref }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      className="tile-face pointer-events-none fixed z-[9999] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 rotate-2 scale-105 flex-col items-center justify-center rounded-xl border border-amber-100/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_14px_28px_rgba(71,31,5,0.58)] overflow-hidden"
      style={{ ...TILE_THEME_STYLE, left: position.x, top: position.y }}
      aria-hidden="true"
    >
      {/* Top Glass Specular Highlight */}
      <div className="absolute inset-x-1 top-0.5 h-[36%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10" />
      {/* Unique Letter Constellation Star Cluster */}
      <ConstellationGraphic letter={letter} />
      {isBlankLetter(letter) && !isDesignatedBlank ? (
        <div className="relative z-20 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="tile-blank-star w-8 h-8 animate-pulse" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
          </svg>
        </div>
      ) : (
        <span className="tile-letter tile-letter-orange relative z-20 text-[38px] leading-none font-maple">
          {letter}
        </span>
      )}
      <span className="tile-score-blue absolute z-20 bottom-1 right-1.5 rounded-sm bg-[#fff2d8]/90 px-0.5 text-[12px] font-mono font-black lg:rounded-none lg:bg-transparent lg:px-0 lg:text-[16px] lg:leading-none">
        {value}
      </span>
    </div>,
    document.body
  );
};
