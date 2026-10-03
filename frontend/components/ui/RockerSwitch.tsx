'use client';

import React from 'react';

interface RockerSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export const RockerSwitch: React.FC<RockerSwitchProps> = ({
  checked,
  onChange,
  id,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`group relative flex w-full h-[41px] sm:h-[42px] items-center justify-between p-1 rounded-xl border select-none transition-all duration-200 cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
        checked
          ? 'border-amber-400/60 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_0_15px_rgba(245,158,11,0.15)]'
          : 'border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] hover:border-white/20'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'} ${className}`}
    >
      {/* Recessed Switch Track */}
      <div className="relative flex w-full h-full items-center justify-between rounded-lg bg-slate-950/80 p-0.5 border border-white/[0.06]">
        
        {/* Sliding / Rocking Rectangular Button */}
        <div
          className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md transition-all duration-200 ease-out flex items-center justify-center ${
            checked
              ? 'left-[calc(50%+1px)] bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-[0_2px_6px_rgba(245,158,11,0.4),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3)]'
              : 'left-0.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-850 text-slate-300 shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.4)]'
          }`}
        >
          {/* Rocker Center Ridge & Status Indicator */}
          <div className="flex items-center gap-1.5 px-2">
            {checked ? (
              <>
                <span className="h-2 w-0.5 rounded-full bg-slate-950/60" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.3)]">
                  ON
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-950 shadow-[0_0_4px_rgba(0,0,0,0.5)]" />
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500/60 border border-slate-400/30" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  OFF
                </span>
                <span className="h-2 w-0.5 rounded-full bg-slate-600/50" />
              </>
            )}
          </div>
        </div>

        {/* Background Labels (Inactive placeholders for realistic wall plate feel) */}
        <div className="flex w-1/2 items-center justify-center">
          <span
            className={`text-[10px] font-bold tracking-wider transition-opacity duration-150 ${
              checked ? 'opacity-30 text-slate-500' : 'opacity-0'
            }`}
          >
            OFF
          </span>
        </div>

        <div className="flex w-1/2 items-center justify-center">
          <span
            className={`text-[10px] font-bold tracking-wider transition-opacity duration-150 ${
              checked ? 'opacity-0' : 'opacity-30 text-slate-500'
            }`}
          >
            ON
          </span>
        </div>
      </div>
    </button>
  );
};
