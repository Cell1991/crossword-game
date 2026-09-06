'use client';

import React from 'react';
import { ZoomIn, ZoomOut, Compass, Maximize2 } from 'lucide-react';

interface BoardControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  scale: number;
}

export const BoardControls: React.FC<BoardControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  scale,
}) => {
  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-xl">
      <button
        onClick={onZoomIn}
        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        title="Zoom In"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-5 h-5" />
      </button>

      <button
        onClick={onZoomOut}
        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-5 h-5" />
      </button>

      <div className="h-px bg-slate-700/60 my-0.5" />

      <button
        onClick={onReset}
        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        title="Center Board (Star 31, 31)"
        aria-label="Center Board"
      >
        <Compass className="w-5 h-5" />
      </button>

      <div className="text-[10px] text-center font-mono font-medium text-slate-400 py-0.5">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
};
