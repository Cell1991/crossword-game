import { BoardCell, CellPosition, HintTile, PlacedTile } from '@/lib/types';
import { TilePalette } from '@/lib/tileTheme';
import { BoardModel } from '@/lib/engine/boardModel';
import { BoardCompositor, SceneRenderConfig } from './engine/BoardCompositor';

export { BoardModel } from '@/lib/engine/boardModel';
export { BoardCompositor } from './engine/BoardCompositor';
export { GridRenderer } from './engine/GridRenderer';
export { TileRenderer } from './engine/TileRenderer';
export { FXRenderer } from './engine/FXRenderer';

export interface BoardScene {
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
  model?: BoardModel;
}

const sharedModel = new BoardModel();

/**
 * Calculates cell alpha contour (Superellipse + 8-cell radial lookahead).
 */
export function getCellAlpha(row: number, col: number, occupiedTiles: CellPosition[] = []): number {
  sharedModel.updateState({}, occupiedTiles.map((t, i) => ({
    tile_id: `t-${i}`,
    row: t.row,
    col: t.col,
    letter: '',
    value: 0,
    created_at: 0,
  })));
  return sharedModel.getCellAlpha(row, col);
}

/**
 * High-performance draw function delegating to the modular BoardCompositor.
 */
export function drawBoard(ctx: CanvasRenderingContext2D, dpr: number, scene: BoardScene): void {
  const model = scene.model ?? sharedModel;
  if (!scene.model) {
    model.updateState(scene.boardState, scene.temporaryTiles, scene.remotePlacements);
  }

  const config: SceneRenderConfig = {
    ...scene,
    model,
  };

  BoardCompositor.composite(ctx, dpr, config);
}
