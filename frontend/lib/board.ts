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
  [2, 13],
  [3, 4], [3, 22],
  [5, 7], [5, 11], [5, 15], [5, 19],
  [6, 1], [6, 25],
  [7, 10], [7, 16],
  [9, 4], [9, 22],
  [11, 10], [11, 16],
  [12, 1], [12, 25],
  [13, 7], [13, 11], [13, 15], [13, 19],
  [15, 4], [15, 22],
  [16, 13],
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

export const CELL_TYPE_NORMAL = 0;
export const CELL_TYPE_CENTER = 1;
export const CELL_TYPE_DOUBLE = 2;
export const CELL_TYPE_TRIPLE = 3;
export const CELL_TYPE_POWER = 4;

// Precomputed flat lookup table: eliminates string template allocations in tight 120 FPS render loops
const CELL_TYPE_TABLE = new Uint8Array(BOARD_ROWS * BOARD_COLS);

for (let r = 0; r < BOARD_ROWS; r++) {
  for (let c = 0; c < BOARD_COLS; c++) {
    const key = `${r}_${c}`;
    const idx = r * BOARD_COLS + c;
    if (r === CENTER_ROW && c === CENTER_COL) {
      CELL_TYPE_TABLE[idx] = CELL_TYPE_CENTER;
    } else if (TRIPLE_LETTER.has(key)) {
      CELL_TYPE_TABLE[idx] = CELL_TYPE_TRIPLE;
    } else if (DOUBLE_LETTER.has(key)) {
      CELL_TYPE_TABLE[idx] = CELL_TYPE_DOUBLE;
    } else if (SECRET_POWER.has(key)) {
      CELL_TYPE_TABLE[idx] = CELL_TYPE_POWER;
    } else {
      CELL_TYPE_TABLE[idx] = CELL_TYPE_NORMAL;
    }
  }
}

export function getCellType(row: number, col: number): number {
  return CELL_TYPE_TABLE[mirrorRow(row) * BOARD_COLS + mirrorCol(col)];
}

export function isTripleLetterCell(row: number, col: number): boolean {
  return CELL_TYPE_TABLE[mirrorRow(row) * BOARD_COLS + mirrorCol(col)] === CELL_TYPE_TRIPLE;
}

export function isDoubleLetterCell(row: number, col: number): boolean {
  return CELL_TYPE_TABLE[mirrorRow(row) * BOARD_COLS + mirrorCol(col)] === CELL_TYPE_DOUBLE;
}

export function isPowerCell(row: number, col: number): boolean {
  return CELL_TYPE_TABLE[mirrorRow(row) * BOARD_COLS + mirrorCol(col)] === CELL_TYPE_POWER;
}

export function cellMultiplier(row: number, col: number): number {
  const type = CELL_TYPE_TABLE[mirrorRow(row) * BOARD_COLS + mirrorCol(col)];
  if (type === CELL_TYPE_TRIPLE) return 3;
  if (type === CELL_TYPE_DOUBLE) return 2;
  return 1;
}


