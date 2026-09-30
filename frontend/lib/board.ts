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

export const DOUBLE_WORD = cellKeys([
  [4, 11], [4, 15],
  [14, 11], [14, 15],
  [9, 5], [9, 21],
]);

export const TRIPLE_WORD = cellKeys([
  [2, 7], [2, 19],
  [16, 7], [16, 19],
  [7, 3], [7, 23],
  [11, 3], [11, 23],
]);

// Lightning tiles award random power cards and stay symmetric around the center star.
export const SECRET_POWER = cellKeys([
  [3, 4], [3, 22],
  [5, 7], [5, 19],
  [7, 10], [7, 16],
  [11, 10], [11, 16],
  [13, 7], [13, 19],
  [15, 4], [15, 22],
  // Additional lightning blocks requested:
  [3, 13], [15, 13],
  [1, 10], [1, 16],
  [17, 10], [17, 16],
  [1, 6], [1, 20],
  [17, 6], [17, 20],
  [4, 2], [4, 24],
  [14, 2], [14, 24],
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

export function isDoubleWordCell(row: number, col: number): boolean {
  return DOUBLE_WORD.has(`${mirrorRow(row)}_${mirrorCol(col)}`);
}

export function isTripleWordCell(row: number, col: number): boolean {
  return TRIPLE_WORD.has(`${mirrorRow(row)}_${mirrorCol(col)}`);
}

export function isPowerCell(row: number, col: number): boolean {
  return SECRET_POWER.has(`${mirrorRow(row)}_${mirrorCol(col)}`);
}

export function cellMultiplier(row: number, col: number): number {
  if (isTripleLetterCell(row, col)) return 3;
  if (isDoubleLetterCell(row, col)) return 2;
  return 1;
}

export function cellWordMultiplier(row: number, col: number): number {
  if (isTripleWordCell(row, col)) return 3;
  if (isDoubleWordCell(row, col)) return 2;
  return 1;
}


