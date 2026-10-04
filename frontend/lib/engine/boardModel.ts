import {
  BOARD_COLS,
  BOARD_ROWS,
  CENTER_COL,
  CENTER_ROW,
  getCellType,
  CELL_TYPE_DOUBLE,
  CELL_TYPE_TRIPLE,
  CELL_TYPE_POWER,
} from '@/lib/board';
import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import { cellKey } from '@/lib/tiles';

export interface BoardBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface PremiumEchoCell {
  row: number;
  col: number;
  type: 'power' | 'triple' | 'double';
  distance: number;
  isSolid: boolean;
  alpha: number;
}

/**
 * Domain model managing board state, coordinate math, spatial queries,
 * and mirror reflections with O(1) performance.
 */
export class BoardModel {
  private occupiedMap = new Map<string, CellPosition>();
  private occupiedList: CellPosition[] = [];
  /** Max local aura and nearest Chebyshev distance contributed by nearby occupied tiles. */
  private occupiedInfluence = new Map<string, { alpha: number; distance: number }>();
  private bounds: BoardBounds = {
    minRow: 0,
    maxRow: BOARD_ROWS - 1,
    minCol: 0,
    maxCol: BOARD_COLS - 1,
  };

  /**
   * Updates current occupied tiles and recalculates active envelope bounds.
   */
  public updateState(
    boardState: Record<string, BoardCell>,
    temporaryTiles: PlacedTile[] = [],
    remotePlacements: CellPosition[] = []
  ): void {
    this.occupiedMap.clear();
    this.occupiedList = [];
    this.occupiedInfluence.clear();

    let minR = 0;
    let maxR = BOARD_ROWS - 1;
    let minC = 0;
    let maxC = BOARD_COLS - 1;

    // Committed tiles
    for (const key in boardState) {
      const cell = boardState[key];
      this.occupiedMap.set(key, { row: cell.row, col: cell.col });
      this.occupiedList.push({ row: cell.row, col: cell.col });
      if (cell.row < minR) minR = cell.row;
      if (cell.row > maxR) maxR = cell.row;
      if (cell.col < minC) minC = cell.col;
      if (cell.col > maxC) maxC = cell.col;
    }

    // Temporary staged tiles
    for (let i = 0; i < temporaryTiles.length; i++) {
      const t = temporaryTiles[i];
      const key = cellKey(t.row, t.col);
      if (!this.occupiedMap.has(key)) {
        this.occupiedMap.set(key, { row: t.row, col: t.col });
        this.occupiedList.push({ row: t.row, col: t.col });
      }
      if (t.row < minR) minR = t.row;
      if (t.row > maxR) maxR = t.row;
      if (t.col < minC) minC = t.col;
      if (t.col > maxC) maxC = t.col;
    }

    // Remote opponent placements
    for (let i = 0; i < remotePlacements.length; i++) {
      const p = remotePlacements[i];
      const key = cellKey(p.row, p.col);
      if (!this.occupiedMap.has(key)) {
        this.occupiedMap.set(key, p);
        this.occupiedList.push(p);
      }
      if (p.row < minR) minR = p.row;
      if (p.row > maxR) maxR = p.row;
      if (p.col < minC) minC = p.col;
      if (p.col > maxC) maxC = p.col;
    }

    this.bounds = { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC };

    // An occupied tile only affects cell opacity within a small local radius. Build that
    // influence once per board snapshot instead of rescanning every occupied tile for every
    // visible grid cell (and every candidate premium cell) during rendering.
    for (let i = 0; i < this.occupiedList.length; i++) {
      const tile = this.occupiedList[i];
      for (let dr = -8; dr <= 8; dr++) {
        for (let dc = -9; dc <= 9; dc++) {
          const tileDist = Math.hypot(dr, dc * 0.85);
          const key = cellKey(tile.row + dr, tile.col + dc);
          const distance = Math.max(Math.abs(dr), Math.abs(dc));
          const alpha = tileDist > 8.2
            ? 0
            : tileDist <= 1.2
              ? 1
              : Math.pow(1 - (tileDist - 1.2) / 7, 1.4);
          const previous = this.occupiedInfluence.get(key);
          if (!previous) {
            this.occupiedInfluence.set(key, { alpha, distance });
          } else {
            if (alpha > previous.alpha) previous.alpha = alpha;
            if (distance < previous.distance) previous.distance = distance;
          }
        }
      }
    }
  }

