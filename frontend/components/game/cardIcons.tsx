import React from 'react';
import { Eye, Flame, Heart, LucideIcon, Repeat2, Shield, Snowflake, Swords } from 'lucide-react';

/** The 7 Core Power Cards' icon and color styling. */
const CARD_ICONS: Record<string, [LucideIcon, string]> = {
  HINT: [Eye, 'text-amber-300 drop-shadow-[0_0_8px_#fbbf24]'],
  SPY_SWAP: [Repeat2, 'text-emerald-300 drop-shadow-[0_0_8px_#34d399]'],
  DESTROY_TILE: [Flame, 'text-orange-400 fill-orange-400/20 drop-shadow-[0_0_8px_#f97316]'],
  HEAL: [Heart, 'fill-rose-400 text-rose-200 drop-shadow-[0_0_8px_#fb7185]'],
  SHIELD: [Shield, 'text-sky-200 fill-sky-400/20 drop-shadow-[0_0_8px_#38bdf8]'],
  FREEZE_TILE: [Snowflake, 'text-cyan-300 drop-shadow-[0_0_8px_#22d3ee]'],
  DOUBLE_DAMAGE: [Swords, 'text-purple-300 drop-shadow-[0_0_8px_#c084fc]'],
};

/** The icon for `card` at `sizeClass`. Undefined for unknown cards. */
export function cardIcon(card: string, sizeClass: string, fallback?: React.ReactNode): React.ReactNode {
  const entry = CARD_ICONS[card];
  if (entry) {
    const [Icon, colorClass] = entry;
    return <Icon className={`${sizeClass} ${colorClass}`} />;
  }
  return fallback;
}
