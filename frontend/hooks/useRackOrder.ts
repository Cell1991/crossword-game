'use client';

import { useCallback, useState } from 'react';
import { Tile } from '@/lib/types';
import {
  RackOrder,
  reconcileRackOrder,
  seatReturningTile,
  shuffleRackOrder,
  swapRackSeats,
} from '@/lib/rack';

/** Which tile sits in which rack seat. The seating is local to this device; the server only knows the tiles. */
export function useRackOrder() {
  const [rackOrder, setRackOrder] = useState<RackOrder>([]);

  const shuffle = useCallback((pendingTileIds: ReadonlySet<string>) => {
    setRackOrder(previous => shuffleRackOrder(previous, pendingTileIds));
  }, []);

  const swapSeats = useCallback((fromSlot: number, toSlot: number) => {
    if (fromSlot === toSlot) return;
    setRackOrder(previous => swapRackSeats(previous, fromSlot, toSlot));
  }, []);

  const seatReturning = useCallback((tileId: string, targetSlot: number, pendingTileIds: ReadonlySet<string>) => {
    setRackOrder(previous => seatReturningTile(previous, tileId, targetSlot, pendingTileIds));
  }, []);

  /** Follows the rack the server just sent (see reconcileRackOrder). */
  const reconcile = useCallback((serverRack: Tile[]) => {
    const serverTileIds = serverRack.map(tile => tile.id);
    setRackOrder(previous => reconcileRackOrder(previous, serverTileIds));
  }, []);

  return { rackOrder, shuffle, swapSeats, seatReturning, reconcile };
}
