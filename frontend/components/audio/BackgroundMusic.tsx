'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Volume2, VolumeX } from 'lucide-react';

const DEFAULT_VOLUME = 0.85;
const INTRO_FADE_MS = 600;
const CROSSFADE_S = 6;
const MUTE_KEY = 'wordx.music.muted';
const VOLUME_KEY = 'wordx.music.volume';

interface BackgroundMusicProps {
  src?: string;
}

/**
 * Global background music manager.
 * Mounted in root layout to guarantee continuous, gapless playback across Home & Lobby navigations.
 * Automatically paused when entering active gameplay (/game/*).
 */
export default function BackgroundMusic({
  src = '/audio/autumn-day.mp3',
}: BackgroundMusicProps) {
  const pathname = usePathname();
  const controlsRef = useRef<{ play: () => void; pause: () => void }>({ play: () => {}, pause: () => {} });
  const mutedRef = useRef(false);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const isGamePage = Boolean(pathname?.startsWith('/game'));

  useEffect(() => {
    let savedMuted = false;
    try { savedMuted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }
    let savedVolume = DEFAULT_VOLUME;
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      const parsed = raw === null ? NaN : Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        savedVolume = Math.min(1, Math.max(0.1, parsed));
      }
    } catch { /* storage unavailable */ }

    mutedRef.current = savedMuted;
    volumeRef.current = savedVolume;
    setMuted(savedMuted);
    setVolume(savedVolume);

    const players = [new Audio(src), new Audio(src)];
    players.forEach((p) => { p.preload = 'auto'; p.volume = 0; });

    let active = 0;
    let introStart = 0;
    let raf: number | null = null;
    let started = false;

    const tick = () => {
      const cur = players[active];
      const next = players[1 - active];
      const target = volumeRef.current;
      const d = cur.duration;
      if (Number.isFinite(d) && d > CROSSFADE_S * 2) {
        const remaining = d - cur.currentTime;
        if (remaining <= CROSSFADE_S) {
          if (next.paused) { next.currentTime = 0; void next.play().catch(() => {}); }
          const t = 1 - remaining / CROSSFADE_S;
          cur.volume = target * (1 - t);
          next.volume = target * t;
        } else {
          cur.volume = Math.min(target, ((performance.now() - introStart) / INTRO_FADE_MS) * target);
        }
        if (cur.ended || remaining <= 0.05) {
          cur.pause();
          cur.currentTime = 0;
          active = 1 - active;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const stopLoop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
    const play = () => {
      // Don't play if currently on game screen or user muted
      if (mutedRef.current || pathname?.startsWith('/game')) return;
      const cur = players[active];
      cur.play().then(() => {
        started = true;
        introStart = performance.now();
        stopLoop();
        raf = requestAnimationFrame(tick);
      }).catch(() => { /* blocked; waits for user gesture */ });
    };
    const pause = () => { stopLoop(); players.forEach((p) => p.pause()); };
    controlsRef.current = { play, pause };

    const onGesture = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      if (!mutedRef.current && !started && !pathname?.startsWith('/game')) play();
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    if (!savedMuted && !pathname?.startsWith('/game')) play();

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      pause();
      controlsRef.current = { play: () => {}, pause: () => {} };
    };
  }, [pathname, src]);

  // Pause when on game page; resume when returning to Home/Lobby
  useEffect(() => {
    if (isGamePage) {
      controlsRef.current.pause();
    } else {
      if (!mutedRef.current) {
        controlsRef.current.play();
      }
    }
  }, [isGamePage]);

  const changeVolume = (value: number) => {
    volumeRef.current = value;
    setVolume(value);
    try { localStorage.setItem(VOLUME_KEY, String(value)); } catch { /* storage unavailable */ }
    const shouldMute = value === 0;
    if (shouldMute !== mutedRef.current) {
      mutedRef.current = shouldMute;
      setMuted(shouldMute);
      try { localStorage.setItem(MUTE_KEY, shouldMute ? '1' : '0'); } catch { /* storage unavailable */ }
      if (shouldMute) controlsRef.current.pause();
      else if (!isGamePage) controlsRef.current.play();
    }
  };

  const toggle = () => {
    const next = !muted;
    if (!next && volumeRef.current === 0) changeVolume(DEFAULT_VOLUME);
    mutedRef.current = next;
    setMuted(next);
    try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
    if (next) controlsRef.current.pause();
    else if (!isGamePage) controlsRef.current.play();
  };

  // Don't render the music control widget in gameplay
  if (isGamePage) return null;

  return (
    <div className="fixed bottom-4 right-4 z-20 flex items-end gap-3 transition-opacity duration-300">
      <div className="group flex flex-col items-center gap-3">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          aria-label="Music volume"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
          className="h-24 w-1 cursor-pointer accent-amber-300 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={muted ? 'Unmute music' : 'Mute music'}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-300 backdrop-blur-md transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 shadow-lg cursor-pointer active:scale-95"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-amber-300" />}
        </button>
      </div>
    </div>
  );
}
