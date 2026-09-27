import type { CSSProperties } from 'react';

const face = {
  top: '#ffc85c',
  middle: '#ff951f',
  bottom: '#df5f0a',
  shadow: 'rgba(71, 31, 5, 0.58)',
};

export const TILE_THEME = {
  face,
  faceGradient: `linear-gradient(to bottom, ${face.top}, ${face.middle}, ${face.bottom})`,
  remoteFace: {
    top: '#3d5e88',
    middle: '#2f4e77',
    bottom: '#1c3452',
    shadow: 'rgba(8, 47, 73, 0.58)',
  },
  mobile: {
    letter: {
      color: '#0752a4',
      stroke: '#073b82',
      shadow: 'rgba(71, 31, 5, 0.48)',
      textShadow: '0 1px 0 rgba(255, 255, 255, 0.48), 0 2px 0 rgba(132, 50, 7, 0.5), 0 3px 4px rgba(71, 31, 5, 0.38)',
      weight: 800,
    },
    score: {
      color: '#073b82',
      stroke: '#073b82',
      glow: 'rgba(0, 0, 0, 0)',
      textShadow: 'none',
      weight: 900,
    },
    blank: {
      color: '#0752a4',
      stroke: '#073b82',
      glow: 'rgba(255, 248, 220, 0.95)',
    },
  },
  desktop: {
    letter: {
      color: '#174f91',
      stroke: '#000000',
      shadow: 'rgba(0, 0, 0, 0.36)',
      textShadow: '0 1px 0 rgba(255, 220, 163, 0.82), 0 2px 0 rgba(0, 0, 0, 0.88), 0 0 4px rgba(0, 0, 0, 0.36)',
      weight: 900,
    },
    score: {
      color: '#061a35',
      stroke: '#04142a',
      glow: 'rgba(0, 109, 220, 0.5)',
      textShadow: '0 0 2px rgba(89, 190, 255, 0.68), 0 0 5px rgba(0, 109, 220, 0.5)',
      weight: 900,
    },
    blank: {
      color: '#174f91',
      stroke: '#000000',
      glow: 'rgba(0, 0, 0, 0.36)',
    },
  },
} as const;

export interface TilePalette {
  letter: { color: string; stroke: string; shadow: string; textShadow: string; weight: number };
  score: { color: string; stroke: string; glow: string; textShadow: string; weight: number };
  blank: { color: string; stroke: string; glow: string };
}

type TileThemeStyle = CSSProperties & {
  [key: `--tile-${string}`]: string;
};

export const TILE_THEME_STYLE: TileThemeStyle = {
  '--tile-face-gradient': TILE_THEME.faceGradient,
  '--tile-letter-color-mobile': TILE_THEME.mobile.letter.color,
  '--tile-letter-stroke-mobile': TILE_THEME.mobile.letter.stroke,
  '--tile-letter-shadow-mobile': TILE_THEME.mobile.letter.textShadow,
  '--tile-score-color-mobile': TILE_THEME.mobile.score.color,
  '--tile-score-stroke-mobile': TILE_THEME.mobile.score.stroke,
  '--tile-score-shadow-mobile': TILE_THEME.mobile.score.textShadow,
  '--tile-blank-color-mobile': TILE_THEME.mobile.blank.color,
  '--tile-blank-stroke-mobile': TILE_THEME.mobile.blank.stroke,
  '--tile-blank-glow-mobile': TILE_THEME.mobile.blank.glow,
  '--tile-letter-color-desktop': TILE_THEME.desktop.letter.color,
  '--tile-letter-stroke-desktop': TILE_THEME.desktop.letter.stroke,
  '--tile-letter-shadow-desktop': TILE_THEME.desktop.letter.textShadow,
  '--tile-score-color-desktop': TILE_THEME.desktop.score.color,
  '--tile-score-stroke-desktop': TILE_THEME.desktop.score.stroke,
  '--tile-score-shadow-desktop': TILE_THEME.desktop.score.textShadow,
  '--tile-blank-color-desktop': TILE_THEME.desktop.blank.color,
  '--tile-blank-stroke-desktop': TILE_THEME.desktop.blank.stroke,
  '--tile-blank-glow-desktop': TILE_THEME.desktop.blank.glow,
};