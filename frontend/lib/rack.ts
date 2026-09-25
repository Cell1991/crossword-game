import { Tile } from './types';
import { RACK_SIZE } from './tiles';

/**
 * The rack as fixed seats: each entry is the tile id sitting in that seat, or `null` for a gap.
 * A tile keeps its seat while it sits on the board, so its neighbours never slide over to close
 * the gap. These helpers are pure so the seating rules can be reasoned about (and tested) apart
 * from React.
 */
export type RackOrder = (string | null)[];

/** Seats the rack currently knows about, padded so every seat index is addressable. */
export function padRackOrder(order: RackOrder, minimumLength = 0): RackOrder {
  const length = Math.max(RACK_SIZE, order.length, minimumLength);
  const nextOrder: RackOrder = [];
  for (let slotIndex = 0; slotIndex < length; slotIndex += 1) {
    nextOrder.push(order[slotIndex] ?? null);
  }
  return nextOrder;
}

/** Shuffles the tiles still on the stand. Gaps left by placed tiles keep their seats. */
export function shuffleRackOrder(order: RackOrder, pendingTileIds: ReadonlySet<string>): RackOrder {
  const nextOrder = padRackOrder(order);
  const seatIndexes: number[] = [];
  const tileIds: string[] = [];
  nextOrder.forEach((tileId, slotIndex) => {
    if (tileId && !pendingTileIds.has(tileId)) {
      seatIndexes.push(slotIndex);
      tileIds.push(tileId);
    }
  });
  if (tileIds.length < 2) return order;
  for (let index = tileIds.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [tileIds[index], tileIds[randomIndex]] = [tileIds[randomIndex], tileIds[index]];
  }
  seatIndexes.forEach((slotIndex, index) => { nextOrder[slotIndex] = tileIds[index]; });
  return nextOrder;
}

/** Dragging inside the rack always swaps two seats, so a gap follows the tile it traded with. */
export function swapRackSeats(order: RackOrder, fromSlot: number, toSlot: number): RackOrder {
  const nextOrder = padRackOrder(order, Math.max(fromSlot, toSlot) + 1);
  [nextOrder[fromSlot], nextOrder[toSlot]] = [nextOrder[toSlot], nextOrder[fromSlot]];
  return nextOrder;
}

/**
 * Seats a tile coming back from the board. It lands on the seat it was dropped on; if that
 * one is taken by a tile still on the stand, it falls back to the nearest free seat.
 */
export function seatReturningTile(
  order: RackOrder,
  tileId: string,
  targetSlot: number,
  pendingTileIds: ReadonlySet<string>
): RackOrder {
  const nextOrder = padRackOrder(order, targetSlot + 1);
  const fromSlot = nextOrder.indexOf(tileId);
  if (fromSlot < 0) return order;
  const isFree = (slotIndex: number) => {
    if (slotIndex < 0 || slotIndex >= nextOrder.length) return false;
    const occupant = nextOrder[slotIndex];
    return !occupant || occupant === tileId || pendingTileIds.has(occupant);
  };
  let slot = isFree(targetSlot) ? targetSlot : -1;
  for (let distance = 1; slot < 0 && distance < nextOrder.length; distance += 1) {
    if (isFree(targetSlot - distance)) slot = targetSlot - distance;
    else if (isFree(targetSlot + distance)) slot = targetSlot + distance;
  }
  if (slot < 0 || slot === fromSlot) return order;
  [nextOrder[fromSlot], nextOrder[slot]] = [nextOrder[slot], nextOrder[fromSlot]];
  return nextOrder;
}

/**
 * Brings the seating in line with the rack the server just sent. Tiles the server no longer
 * knows about (played, stolen, swapped) free their seat; freshly drawn tiles fill the free
 * seats from the left. Returns `order` itself when nothing changed.
 */
export function reconcileRackOrder(order: RackOrder, serverTileIds: string[]): RackOrder {
  const serverIds = new Set(serverTileIds);
  const slotCount = Math.max(RACK_SIZE, order.length, serverTileIds.length);
  const nextOrder: RackOrder = [];
  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const tileId = order[slotIndex] ?? null;
    nextOrder.push(tileId && serverIds.has(tileId) ? tileId : null);
  }
  const seated = new Set(nextOrder.filter((tileId): tileId is string => Boolean(tileId)));
  serverTileIds.filter(tileId => !seated.has(tileId)).forEach(tileId => {
    const freeSlot = nextOrder.indexOf(null);
    if (freeSlot >= 0) nextOrder[freeSlot] = tileId;
    else nextOrder.push(tileId);
  });
  const unchanged = nextOrder.length === order.length &&
    nextOrder.every((tileId, index) => tileId === (order[index] ?? null));
  return unchanged ? order : nextOrder;
}

/**
 * The tile in every seat, with tiles staged on the board shown as gaps. Seats stay put once
 * the bag runs dry, which is why the count never drops below RACK_SIZE.
 */
export function buildRackSlots(
  serverRack: Tile[],
  order: RackOrder,
  pendingTileIds: ReadonlySet<string>
): (Tile | null)[] {
  const tilesById = new Map(serverRack.map(tile => [tile.id, tile]));
  const slotCount = Math.max(RACK_SIZE, order.length, serverRack.length);
  const hasSeating = order.some(tileId => tileId && tilesById.has(tileId));
  const slots: (Tile | null)[] = [];
  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const tileId = hasSeating ? order[slotIndex] : serverRack[slotIndex]?.id;
    const tile = tileId ? tilesById.get(tileId) : undefined;
    slots.push(tile && !pendingTileIds.has(tile.id) ? tile : null);
  }
  return slots;
}
