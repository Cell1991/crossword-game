'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const DEFAULT_VOLUME = 0.5;
const INTRO_FADE_MS = 2500;
const CROSSFADE_S = 6;
const MUTE_KEY = 'wordx.music.muted';
const VOLUME_KEY = 'wordx.music.volume';
const TIME_KEY = 'wordx.music.time';

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
  const volumeRef = useRef(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    let savedMuted = false;
    try { savedMuted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }
    let savedVolume = DEFAULT_VOLUME;
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      const parsed = raw === null ? NaN : Number(raw);
      if (Number.isFinite(parsed)) savedVolume = Math.min(1, Math.max(0, parsed));
    } catch { /* storage unavailable */ }
    mutedRef.current = savedMuted;
    volumeRef.current = savedVolume;
    queueMicrotask(() => { setMuted(savedMuted); setVolume(savedVolume); });

    const players = [new Audio(src), new Audio(src)];
    players.forEach((p) => { p.preload = 'auto'; p.volume = 0; });
    // Pages remount the player on navigation; resume where the last page left off.
    try {
      const saved = Number(sessionStorage.getItem(TIME_KEY));
      if (Number.isFinite(saved) && saved > 0) players[0].currentTime = saved;
    } catch { /* storage unavailable */ }
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
      const cur = players[active];
      cur.play().then(() => {
        started = true;
        introStart = performance.now();
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
      if (started) {
        try { sessionStorage.setItem(TIME_KEY, String(players[active].currentTime)); } catch { /* storage unavailable */ }
      }
      pause();
      controlsRef.current = { play: () => {}, pause: () => {} };
    };
  }, [src]);

  const changeVolume = (value: number) => {
    volumeRef.current = value;
    setVolume(value);
    try { localStorage.setItem(VOLUME_KEY, String(value)); } catch { /* storage unavailable */ }
    // Dragging up from zero counts as unmuting; dragging to zero mutes.
    const shouldMute = value === 0;
    if (shouldMute !== mutedRef.current) {
      mutedRef.current = shouldMute;
      setMuted(shouldMute);
      try { localStorage.setItem(MUTE_KEY, shouldMute ? '1' : '0'); } catch { /* storage unavailable */ }
      if (shouldMute) controlsRef.current.pause();
      else controlsRef.current.play();
    }
  };

  const toggle = () => {
    const next = !muted;
    if (!next && volumeRef.current === 0) changeVolume(DEFAULT_VOLUME);
    mutedRef.current = next;
    setMuted(next);
    try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
    if (next) controlsRef.current.pause();
    else controlsRef.current.play();
  };

  return (
    <div className="fixed bottom-4 right-4 z-20 flex items-end gap-3">
      {credit && <p className="hidden text-[0.65rem] text-slate-500 sm:block">{credit}</p>}
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
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-300 backdrop-blur-md transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
}
