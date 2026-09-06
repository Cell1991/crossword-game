'use client';

import React from 'react';
import { Tile } from '../../lib/types';
import { RotateCcw, Check, SkipForward } from 'lucide-react';

interface TileRackProps {
  rack: Tile[];
  selectedTileId: string | null;
  onSelectTile: (tile: Tile) => void;
  onCancelMove: () => void;
  onConfirmMove: () => void;
  onPassTurn: () => void;
  isMyTurn: boolean;
  hasTemporaryTiles: boolean;
  isSubmitting: boolean;
  estimatedScore?: number;
}

export const TileRack: React.FC<TileRackProps> = ({
  rack,
  selectedTileId,
  onSelectTile,
  onCancelMove,
  onConfirmMove,
  onPassTurn,
  isMyTurn,
  hasTemporaryTiles,
  isSubmitting,
  estimatedScore,
}) => {
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-2xl mx-auto px-4 pointer-events-auto">
      {/* Action Buttons Toolbar */}
      <div className="flex items-center justify-between w-full bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/60 shadow-2xl">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancelMove}
            disabled={!isMyTurn || !hasTemporaryTiles || isSubmitting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm transition-all ${
              isMyTurn && hasTemporaryTiles
                ? 'bg-rose-950/70 text-rose-300 hover:bg-rose-900 border border-rose-700/50 cursor-pointer shadow-sm'
                : 'bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          <button
            onClick={onPassTurn}
            disabled={!isMyTurn || hasTemporaryTiles || isSubmitting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm transition-all ${
              isMyTurn && !hasTemporaryTiles
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/60 cursor-pointer shadow-sm'
                : 'bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed'
            }`}
          >
            <SkipForward className="w-4 h-4" />
            <span>Pass</span>
          </button>
        </div>

        {/* Move preview / Points badge */}
        {hasTemporaryTiles && estimatedScore !== undefined && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-300 text-xs font-semibold animate-pulse">
            <span>PREVIEW:</span>
            <span className="text-amber-200 font-bold text-sm">+{estimatedScore} pts</span>
          </div>
        )}

        {/* Confirm Move */}
        <button
          onClick={onConfirmMove}
          disabled={!isMyTurn || !hasTemporaryTiles || isSubmitting}
          className={`flex items-center gap-2 px-5 py-1.5 rounded-xl font-semibold text-sm transition-all ${
            isMyTurn && hasTemporaryTiles
              ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 shadow-lg shadow-emerald-950/50 cursor-pointer border border-emerald-400/30'
              : 'bg-slate-800/40 text-slate-500 border border-slate-700/30 cursor-not-allowed'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{isSubmitting ? 'Confirming...' : 'Confirm Move'}</span>
        </button>
      </div>

      {/* Tiles Rack Stand */}
      <div className="relative flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-b from-amber-950/70 to-amber-900/90 backdrop-blur-md rounded-2xl border-2 border-amber-700/50 shadow-2xl shadow-amber-950/40 min-h-[82px]">
        {rack.length === 0 ? (
          <div className="text-amber-200/60 text-xs font-mono tracking-wide py-2">
            No tiles remaining in rack
          </div>
        ) : (
          rack.map((tile) => {
            const isSelected = selectedTileId === tile.id;
            return (
              <button
                key={tile.id}
                onClick={() => isMyTurn && onSelectTile(tile)}
                disabled={!isMyTurn}
                className={`group relative flex flex-col items-center justify-center w-11 h-12 sm:w-13 sm:h-14 rounded-xl font-sans transition-all select-none shadow-md ${
                  isSelected
                    ? '-translate-y-3 bg-amber-200 border-2 border-amber-500 shadow-amber-500/40 ring-4 ring-amber-400/40'
                    : isMyTurn
                    ? 'bg-amber-100 hover:bg-amber-50 active:translate-y-0.5 border border-amber-600/40 hover:-translate-y-1 cursor-pointer'
                    : 'bg-amber-100/50 border border-amber-700/30 opacity-70 cursor-not-allowed'
                }`}
              >
                <span className="text-xl sm:text-2xl font-black text-stone-900 leading-none">
                  {tile.letter}
                </span>
                <span className="absolute bottom-1 right-1.5 text-[9px] sm:text-[10px] font-bold text-stone-600">
                  {tile.value}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
