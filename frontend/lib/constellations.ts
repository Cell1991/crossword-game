/**
 * Authentic Star Chart Constellations for every letter A-Z.
 * Matched to classic astronomical / zodiac star maps with:
 * - Real constellation geometric layouts
 * - Major starburst nodes (8-pointed celestial stars)
 * - Standard star nodes (round points)
 * - Hairline constellation connecting filaments
 * - Scattered background stardust specks
 */

export interface StarNode {
  x: number; // 0.0 to 1.0 normalized
  y: number; // 0.0 to 1.0 normalized
  isStarburst?: boolean; // 8-pointed celestial starburst
  size?: number; // scale multiplier
}

export interface StardustSpeck {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

export interface ConstellationData {
  name: string;
  stars: StarNode[];
  lines: [number, number][]; // index pairs
  dust: StardustSpeck[];
}

// Generate deterministic stardust specks for each letter
function generateStardust(seedNum: number): StardustSpeck[] {
  const count = 9 + (seedNum % 6);
  const specks: StardustSpeck[] = [];
  for (let i = 0; i < count; i++) {
    const s1 = (seedNum * 23 + i * 47 + 11) % 1000;
    const s2 = (seedNum * 37 + i * 59 + 29) % 1000;
    const s3 = (seedNum * 13 + i * 19) % 100;
    specks.push({
      x: 0.08 + (s1 / 1000) * 0.84,
      y: 0.08 + (s2 / 1000) * 0.84,
      r: s3 > 70 ? 0.9 : s3 > 35 ? 0.65 : 0.45,
      opacity: 0.25 + (s3 / 100) * 0.45,
    });
  }
  return specks;
}

// 26 Authentic Astronomical & Zodiac Constellations
const ASTRONOMICAL_CONSTELLATIONS: Record<string, Omit<ConstellationData, 'dust'>> = {
  A: {
    // Aries (The Ram)
    name: 'Aries',
    stars: [
      { x: 0.80, y: 0.32, isStarburst: true, size: 1.2 }, // Hamal
      { x: 0.58, y: 0.38, isStarburst: false },          // Sheratan
      { x: 0.36, y: 0.52, isStarburst: false },          // Mesarthim
      { x: 0.22, y: 0.68, isStarburst: true, size: 1.0 },
    ],
    lines: [[0, 1], [1, 2], [2, 3]],
  },
  B: {
    // Boötes (The Kite / Herdsman with Arcturus)
    name: 'Boötes',
    stars: [
      { x: 0.50, y: 0.16, isStarburst: true, size: 1.1 }, // Nekkar
      { x: 0.30, y: 0.38, isStarburst: false },          // Seginus
      { x: 0.70, y: 0.38, isStarburst: false },          // Izar
      { x: 0.50, y: 0.56, isStarburst: false },
      { x: 0.50, y: 0.84, isStarburst: true, size: 1.3 }, // Arcturus (major starburst)
    ],
    lines: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
  },
  C: {
    // Cassiopeia (The Heavenly W Crown)
    name: 'Cassiopeia',
    stars: [
      { x: 0.18, y: 0.65, isStarburst: true, size: 1.1 }, // Caph
      { x: 0.34, y: 0.34, isStarburst: true, size: 1.2 }, // Schedar
      { x: 0.50, y: 0.55, isStarburst: true, size: 1.3 }, // Navi (gamma Cas)
      { x: 0.68, y: 0.32, isStarburst: false },          // Ruchbah
      { x: 0.82, y: 0.58, isStarburst: true, size: 1.1 }, // Segin
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  D: {
    // Draco (The Celestial Dragon Trail)
    name: 'Draco',
    stars: [
      { x: 0.76, y: 0.20, isStarburst: true, size: 1.1 }, // Eltanin
      { x: 0.65, y: 0.30, isStarburst: false },          // Rastaban
      { x: 0.42, y: 0.26, isStarburst: false },
      { x: 0.28, y: 0.42, isStarburst: true, size: 1.0 },
      { x: 0.38, y: 0.62, isStarburst: false },
      { x: 0.62, y: 0.68, isStarburst: false },
      { x: 0.74, y: 0.82, isStarburst: true, size: 1.2 }, // Thuban
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  E: {
    // Eridanus (The River)
    name: 'Eridanus',
    stars: [
      { x: 0.75, y: 0.18, isStarburst: true, size: 1.1 },
      { x: 0.52, y: 0.26, isStarburst: false },
      { x: 0.32, y: 0.44, isStarburst: true, size: 1.0 },
      { x: 0.46, y: 0.62, isStarburst: false },
      { x: 0.28, y: 0.82, isStarburst: true, size: 1.3 }, // Achernar
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  F: {
    // Fornax (The Hearth)
    name: 'Fornax',
    stars: [
      { x: 0.30, y: 0.24, isStarburst: true, size: 1.1 },
      { x: 0.70, y: 0.38, isStarburst: true, size: 1.2 },
      { x: 0.40, y: 0.76, isStarburst: true, size: 1.0 },
    ],
    lines: [[0, 1], [1, 2]],
  },
  G: {
    // Gemini (The Twins - Castor & Pollux)
    name: 'Gemini',
    stars: [
      { x: 0.32, y: 0.20, isStarburst: true, size: 1.3 }, // Castor
      { x: 0.68, y: 0.20, isStarburst: true, size: 1.3 }, // Pollux
      { x: 0.34, y: 0.48, isStarburst: false },
      { x: 0.66, y: 0.48, isStarburst: false },
      { x: 0.24, y: 0.80, isStarburst: true, size: 1.0 }, // Alhena
      { x: 0.76, y: 0.78, isStarburst: true, size: 1.0 },
    ],
    lines: [[0, 2], [2, 4], [1, 3], [3, 5], [0, 1], [2, 3]],
  },
  H: {
    // Hercules (The Keystone Hero)
    name: 'Hercules',
    stars: [
      { x: 0.36, y: 0.28, isStarburst: false },
      { x: 0.64, y: 0.24, isStarburst: false },
      { x: 0.68, y: 0.58, isStarburst: true, size: 1.1 },
      { x: 0.32, y: 0.62, isStarburst: true, size: 1.1 },
      { x: 0.50, y: 0.82, isStarburst: true, size: 1.3 }, // Rasalgethi
      { x: 0.20, y: 0.20, isStarburst: false },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [0, 5]],
  },
  I: {
    // Indus (The Stellar Arrow)
    name: 'Indus',
    stars: [
      { x: 0.50, y: 0.16, isStarburst: true, size: 1.3 }, // The Arrowhead
      { x: 0.50, y: 0.44, isStarburst: false },
      { x: 0.50, y: 0.72, isStarburst: false },
      { x: 0.30, y: 0.84, isStarburst: true, size: 1.0 },
      { x: 0.70, y: 0.84, isStarburst: true, size: 1.0 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [2, 4]],
  },
  J: {
    // Scorpius (The Scorpion Tail & Antares)
    name: 'Scorpius',
    stars: [
      { x: 0.76, y: 0.18, isStarburst: true, size: 1.0 }, // Graffias
      { x: 0.68, y: 0.32, isStarburst: true, size: 1.4 }, // Antares (Heart)
      { x: 0.52, y: 0.48, isStarburst: false },
      { x: 0.38, y: 0.66, isStarburst: false },
      { x: 0.24, y: 0.78, isStarburst: true, size: 1.1 }, // Shaula (Stinger)
      { x: 0.36, y: 0.86, isStarburst: false },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  K: {
    // Corona Borealis (The Northern Crown Arc)
    name: 'Corona Borealis',
    stars: [
      { x: 0.78, y: 0.32, isStarburst: false },
      { x: 0.64, y: 0.22, isStarburst: false },
      { x: 0.50, y: 0.18, isStarburst: true, size: 1.4 }, // Alphecca (Gem)
      { x: 0.36, y: 0.22, isStarburst: false },
      { x: 0.22, y: 0.34, isStarburst: false },
      { x: 0.32, y: 0.65, isStarburst: true, size: 1.0 },
      { x: 0.68, y: 0.65, isStarburst: true, size: 1.0 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
  },
  L: {
    // Leo (The Lion Sickle & Regulus)
    name: 'Leo',
    stars: [
      { x: 0.68, y: 0.18, isStarburst: true, size: 1.1 }, // Algieba
      { x: 0.52, y: 0.24, isStarburst: false },
      { x: 0.42, y: 0.38, isStarburst: false },
      { x: 0.50, y: 0.52, isStarburst: true, size: 1.4 }, // Regulus (King Star)
      { x: 0.74, y: 0.54, isStarburst: false },          // Chertan
      { x: 0.82, y: 0.74, isStarburst: true, size: 1.2 }, // Denebola
      { x: 0.44, y: 0.78, isStarburst: false },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  M: {
    // Ursa Major (The Great Bear / Big Dipper)
    name: 'Ursa Major',
    stars: [
      { x: 0.80, y: 0.20, isStarburst: true, size: 1.2 }, // Alkaid
      { x: 0.66, y: 0.32, isStarburst: true, size: 1.1 }, // Mizar
      { x: 0.54, y: 0.42, isStarburst: false },          // Alioth
      { x: 0.42, y: 0.48, isStarburst: false },          // Megrez
      { x: 0.44, y: 0.76, isStarburst: true, size: 1.2 }, // Phecda
      { x: 0.22, y: 0.74, isStarburst: true, size: 1.3 }, // Merak
      { x: 0.20, y: 0.46, isStarburst: true, size: 1.3 }, // Dubhe
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  N: {
    // Cygnus (The Northern Cross Swan)
    name: 'Cygnus',
    stars: [
      { x: 0.50, y: 0.16, isStarburst: true, size: 1.4 }, // Deneb
      { x: 0.50, y: 0.48, isStarburst: true, size: 1.2 }, // Sadr
      { x: 0.50, y: 0.82, isStarburst: true, size: 1.1 }, // Albireo
      { x: 0.20, y: 0.44, isStarburst: true, size: 1.1 }, // Gienah
      { x: 0.80, y: 0.44, isStarburst: true, size: 1.1 }, // Delta Cygni
    ],
    lines: [[0, 1], [1, 2], [3, 1], [1, 4]],
  },
  O: {
    // Orion (The Hunter & Celestial Belt)
    name: 'Orion',
    stars: [
      { x: 0.30, y: 0.20, isStarburst: true, size: 1.3 }, // Betelgeuse (Red supergiant)
      { x: 0.72, y: 0.22, isStarburst: true, size: 1.2 }, // Bellatrix
      { x: 0.42, y: 0.50, isStarburst: true, size: 1.1 }, // Alnitak
      { x: 0.50, y: 0.49, isStarburst: true, size: 1.1 }, // Alnilam
      { x: 0.58, y: 0.48, isStarburst: true, size: 1.1 }, // Mintaka
      { x: 0.32, y: 0.80, isStarburst: false },          // Saiph
      { x: 0.74, y: 0.78, isStarburst: true, size: 1.4 }, // Rigel
    ],
    lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 1], [5, 6]],
  },
  P: {
    // Pegasus (The Great Celestial Square)
    name: 'Pegasus',
    stars: [
      { x: 0.26, y: 0.24, isStarburst: true, size: 1.2 }, // Scheat
      { x: 0.74, y: 0.24, isStarburst: true, size: 1.2 }, // Alpheratz
      { x: 0.74, y: 0.68, isStarburst: true, size: 1.2 }, // Algenib
      { x: 0.26, y: 0.68, isStarburst: true, size: 1.2 }, // Markab
      { x: 0.16, y: 0.84, isStarburst: true, size: 1.0 }, // Enif
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]],
  },
  Q: {
    // Crux (The Southern Cross)
    name: 'Crux',
    stars: [
      { x: 0.50, y: 0.16, isStarburst: true, size: 1.3 }, // Gacrux
      { x: 0.50, y: 0.82, isStarburst: true, size: 1.4 }, // Acrux
      { x: 0.24, y: 0.50, isStarburst: true, size: 1.2 }, // Mimosa
      { x: 0.76, y: 0.46, isStarburst: true, size: 1.2 }, // Delta Crucis
      { x: 0.64, y: 0.62, isStarburst: false, size: 0.8 }, // Epsilon Crucis
    ],
    lines: [[0, 1], [2, 3]],
  },
  R: {
    // Corona Australis / Sagittarius Bow
    name: 'Corona Australis',
    stars: [
      { x: 0.24, y: 0.78, isStarburst: true, size: 1.2 },
      { x: 0.24, y: 0.24, isStarburst: true, size: 1.2 },
      { x: 0.74, y: 0.24, isStarburst: true, size: 1.1 },
      { x: 0.76, y: 0.52, isStarburst: false },
      { x: 0.42, y: 0.52, isStarburst: false },
      { x: 0.78, y: 0.82, isStarburst: true, size: 1.3 },
    ],
    lines: [[0, 4], [4, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  S: {
    // Serpens (The Serpent Ribbon)
    name: 'Serpens',
    stars: [
      { x: 0.74, y: 0.20, isStarburst: true, size: 1.2 }, // Unukalhai
      { x: 0.48, y: 0.22, isStarburst: false },
      { x: 0.26, y: 0.38, isStarburst: true, size: 1.1 },
      { x: 0.50, y: 0.52, isStarburst: true, size: 1.3 },
      { x: 0.74, y: 0.66, isStarburst: true, size: 1.1 },
      { x: 0.52, y: 0.82, isStarburst: false },
      { x: 0.24, y: 0.76, isStarburst: true, size: 1.2 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  T: {
    // Taurus (The Bull & Hyades V-Shape)
    name: 'Taurus',
    stars: [
      { x: 0.22, y: 0.18, isStarburst: true, size: 1.2 }, // Elnath (Horn)
      { x: 0.78, y: 0.18, isStarburst: true, size: 1.2 }, // Tianguan (Horn)
      { x: 0.36, y: 0.50, isStarburst: false },
      { x: 0.64, y: 0.50, isStarburst: true, size: 1.5 }, // Aldebaran (Eye)
      { x: 0.50, y: 0.78, isStarburst: true, size: 1.1 }, // Ain
    ],
    lines: [[0, 2], [1, 3], [2, 4], [3, 4], [2, 3]],
  },
  U: {
    // Ursa Minor (Little Dipper with Polaris)
    name: 'Ursa Minor',
    stars: [
      { x: 0.20, y: 0.18, isStarburst: true, size: 1.5 }, // Polaris (North Star)
      { x: 0.38, y: 0.34, isStarburst: false },          // Yildun
      { x: 0.50, y: 0.48, isStarburst: false },
      { x: 0.62, y: 0.52, isStarburst: false },
      { x: 0.80, y: 0.52, isStarburst: true, size: 1.1 }, // Pherkad
      { x: 0.78, y: 0.80, isStarburst: true, size: 1.2 }, // Kochab
      { x: 0.60, y: 0.76, isStarburst: false },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  V: {
    // Virgo (The Maiden Diamond with Spica)
    name: 'Virgo',
    stars: [
      { x: 0.50, y: 0.16, isStarburst: true, size: 1.1 }, // Zavijava
      { x: 0.30, y: 0.40, isStarburst: false },          // Porrima
      { x: 0.70, y: 0.38, isStarburst: false },          // Vindemiatrix
      { x: 0.50, y: 0.58, isStarburst: false },          // Auva
      { x: 0.50, y: 0.84, isStarburst: true, size: 1.5 }, // Spica (brightest diamond)
    ],
    lines: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
  },
  W: {
    // Phoenix / Aquila Wingspan
    name: 'Aquila',
    stars: [
      { x: 0.18, y: 0.32, isStarburst: true, size: 1.2 }, // Tarazed
      { x: 0.50, y: 0.20, isStarburst: true, size: 1.5 }, // Altair
      { x: 0.82, y: 0.32, isStarburst: true, size: 1.2 }, // Alshain
      { x: 0.34, y: 0.76, isStarburst: true, size: 1.1 },
      { x: 0.66, y: 0.76, isStarburst: true, size: 1.1 },
    ],
    lines: [[0, 1], [1, 2], [0, 3], [1, 3], [1, 4], [2, 4]],
  },
  X: {
    // Triangulum / Nexus Cross
    name: 'Centaurus Cross',
    stars: [
      { x: 0.22, y: 0.22, isStarburst: true, size: 1.3 },
      { x: 0.78, y: 0.22, isStarburst: true, size: 1.3 },
      { x: 0.50, y: 0.50, isStarburst: true, size: 1.5 }, // Center Nexus
      { x: 0.22, y: 0.78, isStarburst: true, size: 1.3 },
      { x: 0.78, y: 0.78, isStarburst: true, size: 1.3 },
    ],
    lines: [[0, 2], [1, 2], [2, 3], [2, 4]],
  },
  Y: {
    // Pisces (The Connected Fish Ribbons)
    name: 'Pisces',
    stars: [
      { x: 0.22, y: 0.20, isStarburst: true, size: 1.2 }, // Western Fish
      { x: 0.36, y: 0.44, isStarburst: false },
      { x: 0.50, y: 0.76, isStarburst: true, size: 1.4 }, // Alrescha (Knot)
      { x: 0.64, y: 0.44, isStarburst: false },
      { x: 0.78, y: 0.20, isStarburst: true, size: 1.2 }, // Northern Fish
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  Z: {
    // Capricornus (The Sea Goat Triangle)
    name: 'Capricornus',
    stars: [
      { x: 0.24, y: 0.22, isStarburst: true, size: 1.3 }, // Algedi
      { x: 0.76, y: 0.26, isStarburst: true, size: 1.3 }, // Deneb Algedi
      { x: 0.64, y: 0.76, isStarburst: true, size: 1.1 },
      { x: 0.36, y: 0.72, isStarburst: false },
      { x: 0.50, y: 0.44, isStarburst: false },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [1, 4]],
  },
  BLANK: {
    // Cosmic Supernova Pulsar Wildcard
    name: 'Cosmic Supernova',
    stars: [
      { x: 0.50, y: 0.50, isStarburst: true, size: 1.8 },
      { x: 0.20, y: 0.20, isStarburst: true, size: 1.1 },
      { x: 0.80, y: 0.20, isStarburst: true, size: 1.1 },
      { x: 0.20, y: 0.80, isStarburst: true, size: 1.1 },
      { x: 0.80, y: 0.80, isStarburst: true, size: 1.1 },
    ],
    lines: [[0, 1], [0, 2], [0, 3], [0, 4]],
  },
};

export function getConstellationData(letter: string): ConstellationData {
  const upper = (letter || 'A').toUpperCase();
  if (upper === 'BLANK' || upper === '?' || upper === 'WILDCARD') {
    return {
      ...ASTRONOMICAL_CONSTELLATIONS['BLANK'],
      dust: generateStardust(777),
    };
  }
  const base = ASTRONOMICAL_CONSTELLATIONS[upper] || ASTRONOMICAL_CONSTELLATIONS['A'];
  const code = upper.charCodeAt(0) || 65;
  const dust = generateStardust(code);
  return {
    ...base,
    dust,
  };
}
