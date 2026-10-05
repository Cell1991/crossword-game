// Web Audio synthesizer for crisp, low-latency, zero-asset game sound effects

class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Lightning charge & card draw energy whoosh */
  playCardCharge() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Frequency sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.35);
    
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /** Grand holographic card reveal fanfare chime */
  playCardReveal() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Polyphonic triumphant triad
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.05 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.75);
    });
  }

  /** Elemental card activation sound FX */
  playCardActivate(card: string) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    switch (card) {
      case 'DOUBLE_DAMAGE': {
        // Thunder blade slash
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.4);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
      case 'SHIELD': {
        // Resonant aegis bell
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      case 'FREEZE_TILE': {
        // Glacial crystal chime
        [1046.5, 1318.5, 1567.98].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.06);
          gain.gain.setValueAtTime(0.12, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.55);
        });
        break;
      }
      case 'DESTROY_TILE': {
        // Fire whoosh / flame burst
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(320, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
      case 'HEAL': {
        // Celestial harp
        [440, 554.37, 659.25, 880].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.07);
          gain.gain.setValueAtTime(0.15, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.6);
        });
        break;
      }
      default: {
        // Magic power ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.2);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }
    }
  }

  /** Crisp celebratory score burst chime */
  playScoreBurst(score: number, isBingo = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const baseFreq = isBingo ? 587.33 : score >= 20 ? 523.25 : 440;
    const intervals = isBingo ? [1, 1.25, 1.5, 2] : [1, 1.25, 1.5];

    intervals.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq * ratio, now + idx * 0.05);

      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.05 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.5);
    });
  }

  /**
   * Warm, soft acoustic piano note for the 7 rack tile positions:
   * Slot 0: โด (Do - C5 / 523.25 Hz)
   * Slot 1: เร (Re - D5 / 587.33 Hz)
   * Slot 2: มี (Mi - E5 / 659.25 Hz)
   * Slot 3: ฟา (Fa - F5 / 698.46 Hz)
   * Slot 4: ซอล (Sol - G5 / 783.99 Hz)
   * Slot 5: ลา (La - A5 / 880.00 Hz)
   * Slot 6: ที (Ti - B5 / 987.77 Hz)
   */
  playPianoNote(slotIndex: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const PIANO_NOTES = [
      523.25, // 0: โด (Do - C5)
      587.33, // 1: เร (Re - D5)
      659.25, // 2: มี (Mi - E5)
      698.46, // 3: ฟา (Fa - F5)
      783.99, // 4: ซอล (Sol - G5)
      880.00, // 5: ลา (La - A5)
      987.77, // 6: ที (Ti - B5)
    ];

    const noteIdx = Math.max(0, Math.min(PIANO_NOTES.length - 1, slotIndex));
    const fundamental = PIANO_NOTES[noteIdx];

    // Master gain for gentle, well-balanced acoustic volume
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.16, now);
    masterGain.connect(ctx.destination);

    // Warm Lowpass Filter simulating wooden piano soundboard & felt damper
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(fundamental * 3.8, now);
    filter.frequency.exponentialRampToValueAtTime(fundamental * 1.4, now + 0.7);
    filter.Q.setValueAtTime(1.1, now);
    filter.connect(masterGain);

    // Harmonics for rich, natural, non-fatiguing piano timbre
    const harmonics = [
      { mult: 0.5, type: 'sine' as const, gain: 0.18, decay: 0.70 }, // Warm lower resonance
      { mult: 1.0, type: 'sine' as const, gain: 0.65, decay: 0.90 }, // Fundamental note
      { mult: 2.0, type: 'triangle' as const, gain: 0.22, decay: 0.45 }, // 1st Octave harmonic
      { mult: 3.0, type: 'sine' as const, gain: 0.08, decay: 0.30 }, // 12th harmonic
    ];

    harmonics.forEach(({ mult, type, gain: harmonicGain, decay }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(fundamental * mult, now);

      // Fast, gentle attack (4ms) to avoid clicks, followed by smooth exponential decay
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(harmonicGain, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(gainNode);
      gainNode.connect(filter);

      osc.start(now);
      osc.stop(now + decay + 0.05);
    });

    // Soft felt hammer attack thud (subtle acoustic realism)
    const hammerOsc = ctx.createOscillator();
    const hammerGain = ctx.createGain();
    hammerOsc.type = 'sine';
    hammerOsc.frequency.setValueAtTime(fundamental * 0.4, now);
    hammerOsc.frequency.exponentialRampToValueAtTime(50, now + 0.02);

    hammerGain.gain.setValueAtTime(0.035, now);
    hammerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    hammerOsc.connect(hammerGain);
    hammerGain.connect(masterGain);

    hammerOsc.start(now);
    hammerOsc.stop(now + 0.03);
  }
}

export const soundFx = new SoundSynthesizer();
