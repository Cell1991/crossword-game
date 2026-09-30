'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const TARGET_VOLUME = 0.25;
const INTRO_FADE_MS = 2500;
const CROSSFADE_S = 6;
const MUTE_KEY = 'wordx.music.muted';

interface BackgroundMusicProps {
  src: string;
  credit?: string;
}

/**
 * Background track that loops without a gap: two copies of the audio take turns,
 * and the next copy fades in while the current one fades out near its end.
 * (`audio.loop` restarts abruptly with a silent hitch.)
 * Browsers block autoplay, so playback starts on the first user gesture.
 */
export default function BackgroundMusic({ src, credit }: BackgroundMusicProps) {
  const controlsRef = useRef<{ play: () => void; pause: () => void }>({ play: () => {}, pause: () => {} });
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let savedMuted = false;
    try { savedMuted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }
    mutedRef.current = savedMuted;
    queueMicrotask(() => setMuted(savedMuted));

    const players = [new Audio(src), new Audio(src)];
    players.forEach((p) => { p.preload = 'auto'; p.volume = 0; });
    let active = 0;
    let raf: number | null = null;
    let started = false;

    const tick = () => {
      const cur = players[active];
      const next = players[1 - active];
      const d = cur.duration;
      if (Number.isFinite(d) && d > CROSSFADE_S * 2) {
        const remaining = d - cur.currentTime;
        if (remaining <= CROSSFADE_S) {
          if (next.paused) { next.currentTime = 0; void next.play().catch(() => {}); }
          const t = 1 - remaining / CROSSFADE_S;
          cur.volume = TARGET_VOLUME * (1 - t);
          next.volume = TARGET_VOLUME * t;
        } else if (cur.volume < TARGET_VOLUME) {
          cur.volume = Math.min(TARGET_VOLUME, (cur.currentTime / (INTRO_FADE_MS / 1000)) * TARGET_VOLUME);
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
      const cur = players[active];
      cur.play().then(() => {
        started = true;
        stopLoop();
        raf = requestAnimationFrame(tick);
      }).catch(() => { /* blocked; waits for a gesture */ });
    };
    const pause = () => { stopLoop(); players.forEach((p) => p.pause()); };
    controlsRef.current = { play, pause };

    const onGesture = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      if (!mutedRef.current && !started) play();
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    if (!savedMuted) play();

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      pause();
      controlsRef.current = { play: () => {}, pause: () => {} };
    };
  }, [src]);

  const toggle = () => {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
    if (next) controlsRef.current.pause();
    else controlsRef.current.play();
  };

  return (
    <div className="fixed bottom-4 right-4 z-20 flex items-center gap-3">
      {credit && <p className="hidden text-[0.65rem] text-slate-500 sm:block">{credit}</p>}
      <button
        type="button"
        onClick={toggle}
        aria-label={muted ? 'Unmute music' : 'Mute music'}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-300 backdrop-blur-md transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
}
