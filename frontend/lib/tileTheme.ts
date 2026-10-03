import type { CSSProperties } from 'react';

const face = {
  top: '#ffea79',
  middle: '#f59e0b',
  bottom: '#8c3503',
  shadow: 'rgba(45, 15, 2, 0.65)',
};

export const TILE_THEME = {
  face,
  faceGradient: 'linear-gradient(180deg, #ffea79 0%, #fbbf24 22%, #f59e0b 60%, #b45309 85%, #8c3503 100%)',
  remoteFace: {
    top: '#3d5e88',
    middle: '#2f4e77',
    bottom: '#1c3452',
    shadow: 'rgba(8, 47, 73, 0.58)',
  },
  mobile: {
    letter: {
      color: '#ffffff',
      stroke: '#3b1400',
      shadow: 'rgba(35, 10, 0, 0.75)',
      textShadow: '0 1px 0 #3b1400, 0 2px 1px rgba(35, 10, 0, 0.8), 0 3px 5px rgba(0, 0, 0, 0.55)',
      weight: 900,
    },
    score: {
      color: '#ffffff',
      stroke: '#3b1400',
      glow: 'rgba(255, 230, 150, 0.5)',
      textShadow: '0 1px 0 #3b1400, 0 1.5px 1px rgba(35, 10, 0, 0.8), 0 2px 3px rgba(0, 0, 0, 0.6)',
      weight: 900,
    },
    blank: {
      color: '#ffffff',
      stroke: '#3b1400',
      glow: 'rgba(255, 235, 160, 0.6)',
    },
  },
  desktop: {
    letter: {
      color: '#ffffff',
      stroke: '#3b1400',
      shadow: 'rgba(35, 10, 0, 0.75)',
      textShadow: '0 1px 0 #3b1400, 0 2px 1px rgba(35, 10, 0, 0.8), 0 3px 5px rgba(0, 0, 0, 0.55)',
      weight: 900,
    },
    score: {
      color: '#ffffff',
      stroke: '#3b1400',
      glow: 'rgba(255, 230, 150, 0.5)',
      textShadow: '0 1px 0 #3b1400, 0 1.5px 1px rgba(35, 10, 0, 0.8), 0 2px 3px rgba(0, 0, 0, 0.6)',
      weight: 900,
    },
    blank: {
      color: '#ffffff',
      stroke: '#3b1400',
      glow: 'rgba(255, 235, 160, 0.6)',
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
