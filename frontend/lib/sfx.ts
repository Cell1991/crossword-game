const MUTE_KEY = 'wordx.music.muted';
const SFX_VOLUME = 0.6;

const SOUNDS = {
  select: '/audio/sfx-select.mp3',
  place: '/audio/sfx-place.mp3',
} as const;

export type SfxName = keyof typeof SOUNDS;

const cache: Partial<Record<SfxName, HTMLAudioElement>> = {};

/** Plays a short UI sound; silent while the music mute is on. Overlapping plays restart the clip. */
export function playSfx(name: SfxName) {
  if (typeof window === 'undefined') return;
  try { if (localStorage.getItem(MUTE_KEY) === '1') return; } catch { /* storage unavailable */ }
  const audio = (cache[name] ??= new Audio(SOUNDS[name]));
  audio.volume = SFX_VOLUME;
  audio.currentTime = 0;
  void audio.play().catch(() => { /* blocked until a gesture */ });
}
