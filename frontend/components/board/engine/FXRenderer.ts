import { CellPosition } from '@/lib/types';

export class FXRenderer {
  public static renderHint(
    ctx: CanvasRenderingContext2D,
    cell: CellPosition,
    offset: { x: number; y: number },
    cellSize: number
  ): void {
    const x = offset.x + cell.col * cellSize;
    const y = offset.y + cell.row * cellSize;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
    ctx.setLineDash([]);
  }

  public static renderPendingArmed(
    ctx: CanvasRenderingContext2D,
    cell: CellPosition,
    offset: { x: number; y: number },
    cellSize: number
  ): void {
    const x = offset.x + cell.col * cellSize;
    const y = offset.y + cell.row * cellSize;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.fillRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
  }

  public static renderDragPreviewBox(
    ctx: CanvasRenderingContext2D,
    cell: CellPosition,
    isValid: boolean | null,
    offset: { x: number; y: number },
    cellSize: number
  ): void {
    const previewX = offset.x + cell.col * cellSize;
    const previewY = offset.y + cell.row * cellSize;
    ctx.strokeStyle = isValid ? '#38bdf8' : '#f87171';
    ctx.lineWidth = 3;
    ctx.strokeRect(previewX + 1, previewY + 1, cellSize - 2, cellSize - 2);
  }

  public static renderSelection(
    ctx: CanvasRenderingContext2D,
    cell: CellPosition,
    offset: { x: number; y: number },
    cellSize: number
  ): void {
    const sx = offset.x + cell.col * cellSize;
    const sy = offset.y + cell.row * cellSize;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2);
  }
}
