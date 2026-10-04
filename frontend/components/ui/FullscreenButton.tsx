'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Maximize, Minimize } from 'lucide-react';

interface FullscreenButtonProps {
  className?: string;
}

const subscribeToFullscreenSupport = () => () => {};
const getFullscreenSupport = () => Boolean(
  document.fullscreenEnabled ||
  (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
);
const getServerFullscreenSupport = () => true;

export default function FullscreenButton({ className = '' }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const supported = useSyncExternalStore(subscribeToFullscreenSupport, getFullscreenSupport, getServerFullscreenSupport);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateFullscreen = () => {
      setIsFullscreen(Boolean(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      ));
    };

    document.addEventListener('fullscreenchange', updateFullscreen);
    document.addEventListener('webkitfullscreenchange', updateFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      document.removeEventListener('webkitfullscreenchange', updateFullscreen);
    };
  }, []);

  if (!supported) return null;

  const toggleFullscreen = async () => {
    try {
      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
      };
      const docEl = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
      };

      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className={`group flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl border-2 border-slate-600/50 bg-gradient-to-r from-slate-800/40 via-slate-900/60 to-slate-800/40 hover:from-slate-700/50 hover:to-slate-800/50 hover:border-slate-400 text-slate-200 shadow-[0_0_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_25px_rgba(148,163,184,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${className}`}
      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    >
      {isFullscreen ? (
        <Minimize className="h-4 w-4 text-cyan-300 transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" strokeWidth={2.5} />
      ) : (
        <Maximize className="h-4 w-4 text-slate-300 group-hover:text-cyan-300 transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" strokeWidth={2.5} />
      )}
    </button>
  );
}
