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
    <div className="flex flex-col items-center gap-2 p-6 bg-slate-900/90 border border-slate-700/60 rounded-3xl shadow-2xl backdrop-blur-md max-w-sm w-full mx-auto text-center">
      <span className="text-xs font-bold tracking-widest uppercase text-slate-400">
        GAME PIN
      </span>
      <button
        onClick={handleCopy}
        className="group flex items-center gap-3 px-6 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-2xl transition-all cursor-pointer shadow-inner"
        title="Click to copy Game PIN"
      >
        <span className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-amber-300 group-hover:scale-105 transition-transform">
          {formattedPin}
        </span>
        {copied ? (
          <Check className="w-6 h-6 text-emerald-400 animate-bounce" />
        ) : (
          <Copy className="w-5 h-5 text-slate-400 group-hover:text-slate-200" />
        )}
      </button>
      <span className="text-xs text-slate-400">
        Share this PIN with other players to join
      </span>
    </div>
  );
};
