/**
 * Unique constellation patterns for every letter A-Z.
 * Each letter has its own celestial star cluster with normalized coordinates (0.0 to 1.0)
 * and faint connecting constellation lines.
 */

export interface StarPoint {
  x: number; // 0.0 to 1.0 (relative to tile width)
  y: number; // 0.0 to 1.0 (relative to tile height)
  size: number; // 1 to 2.5
  isMajor?: boolean; // Major star with sparkle diamond flare
}

export interface Constellation {
  stars: StarPoint[];
  lines: [number, number][]; // pairs of star indices
}

// Deterministic constellation generator fallback for any custom symbol
function generateDeterministicConstellation(char: string): Constellation {
  const code = char.charCodeAt(0) || 65;
  const count = 4 + (code % 3); // 4 to 6 stars
  const stars: StarPoint[] = [];
  const lines: [number, number][] = [];

  for (let i = 0; i < count; i++) {
    const seed = (code * 17 + i * 37) % 1000;
    const seed2 = (code * 31 + i * 53 + 19) % 1000;
    const x = 0.18 + (seed / 1000) * 0.64;
    const y = 0.18 + (seed2 / 1000) * 0.64;
    const isMajor = i === 0 || (count > 4 && i === 2);
    stars.push({
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      size: isMajor ? 2.2 : 1.2,
      isMajor,
    });
  }

  // Connect sequential and nearest
  for (let i = 0; i < stars.length - 1; i++) {
    lines.push([i, i + 1]);
  }
  if (stars.length >= 5) {
    lines.push([0, 2]);
  }

  return { stars, lines };
}

