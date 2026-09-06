'use client';

import React from 'react';
import { ZoomIn, ZoomOut, Compass } from 'lucide-react';

interface BoardControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  scale: number;
  minScale: number;
  maxScale: number;
}

export const BoardControls: React.FC<BoardControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  scale,
  minScale,
  maxScale,
}) => {
  const isMinZoom = scale <= minScale;
  const isMaxZoom = scale >= maxScale;

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-xl">
      <button
        onClick={onZoomIn}
        disabled={isMaxZoom}
        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        title="Zoom In"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-5 h-5" />
      </button>

      <button
        onClick={onZoomOut}
        disabled={isMinZoom}
        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-5 h-5" />
      </button>

      <div className="h-px bg-slate-700/60 my-0.5" />

      <button
        onClick={onReset}
        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        title="Reset zoom and center board"
        aria-label="Reset zoom and center board"
      >
        <Compass className="w-5 h-5" />
      </button>

      <div className="text-[10px] text-center font-mono font-medium text-slate-400 py-0.5">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
};
