import React from 'react';
import { Eye, Heart, LucideIcon, Repeat2, RotateCcw, Shield, Snowflake } from 'lucide-react';

/** Each power card's icon and colour. DOUBLE_DAMAGE has no icon: callers draw "×2" at their own size. */
const CARD_ICONS: Record<string, [LucideIcon, string]> = {
  HINT: [Eye, 'text-yellow-300'],
  SPY_SWAP: [Repeat2, 'text-cyan-300'],
  DESTROY_TILE: [RotateCcw, 'text-rose-300'],
  HEAL: [Heart, 'fill-rose-400 text-rose-200'],
  SHIELD: [Shield, 'text-sky-200'],
  FREEZE_TILE: [Snowflake, 'text-sky-300'],
};

/** The icon for `card` at `sizeClass`; `doubleDamage` stands in for DOUBLE_DAMAGE. Undefined for unknown cards. */
export function cardIcon(card: string, sizeClass: string, doubleDamage: React.ReactNode): React.ReactNode {
  if (card === 'DOUBLE_DAMAGE') return doubleDamage;
  const entry = CARD_ICONS[card];
  if (!entry) return undefined;
  const [Icon, colorClass] = entry;
  return <Icon className={`${sizeClass} ${colorClass}`} />;
}