  public isOccupied(row: number, col: number): boolean {
    return this.occupiedMap.has(cellKey(row, col));
  }

  public getOccupiedTiles(): CellPosition[] {
    return this.occupiedList;
  }

  public getActiveBounds(): BoardBounds {
    return this.bounds;
  }

  /**
   * Calculates cell opacity based on the Superellipse oval contour
   * and 8-block radial lookahead aura around placed words.
   */
  public getCellAlpha(row: number, col: number): number {
    const p = 2.6;
    const dx = Math.abs(col - CENTER_COL) / 14.6;
    const dy = Math.abs(row - CENTER_ROW) / 11.6;
    const superellipseNorm = Math.pow(Math.pow(dx, p) + Math.pow(dy, p), 1 / p);

    let alpha = 0;
    if (superellipseNorm <= 0.88) {
      alpha = 1.0;
    } else if (superellipseNorm <= 1.24) {
      const t = (superellipseNorm - 0.88) / (1.24 - 0.88);
      alpha = Math.pow(1 - t, 1.5);
    }

    const influence = this.occupiedInfluence.get(cellKey(row, col));
    if (influence) alpha = Math.max(alpha, influence.alpha);

    return Math.max(0, Math.min(1, alpha));
  }

  /**
   * Computes min distance from (row, col) to any placed word.
   */
  public getDistanceToOccupied(row: number, col: number): number {
    const cached = this.occupiedInfluence.get(cellKey(row, col));
    if (cached) return cached.distance;
    if (this.occupiedList.length === 0) return Infinity;
    let minD = Infinity;
    for (let i = 0; i < this.occupiedList.length; i++) {
      const tile = this.occupiedList[i];
      const distance = Math.max(Math.abs(tile.row - row), Math.abs(tile.col - col));
      if (distance < minD) minD = distance;
    }
    return minD;
  }

  /**
   * Generates candidate premium echo tiles around placed words and starter perimeter.
   */
  public getCandidateEchoes(): PremiumEchoCell[] {
    const echoes = new Map<string, PremiumEchoCell>();
    const occupied = this.occupiedList;

    // 1. Check around each placed tile (up to 8 cells away)
    for (let i = 0; i < occupied.length; i++) {
      const tile = occupied[i];
      for (let dr = -8; dr <= 8; dr++) {
        for (let dc = -8; dc <= 8; dc++) {
          const r = tile.row + dr;
          const c = tile.col + dc;
          if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) continue;
          const key = `${r}_${c}`;
          if (echoes.has(key) || this.isOccupied(r, c)) continue;

          const cellType = getCellType(r, c);
          let type: 'power' | 'triple' | 'double' | null = null;
          if (cellType === CELL_TYPE_POWER) type = 'power';
          else if (cellType === CELL_TYPE_TRIPLE) type = 'triple';
          else if (cellType === CELL_TYPE_DOUBLE) type = 'double';

          if (type) {
            const distance = this.getDistanceToOccupied(r, c);
            const isSolid = distance <= 5;
            const baseAlpha = this.getCellAlpha(r, c);
            const alpha = isSolid ? baseAlpha : baseAlpha * 0.28;
            if (alpha > 0.01) {
              echoes.set(key, { row: r, col: c, type, distance, isSolid, alpha });
            }
          }
        }
      }
    }

    // 2. Check around starter board edges (up to 3 cells away)
    for (let r = -3; r <= BOARD_ROWS + 2; r++) {
      for (let c = -3; c <= BOARD_COLS + 2; c++) {
        if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) continue;
        const key = `${r}_${c}`;
        if (echoes.has(key) || this.isOccupied(r, c)) continue;

        const cellType = getCellType(r, c);
        let type: 'power' | 'triple' | 'double' | null = null;
        if (cellType === CELL_TYPE_POWER) type = 'power';
        else if (cellType === CELL_TYPE_TRIPLE) type = 'triple';
        else if (cellType === CELL_TYPE_DOUBLE) type = 'double';

        if (type) {
          const distance = this.getDistanceToOccupied(r, c);
          const isSolid = distance <= 5;
          const baseAlpha = this.getCellAlpha(r, c);
          const alpha = isSolid ? baseAlpha : baseAlpha * 0.28;
          if (alpha > 0.01) {
            echoes.set(key, { row: r, col: c, type, distance, isSolid, alpha });
          }
        }
      }
    }

    return [...echoes.values()];
  }
}
