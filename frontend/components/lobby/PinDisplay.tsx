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
    <div className="flex flex-col items-center gap-2.5 p-6 bg-slate-900/90 border border-slate-700/60 rounded-3xl shadow-2xl backdrop-blur-md max-w-sm w-full mx-auto text-center">
      <span className="text-xs font-bold tracking-widest uppercase text-slate-400">
        GAME PIN
      </span>
      <button
        onClick={handleCopy}
        className={`tactile-button group flex items-center gap-3 px-6 py-2.5 rounded-2xl border transition-all cursor-pointer shadow-inner ${
          copied
            ? 'bg-emerald-950/40 border-emerald-500/70 shadow-[0_0_20px_rgba(52,211,153,0.3)] ring-1 ring-emerald-400/50'
            : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 hover:border-amber-400/40'
        }`}
        title="Click to copy Game PIN"
      >
        <span className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-amber-300 group-hover:scale-105 transition-transform">
          {formattedPin}
        </span>
        {copied ? (
          <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Check className="w-5 h-5 text-emerald-400" />
            <span>Copied!</span>
          </span>
        ) : (
          <Copy className="w-5 h-5 text-slate-400 group-hover:text-amber-200 transition-colors" />
        )}
      </button>
      <span className="text-xs text-slate-400">
        {copied ? (
          <span className="text-emerald-400 font-medium">PIN copied to clipboard</span>
        ) : (
          'Click PIN to copy or share with other players'
        )}
      </span>
    </div>
  );
};
