'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { ConstellationGraphic } from '@/components/effects/ConstellationGraphic';
import { isBlankLetter } from '@/lib/tiles';

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
      className="pointer-events-none fixed z-[9999] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 rotate-2 scale-105 flex-col items-center justify-center rounded-xl border border-sky-400/50 bg-gradient-to-b from-[#23407a] via-[#1a305e] to-[#122244] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_28px_rgba(0,0,0,0.7)] overflow-hidden"
      style={{ left: position.x, top: position.y }}
      aria-hidden="true"
    >
      {/* Top Glass Specular Highlight */}
      <div className="absolute inset-x-1 top-0.5 h-[36%] rounded-t-lg bg-gradient-to-b from-white/20 to-transparent pointer-events-none z-10" />
      {/* Unique Letter Constellation Star Cluster */}
      <ConstellationGraphic letter={letter} />
      {isBlankLetter(letter) && !isDesignatedBlank ? (
        <div className="relative z-20 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_14px_rgba(56,189,248,0.95)] animate-pulse" fill="currentColor">
            <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
          </svg>
        </div>
      ) : (
        <span className={`tile-letter relative z-20 text-[38px] font-normal leading-none font-quakduck ${isDesignatedBlank ? 'tile-letter-gold' : 'text-slate-50'}`}>
          {letter}
        </span>
      )}
      <span className="absolute z-20 bottom-1 right-1.5 text-[12px] font-mono font-bold text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]">
        {value}
      </span>
    </div>,
    document.body
  );
};
