/**
 * Board geometry and premium squares. Keep in sync with backend/app/game/board.py.
 * The premium squares are the classic 15×15 layout spread proportionally over 19 rows × 27 columns.
 */
export const BOARD_ROWS = 19;
export const BOARD_COLS = 27;
export const CENTER_ROW = 9;
export const CENTER_COL = 13;

const cellKeys = (cells: [number, number][]) => new Set(cells.map(([row, col]) => `${row}_${col}`));

export const DOUBLE_LETTER = cellKeys([
  [3, 9], [3, 17], [15, 9], [15, 17],
  [5, 13], [13, 13], [6, 4], [6, 22],
  [12, 4], [12, 22], [8, 7], [8, 19],
  [10, 7], [10, 19],
  // Center cluster from the reference layout: four diagonal 2L cells around the star.
  [8, 12], [8, 14], [10, 12], [10, 14],
]);

export const TRIPLE_LETTER = cellKeys([
  [0, 13], [1, 2], [1, 24], [8, 0],
  [8, 26], [10, 0], [10, 26],
  [17, 2], [17, 24], [18, 13],
  // Requested side 3L anchors, one more cell away from the center star.
  [9, 10], [9, 16],
]);

export const SECRET_POWER = cellKeys([
  [0, 4], [0, 22],
  [1, 7], [1, 19],
  [2, 9], [2, 13], [2, 17],
  [3, 4], [3, 22],
  [5, 7], [5, 19],
  [6, 1], [6, 25],
  [7, 10], [7, 16],
  [9, 4], [9, 22],
  [11, 10], [11, 16],
  [12, 1], [12, 25],
  [13, 7], [13, 19],
  [15, 4], [15, 22],
  [16, 9], [16, 13], [16, 17],
  [17, 7], [17, 19],
  [18, 4], [18, 22],
]);

export function mirrorRow(r: number): number {
  const period = 2 * (BOARD_ROWS - 1); // 36
  const m = ((r % period) + period) % period;
  return m > BOARD_ROWS - 1 ? period - m : m;
}

export function mirrorCol(c: number): number {
  const period = 2 * (BOARD_COLS - 1); // 52
  const m = ((c % period) + period) % period;
  return m > BOARD_COLS - 1 ? period - m : m;
}

export function isTripleLetterCell(row: number, col: number): boolean {
  return TRIPLE_LETTER.has(`${mirrorRow(row)}_${mirrorCol(col)}`);
}

export function isDoubleLetterCell(row: number, col: number): boolean {
  return DOUBLE_LETTER.has(`${mirrorRow(row)}_${mirrorCol(col)}`);
}

export function isPowerCell(row: number, col: number): boolean {
  return SECRET_POWER.has(`${mirrorRow(row)}_${mirrorCol(col)}`);
}

export function cellMultiplier(row: number, col: number): number {
  if (isTripleLetterCell(row, col)) return 3;
  if (isDoubleLetterCell(row, col)) return 2;
  return 1;
}


