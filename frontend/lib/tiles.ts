import { BoardCell } from './types';

/** Seats on the rack stand. The rack always shows this many, even when the bag runs dry. */
export const RACK_SIZE = 7;

/** A blank tile arrives as `BLANK` (or `?`) until the player names the letter it stands for. */
export function isBlankLetter(letter: string): boolean {
  return letter.toUpperCase() === 'BLANK' || letter === '?';
}

/** Board cells are keyed `row_col`, the same way the server keys `board_state`. */
export function cellKey(row: number, col: number): string {
  return `${row}_${col}`;
}

/** Whether a committed tile already sits on this cell (a key lookup, not a scan of the board). */
export function isCellCommitted(boardState: Record<string, BoardCell>, row: number, col: number): boolean {
  return Boolean(boardState[cellKey(row, col)]);
}
