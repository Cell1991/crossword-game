import { BoardCell, CellPosition, HintTile, PlacedTile } from '@/lib/types';
import { TilePalette } from '@/lib/tileTheme';
import { BoardModel } from '@/lib/engine/boardModel';
import { GridRenderer } from './GridRenderer';
import { TileRenderer, TileRenderContext } from './TileRenderer';
import { FXRenderer } from './FXRenderer';

export interface SceneRenderConfig {
  width: number;
  height: number;
  offset: { x: number; y: number };
  cellSize: number;
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
  temporaryTilesValid: boolean | null;
  remotePlacements: CellPosition[];
  selectedCell: CellPosition | null;
  dragPreviewCell: CellPosition | null;
  dragPreviewTile: { letter: string; value: number } | null;
  dragPreviewIsValid: boolean | null;
  draggingTileId: string | null;
  frozenTile: CellPosition | null;
  hintCell: CellPosition | null;
  hintTiles?: HintTile[] | null;
  pendingArmedCell: CellPosition | null;
  pendingArmedCard?: string | null;
  lowPower: boolean;
  tilePalette: TilePalette;
  model: BoardModel;
  animTime?: number;
  tileAnimations?: Map<string, number>;
}

/**
 * Master Compositor coordinating layer rendering and frustum culling.
 */
export class BoardCompositor {
  public static composite(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    config: SceneRenderConfig
  ): void {
    const { width, height, offset, cellSize, model } = config;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Frustum culling intersection with active board bounds
    const activeBounds = model.getActiveBounds();
    const viewportMinCol = Math.floor(-offset.x / cellSize) - 1;
    const viewportMaxCol = Math.ceil((width - offset.x) / cellSize) + 1;
    const viewportMinRow = Math.floor(-offset.y / cellSize) - 1;
    const viewportMaxRow = Math.ceil((height - offset.y) / cellSize) + 1;

    const minCol = Math.max(viewportMinCol, activeBounds.minCol - 8);
    const maxCol = Math.min(viewportMaxCol, activeBounds.maxCol + 8);
    const minRow = Math.max(viewportMinRow, activeBounds.minRow - 8);
    const maxRow = Math.min(viewportMaxRow, activeBounds.maxRow + 8);

    const isCellVisible = (row: number, col: number) => (
      row >= viewportMinRow && row <= viewportMaxRow && col >= viewportMinCol && col <= viewportMaxCol
    );

    // 2. Layer 1: Grid and Premium Cell Fills
    if (minCol <= maxCol && minRow <= maxRow) {
      GridRenderer.render({
        ctx,
        offset,
        cellSize,
        lowPower: config.lowPower,
        model,
        bounds: { minRow, maxRow, minCol, maxCol },
      });
    }

    const tileContext: TileRenderContext = {
      ctx,
      offset,
      cellSize,
      lowPower: config.lowPower,
      tilePalette: config.tilePalette,
      temporaryTilesValid: config.temporaryTilesValid,
      animTime: config.animTime,
      tileAnimations: config.tileAnimations,
    };

    // 3. Layer 2: Committed Board Tiles
    for (const key in config.boardState) {
      const cell = config.boardState[key];
      if (isCellVisible(cell.row, cell.col)) {
        const isFrozen = config.frozenTile?.row === cell.row && config.frozenTile?.col === cell.col;
        TileRenderer.renderTile(
          tileContext,
          cell.row,
          cell.col,
          cell.letter,
          cell.value,
          false,
          true,
          false,
          isFrozen
        );
      }
    }

    // 3.5 Layer 2.5: Hint Ghost Tiles (suggested word placements for unplaced cells)
    if (config.hintTiles && config.hintTiles.length > 0) {
      for (let i = 0; i < config.hintTiles.length; i++) {
        const ht = config.hintTiles[i];
        if (!isCellVisible(ht.row, ht.col)) continue;
        const isOccupiedByCommitted = Boolean(config.boardState[`${ht.row}_${ht.col}`]);
        const isOccupiedByTemporary = config.temporaryTiles.some(t => t.row === ht.row && t.col === ht.col && t.tile_id !== config.draggingTileId);
        if (!isOccupiedByCommitted && !isOccupiedByTemporary) {
          TileRenderer.renderGhostTile(tileContext, ht.row, ht.col, ht.letter, ht.value);
        }
      }
    }

    // 4. Layer 3: Action Reticles
    if (config.pendingArmedCell && isCellVisible(config.pendingArmedCell.row, config.pendingArmedCell.col)) {
      FXRenderer.renderPendingArmed(ctx, config.pendingArmedCell, offset, cellSize, config.pendingArmedCard);
    }

    // 5. Layer 4: Temporary Placed Tiles
    for (let i = 0; i < config.temporaryTiles.length; i++) {
      const pt = config.temporaryTiles[i];
      if (pt.tile_id === config.draggingTileId) continue;
      if (isCellVisible(pt.row, pt.col)) {
        TileRenderer.renderTile(tileContext, pt.row, pt.col, pt.letter, pt.value, true);
      }
    }

    // 6. Layer 5: Drag Preview & Remote Placements
    if (config.dragPreviewCell && config.dragPreviewTile) {
      TileRenderer.renderTile(
        tileContext,
        config.dragPreviewCell.row,
        config.dragPreviewCell.col,
        config.dragPreviewTile.letter,
        config.dragPreviewTile.value,
        true
      );
      FXRenderer.renderDragPreviewBox(
        ctx,
        config.dragPreviewCell,
        config.dragPreviewIsValid,
        offset,
        cellSize
      );
    }

    for (let i = 0; i < config.remotePlacements.length; i++) {
      const placement = config.remotePlacements[i];
      if (isCellVisible(placement.row, placement.col)) {
        TileRenderer.renderTile(tileContext, placement.row, placement.col, '', 0, true, false, true);
      }
    }

    // 7. Layer 6: Selection Box (only drawn when cell is not occupied by a temporary tile)
    if (config.selectedCell && isCellVisible(config.selectedCell.row, config.selectedCell.col)) {
      const isTemporary = config.temporaryTiles.some(
        t => t.row === config.selectedCell!.row && t.col === config.selectedCell!.col
      );
      if (!isTemporary) {
        FXRenderer.renderSelection(ctx, config.selectedCell, offset, cellSize, config.temporaryTilesValid);
      }
    }

    ctx.restore();
  }
}