// Hand-crafted unique celestial constellation map for A-Z
const CONSTELLATIONS: Record<string, Constellation> = {
  A: {
    // Triangle apex constellation (like Aquila / Cassiopeia)
    stars: [
      { x: 0.50, y: 0.18, size: 2.5, isMajor: true },
      { x: 0.22, y: 0.78, size: 1.8, isMajor: true },
      { x: 0.78, y: 0.78, size: 1.8, isMajor: true },
      { x: 0.35, y: 0.52, size: 1.2 },
      { x: 0.65, y: 0.52, size: 1.2 },
    ],
    lines: [[0, 3], [3, 1], [0, 4], [4, 2], [3, 4]],
  },
  B: {
    // Dual loop constellation (like Scorpius crown)
    stars: [
      { x: 0.24, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.24, y: 0.50, size: 1.4 },
      { x: 0.24, y: 0.80, size: 2.2, isMajor: true },
      { x: 0.72, y: 0.32, size: 1.5, isMajor: true },
      { x: 0.74, y: 0.68, size: 1.5 },
    ],
    lines: [[0, 1], [1, 2], [0, 3], [3, 1], [1, 4], [4, 2]],
  },
  C: {
    // Crescent Arc constellation (like Corona Borealis)
    stars: [
      { x: 0.76, y: 0.24, size: 1.8, isMajor: true },
      { x: 0.46, y: 0.18, size: 1.4 },
      { x: 0.22, y: 0.50, size: 2.4, isMajor: true },
      { x: 0.46, y: 0.82, size: 1.4 },
      { x: 0.76, y: 0.76, size: 1.8, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  D: {
    // Cosmic Bow constellation (like Sagittarius bow)
    stars: [
      { x: 0.26, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.26, y: 0.80, size: 2.2, isMajor: true },
      { x: 0.76, y: 0.50, size: 2.5, isMajor: true },
      { x: 0.58, y: 0.28, size: 1.2 },
      { x: 0.58, y: 0.72, size: 1.2 },
    ],
    lines: [[0, 1], [0, 3], [3, 2], [2, 4], [4, 1]],
  },
  E: {
    // Trident / Ladder constellation (like Orion belt & spine)
    stars: [
      { x: 0.24, y: 0.20, size: 2.0, isMajor: true },
      { x: 0.24, y: 0.50, size: 1.6 },
      { x: 0.24, y: 0.80, size: 2.0, isMajor: true },
      { x: 0.74, y: 0.20, size: 1.8, isMajor: true },
      { x: 0.62, y: 0.50, size: 1.4 },
      { x: 0.74, y: 0.80, size: 1.8, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [0, 3], [1, 4], [2, 5]],
  },
  F: {
    // Starlight Staff constellation
    stars: [
      { x: 0.25, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.25, y: 0.52, size: 1.5 },
      { x: 0.25, y: 0.80, size: 1.8, isMajor: true },
      { x: 0.75, y: 0.20, size: 2.0, isMajor: true },
      { x: 0.60, y: 0.52, size: 1.4 },
    ],
    lines: [[0, 1], [1, 2], [0, 3], [1, 4]],
  },
  G: {
    // Spiral Galaxy constellation (like Andromeda)
    stars: [
      { x: 0.74, y: 0.24, size: 1.6, isMajor: true },
      { x: 0.38, y: 0.18, size: 1.4 },
      { x: 0.22, y: 0.50, size: 2.4, isMajor: true },
      { x: 0.38, y: 0.82, size: 1.4 },
      { x: 0.74, y: 0.80, size: 2.0, isMajor: true },
      { x: 0.74, y: 0.52, size: 1.5 },
      { x: 0.52, y: 0.52, size: 1.2 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  H: {
    // Twin Pillars / Gemini constellation
    stars: [
      { x: 0.24, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.24, y: 0.80, size: 2.2, isMajor: true },
      { x: 0.76, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.76, y: 0.80, size: 2.2, isMajor: true },
      { x: 0.24, y: 0.50, size: 1.3 },
      { x: 0.76, y: 0.50, size: 1.3 },
    ],
    lines: [[0, 4], [4, 1], [2, 5], [5, 3], [4, 5]],
  },
  I: {
    // North Star Scepter constellation (Polaris axis)
    stars: [
      { x: 0.50, y: 0.16, size: 2.6, isMajor: true },
      { x: 0.50, y: 0.38, size: 1.3 },
      { x: 0.50, y: 0.62, size: 1.3 },
      { x: 0.50, y: 0.84, size: 2.4, isMajor: true },
      { x: 0.30, y: 0.16, size: 1.2 },
      { x: 0.70, y: 0.16, size: 1.2 },
    ],
    lines: [[4, 0], [0, 5], [0, 1], [1, 2], [2, 3]],
  },
  J: {
    // Cosmic Anchor / Fishhook constellation
    stars: [
      { x: 0.70, y: 0.18, size: 2.0, isMajor: true },
      { x: 0.70, y: 0.60, size: 1.5 },
      { x: 0.58, y: 0.82, size: 2.2, isMajor: true },
      { x: 0.28, y: 0.74, size: 1.8, isMajor: true },
      { x: 0.24, y: 0.54, size: 1.2 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  K: {
    // Cygnus Cross / Arrowhead constellation
    stars: [
      { x: 0.25, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.25, y: 0.50, size: 1.6 },
      { x: 0.25, y: 0.80, size: 2.2, isMajor: true },
      { x: 0.75, y: 0.22, size: 2.0, isMajor: true },
      { x: 0.75, y: 0.78, size: 2.0, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [1, 3], [1, 4]],
  },
  L: {
    // Ursa Major dipper corner constellation
    stars: [
      { x: 0.26, y: 0.18, size: 2.4, isMajor: true },
      { x: 0.26, y: 0.50, size: 1.3 },
      { x: 0.26, y: 0.82, size: 2.4, isMajor: true },
      { x: 0.52, y: 0.82, size: 1.4 },
      { x: 0.78, y: 0.82, size: 2.0, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  M: {
    // Cassiopeia / Mountain peak constellation
    stars: [
      { x: 0.20, y: 0.80, size: 2.0, isMajor: true },
      { x: 0.24, y: 0.22, size: 2.2, isMajor: true },
      { x: 0.50, y: 0.58, size: 2.5, isMajor: true },
      { x: 0.76, y: 0.22, size: 2.2, isMajor: true },
      { x: 0.80, y: 0.80, size: 2.0, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  N: {
    // Pegasus Zigzag constellation
    stars: [
      { x: 0.24, y: 0.80, size: 2.2, isMajor: true },
      { x: 0.24, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.76, y: 0.80, size: 2.2, isMajor: true },
      { x: 0.76, y: 0.20, size: 2.2, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3]],
  },
  O: {
    // Celestial Ring / Corona constellation
    stars: [
      { x: 0.50, y: 0.18, size: 2.4, isMajor: true },
      { x: 0.78, y: 0.38, size: 1.6 },
      { x: 0.78, y: 0.68, size: 1.6 },
      { x: 0.50, y: 0.82, size: 2.4, isMajor: true },
      { x: 0.22, y: 0.68, size: 1.6 },
      { x: 0.22, y: 0.38, size: 1.6 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
  },
  P: {
    // Celestial Banner constellation
    stars: [
      { x: 0.25, y: 0.80, size: 2.0, isMajor: true },
      { x: 0.25, y: 0.50, size: 1.4 },
      { x: 0.25, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.75, y: 0.20, size: 2.0, isMajor: true },
      { x: 0.75, y: 0.50, size: 1.8, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
  },
  Q: {
    // Celestial Ring with Comet Tail
    stars: [
      { x: 0.50, y: 0.18, size: 2.2, isMajor: true },
      { x: 0.75, y: 0.45, size: 1.6 },
      { x: 0.50, y: 0.74, size: 2.2, isMajor: true },
      { x: 0.25, y: 0.45, size: 1.6 },
      { x: 0.62, y: 0.62, size: 1.4 },
      { x: 0.82, y: 0.84, size: 2.6, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5]],
  },
  R: {
    // Centaurus / Guardian constellation
    stars: [
      { x: 0.25, y: 0.80, size: 2.0, isMajor: true },
      { x: 0.25, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.72, y: 0.20, size: 1.8, isMajor: true },
      { x: 0.72, y: 0.48, size: 1.6 },
      { x: 0.25, y: 0.48, size: 1.3 },
      { x: 0.78, y: 0.82, size: 2.2, isMajor: true },
    ],
    lines: [[0, 4], [4, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  S: {
    // Draco Serpent / Nebula River constellation
    stars: [
      { x: 0.74, y: 0.24, size: 2.0, isMajor: true },
      { x: 0.46, y: 0.18, size: 1.4 },
      { x: 0.24, y: 0.36, size: 1.8, isMajor: true },
      { x: 0.50, y: 0.50, size: 2.5, isMajor: true },
      { x: 0.76, y: 0.64, size: 1.8, isMajor: true },
      { x: 0.54, y: 0.82, size: 1.4 },
      { x: 0.26, y: 0.76, size: 2.0, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  T: {
    // Southern Cross / Horizon Hammer constellation
    stars: [
      { x: 0.20, y: 0.20, size: 2.0, isMajor: true },
      { x: 0.50, y: 0.20, size: 2.6, isMajor: true },
      { x: 0.80, y: 0.20, size: 2.0, isMajor: true },
      { x: 0.50, y: 0.50, size: 1.4 },
      { x: 0.50, y: 0.82, size: 2.4, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4]],
  },
  U: {
    // Crater / Cosmic Chalice constellation
    stars: [
      { x: 0.24, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.24, y: 0.60, size: 1.5 },
      { x: 0.42, y: 0.82, size: 2.0, isMajor: true },
      { x: 0.58, y: 0.82, size: 2.0, isMajor: true },
      { x: 0.76, y: 0.60, size: 1.5 },
      { x: 0.76, y: 0.20, size: 2.2, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  V: {
    // Taurus Horns / Delta constellation
    stars: [
      { x: 0.22, y: 0.20, size: 2.4, isMajor: true },
      { x: 0.36, y: 0.50, size: 1.4 },
      { x: 0.50, y: 0.82, size: 2.6, isMajor: true },
      { x: 0.64, y: 0.50, size: 1.4 },
      { x: 0.78, y: 0.20, size: 2.4, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  W: {
    // Orion / Double Crown constellation
    stars: [
      { x: 0.18, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.32, y: 0.78, size: 2.4, isMajor: true },
      { x: 0.50, y: 0.42, size: 2.0, isMajor: true },
      { x: 0.68, y: 0.78, size: 2.4, isMajor: true },
      { x: 0.82, y: 0.20, size: 2.2, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  X: {
    // Cross Nebula / Star Nexus constellation
    stars: [
      { x: 0.22, y: 0.22, size: 2.2, isMajor: true },
      { x: 0.78, y: 0.22, size: 2.2, isMajor: true },
      { x: 0.50, y: 0.50, size: 2.8, isMajor: true },
      { x: 0.22, y: 0.78, size: 2.2, isMajor: true },
      { x: 0.78, y: 0.78, size: 2.2, isMajor: true },
    ],
    lines: [[0, 2], [1, 2], [2, 3], [2, 4]],
  },
  Y: {
    // Triangulum / Cosmic Fork constellation
    stars: [
      { x: 0.22, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.78, y: 0.20, size: 2.2, isMajor: true },
      { x: 0.50, y: 0.50, size: 2.6, isMajor: true },
      { x: 0.50, y: 0.82, size: 2.2, isMajor: true },
    ],
    lines: [[0, 2], [1, 2], [2, 3]],
  },
  Z: {
    // Lightning Comet constellation
    stars: [
      { x: 0.24, y: 0.22, size: 2.2, isMajor: true },
      { x: 0.76, y: 0.22, size: 2.2, isMajor: true },
      { x: 0.50, y: 0.50, size: 1.6 },
      { x: 0.24, y: 0.78, size: 2.2, isMajor: true },
      { x: 0.76, y: 0.78, size: 2.2, isMajor: true },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
};

export function getConstellation(letter: string): Constellation {
  const upper = (letter || 'A').toUpperCase();
  if (CONSTELLATIONS[upper]) {
    return CONSTELLATIONS[upper];
  }
  return generateDeterministicConstellation(upper);
}
