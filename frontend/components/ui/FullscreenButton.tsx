'use client';

import React, { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';

interface FullscreenButtonProps {
  className?: string;
}

export default function FullscreenButton({ className = '' }: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isSupported = Boolean(
      document.fullscreenEnabled ||
      (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
    );
    setSupported(isSupported);

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
      className={`group flex items-center justify-center rounded-xl border border-white/10 bg-slate-900/60 p-2 text-slate-300 shadow-lg backdrop-blur-md transition-all hover:border-white/20 hover:bg-slate-800/80 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${className}`}
      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (เต็มจอ)'}
      aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    >
      {isFullscreen ? (
        <Minimize className="h-4 w-4 text-cyan-300 transition-transform group-hover:scale-110" />
      ) : (
        <Maximize className="h-4 w-4 transition-transform group-hover:scale-110" />
      )}
    </button>
  );
}
