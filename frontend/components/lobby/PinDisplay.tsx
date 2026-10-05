'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface PinDisplayProps {
  pin: string;
}

export const PinDisplay: React.FC<PinDisplayProps> = ({ pin }) => {
  const [copied, setCopied] = useState(false);

  // Format 123456 as "123 456"
  const formattedPin = pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;

  const handleCopy = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2 p-4 sm:p-6 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 border-2 border-amber-400/40 rounded-3xl shadow-[0_16px_50px_rgba(0,0,0,0.8),0_0_40px_rgba(251,191,36,0.18)] backdrop-blur-2xl w-full text-center relative overflow-hidden ring-1 ring-amber-300/30">
      {/* Top Gold Accent Line */}
      <span className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-300 to-transparent shadow-[0_0_12px_rgba(251,191,36,0.8)]" />

      <span className="text-[11px] font-black tracking-[0.2em] uppercase text-amber-200/80">
        GAME PIN
      </span>

      <button
        onClick={handleCopy}
        className={`group relative flex items-center justify-center gap-2.5 sm:gap-3 px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl border-2 transition-all cursor-pointer ${
          copied
            ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/50'
            : 'bg-slate-950/80 hover:bg-amber-400/10 border-amber-400/50 hover:border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.2)] hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]'
        }`}
        title="Click to copy Game PIN"
      >
        <span className="text-3xl sm:text-5xl font-black font-mono tracking-[0.15em] bg-gradient-to-b from-white via-amber-200 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(251,191,36,0.7)] group-hover:scale-105 transition-transform">
          {formattedPin}
        </span>
        {copied ? (
          <span className="flex items-center gap-1 text-emerald-300 font-black text-xs uppercase tracking-wider shrink-0 bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-400/40">
            <Check className="w-4 h-4 text-emerald-300" />
            <span>Copied!</span>
          </span>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 group-hover:bg-amber-400/30 group-hover:scale-110 transition-all shrink-0">
            <Copy className="w-4 h-4" />
          </div>
        )}
      </button>

      <span className="text-[11px] font-semibold text-amber-200/60 mt-0.5">
        {copied ? (
          <span className="text-emerald-300 font-bold">PIN copied to clipboard!</span>
        ) : (
          'Click PIN to copy or share with other players'
        )}
      </span>
    </div>
  );
};
