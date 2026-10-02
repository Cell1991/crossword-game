import React from 'react';
import { Eye, Flame, Heart, LucideIcon, Repeat2, Shield, Snowflake, Swords } from 'lucide-react';

/** Each power card's icon and colour. */
const CARD_ICONS: Record<string, [LucideIcon, string]> = {
  HINT: [Eye, 'text-yellow-300'],
  SPY_SWAP: [Repeat2, 'text-cyan-300'],
  DESTROY_TILE: [Flame, 'text-orange-400 fill-orange-400/20'],
  HEAL: [Heart, 'fill-rose-400 text-rose-200'],
  SHIELD: [Shield, 'text-sky-200'],
  FREEZE_TILE: [Snowflake, 'text-sky-300'],
  DOUBLE_DAMAGE: [Swords, 'text-purple-300'],
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
