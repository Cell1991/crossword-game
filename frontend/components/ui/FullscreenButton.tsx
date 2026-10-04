'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Maximize, Minimize } from 'lucide-react';

interface FullscreenButtonProps {
  className?: string;
  showLabel?: boolean;
}

const subscribeToFullscreenSupport = () => () => {};
const getFullscreenSupport = () => Boolean(
  document.fullscreenEnabled ||
  (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
);
const getServerFullscreenSupport = () => true;

export default function FullscreenButton({ className = '', showLabel = true }: FullscreenButtonProps) {
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
      className={`group flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl border-2 border-purple-400/50 bg-gradient-to-r from-purple-500/20 via-purple-950/50 to-indigo-500/20 hover:from-purple-500/35 hover:to-indigo-500/35 hover:border-purple-300 text-xs sm:text-sm font-black text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.55)] hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${className}`}
      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    >
      {isFullscreen ? (
        <Minimize className="w-4 h-4 text-purple-300 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]" strokeWidth={2.5} />
      ) : (
        <Maximize className="w-4 h-4 text-purple-300 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]" strokeWidth={2.5} />
      )}
      {showLabel && (
        <span className="tracking-wide">
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </span>
      )}
    </button>
  );
}
