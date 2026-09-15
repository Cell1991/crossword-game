/**
 * Board geometry and premium squares. Keep in sync with backend/app/game/board.py.
 * The premium squares are the classic 15×15 layout spread proportionally over 19 rows × 27 columns.
 */
export const BOARD_ROWS = 19;
export const BOARD_COLS = 27;
export const CENTER_ROW = 9;
export const CENTER_COL = 13;

const cellKeys = (cells: [number, number][]) => new Set(cells.map(([row, col]) => `${row}_${col}`));

export const TRIPLE_LETTER = cellKeys([
  [0, 13], [1, 2], [1, 24], [8, 0],
  [8, 26], [17, 2], [17, 24], [18, 13],
]);

export const DOUBLE_LETTER = cellKeys([
  [3, 9], [3, 17], [5, 13], [6, 4],
  [6, 22], [8, 7], [8, 19], [10, 4],
  [10, 22], [12, 13], [14, 9], [14, 17],
]);

export const SECRET_POWER = cellKeys([
  [3, 4], [3, 22], [5, 7], [5, 19],
  [13, 7], [13, 19], [15, 4], [15, 22],
]);
