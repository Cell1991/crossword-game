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
   * Ultra-warm, velvety soft piano / marimba chime for 7 rack tile positions (Middle C Octave):
   * Slot 0: โด (Do - C4 / 261.63 Hz)
   * Slot 1: เร (Re - D4 / 293.66 Hz)
   * Slot 2: มี (Mi - E4 / 329.63 Hz)
   * Slot 3: ฟา (Fa - F4 / 349.23 Hz)
   * Slot 4: ซอล (Sol - G4 / 392.00 Hz)
   * Slot 5: ลา (La - A4 / 440.00 Hz)
   * Slot 6: ที (Ti - B4 / 493.88 Hz)
   */
  playPianoNote(slotIndex: number) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Middle C Octave (Deep, warm, soothing register - zero high-pitch sharpness)
    const PIANO_NOTES = [
      261.63, // 0: โด (Do - C4)
      293.66, // 1: เร (Re - D4)
      329.63, // 2: มี (Mi - E4)
      349.23, // 3: ฟา (Fa - F4)
      392.00, // 4: ซอล (Sol - G4)
      440.00, // 5: ลา (La - A4)
      493.88, // 6: ที (Ti - B4)
    ];

    const noteIdx = Math.max(0, Math.min(PIANO_NOTES.length - 1, slotIndex));
    const fundamental = PIANO_NOTES[noteIdx];

    // Master gain: soft, cozy, non-intrusive volume
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.12, now);
    masterGain.connect(ctx.destination);

    // Warm Lowpass Filter: completely removes any harsh high-frequencies
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(fundamental * 2.2, now);
    filter.frequency.exponentialRampToValueAtTime(fundamental * 1.05, now + 0.5);
    filter.Q.setValueAtTime(0.65, now);
    filter.connect(masterGain);

    // Pure, gentle sine harmonics (velvet Rhodes / soft acoustic upright piano feel)
    const harmonics = [
      { mult: 0.5, gain: 0.16, decay: 0.45 }, // Deep body warmth
      { mult: 1.0, gain: 0.78, decay: 0.55 }, // Fundamental note
      { mult: 2.0, gain: 0.12, decay: 0.32 }, // Soft 1st overtone
    ];

    harmonics.forEach(({ mult, gain: harmonicGain, decay }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * mult, now);

      // 10ms smooth rounded attack to eliminate any initial click/bite
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(harmonicGain, now + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(gainNode);
      gainNode.connect(filter);

      osc.start(now);
      osc.stop(now + decay + 0.05);
    });
  }

  /** Punchy damage hit audio (normal hit vs 2x critical heavy impact) */
  playDamageHit(isCritical = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (isCritical) {
      // 2X Critical Damage: Heavy sub-bass thud + thunder crackle
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);

      // High electric crackle burst
      const crackleOsc = ctx.createOscillator();
      const crackleGain = ctx.createGain();
      crackleOsc.type = 'triangle';
      crackleOsc.frequency.setValueAtTime(880, now);
      crackleOsc.frequency.linearRampToValueAtTime(1400, now + 0.08);
      crackleOsc.frequency.exponentialRampToValueAtTime(220, now + 0.25);

      crackleGain.gain.setValueAtTime(0.18, now);
      crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      crackleOsc.connect(crackleGain);
      crackleGain.connect(ctx.destination);
      crackleOsc.start(now);
      crackleOsc.stop(now + 0.3);
    } else {
      // Normal Damage: Crisp impact thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }

  /** Dramatic slow-motion Final Blow / Knockout gong & fanfare */
  playFinalKnockout() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep sub-bass resonance (gong / slow motion shockwave)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 1.2);
    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 1.5);

    // Triumphant rising chords (C4, E4, G4, C5, E5)
    const chords = [261.63, 329.63, 392.00, 523.25, 659.25];
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.1 + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + 0.1 + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.1 + idx * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1 + idx * 0.08 + 1.0);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.1 + idx * 0.08);
      osc.stop(now + 0.1 + idx * 0.08 + 1.1);
    });
  }
}

export const soundFx = new SoundSynthesizer();
