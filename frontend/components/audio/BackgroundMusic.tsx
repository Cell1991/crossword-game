'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const DEFAULT_VOLUME = 1.0;
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
 * Visual controls are hidden per user request; audio defaults to full volume (1.0).
 */
export default function BackgroundMusic({
  src = '/audio/autumn-day.mp3',
}: BackgroundMusicProps) {
  const pathname = usePathname();
  const controlsRef = useRef<{ play: () => void; pause: () => void }>({ play: () => {}, pause: () => {} });
  const mutedRef = useRef(false);
  const volumeRef = useRef(DEFAULT_VOLUME);

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

  // Visual controls hidden per request; audio continues playing in background at full volume
  return null;
}
