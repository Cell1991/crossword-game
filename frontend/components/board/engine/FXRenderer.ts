import { CellPosition } from '@/lib/types';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
    cellSize: number,
    cardType?: string | null
  ): void {
    const x = offset.x + cell.col * cellSize;
    const y = offset.y + cell.row * cellSize;
    const isFreeze = cardType === 'FREEZE_TILE';
    ctx.strokeStyle = isFreeze ? '#38bdf8' : '#f43f5e';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
    ctx.fillStyle = isFreeze ? 'rgba(56, 189, 248, 0.25)' : 'rgba(244, 63, 94, 0.22)';
    ctx.fillRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
  }

  public static renderDragPreviewBox(
    ctx: CanvasRenderingContext2D,
    cell: CellPosition,
    isValid: boolean | null,
    offset: { x: number; y: number },
    cellSize: number
  ): void {
    const pad = Math.max(1, cellSize * 0.06);
    const x = offset.x + cell.col * cellSize + pad;
    const y = offset.y + cell.row * cellSize + pad;
    const w = cellSize - pad * 2;
    const radius = Math.max(2, cellSize * 0.12);

    ctx.save();
    ctx.lineWidth = Math.max(2, cellSize * 0.04);
    if (isValid === false) {
      ctx.strokeStyle = '#f87171';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.65)';
    } else {
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = 'rgba(245, 158, 11, 0.65)';
    }
    ctx.shadowBlur = Math.max(4, cellSize * 0.15);
    drawRoundedRect(ctx, x, y, w, w, radius);
    ctx.stroke();
    ctx.restore();
  }

  public static renderSelection(
    ctx: CanvasRenderingContext2D,
    cell: CellPosition,
    offset: { x: number; y: number },
    cellSize: number
  ): void {
    const pad = Math.max(1, cellSize * 0.06);
    const x = offset.x + cell.col * cellSize + pad;
    const y = offset.y + cell.row * cellSize + pad;
    const w = cellSize - pad * 2;
    const radius = Math.max(2, cellSize * 0.12);

    ctx.save();

    // 1. Ambient Warm Golden Aura
    ctx.shadowColor = 'rgba(245, 158, 11, 0.85)';
    ctx.shadowBlur = Math.max(6, cellSize * 0.22);

    // 2. Luxury Amber-Gold Gradient Ring
    const haloGrad = ctx.createLinearGradient(x, y, x + w, y + w);
    haloGrad.addColorStop(0, '#fef08a');   // Radiant pale gold highlight
    haloGrad.addColorStop(0.35, '#fbbf24'); // Vibrant amber gold
    haloGrad.addColorStop(0.7, '#f59e0b');  // Deep warm amber
    haloGrad.addColorStop(1, '#d97706');    // Rich dark gold

    ctx.strokeStyle = haloGrad;
    ctx.lineWidth = Math.max(2, cellSize * 0.045);
    drawRoundedRect(ctx, x, y, w, w, radius);
    ctx.stroke();

    // 3. Subtle Crystal Edge Specular Accent
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    const innerPad = 1;
    drawRoundedRect(ctx, x + innerPad, y + innerPad, w - innerPad * 2, w - innerPad * 2, Math.max(1, radius - innerPad));
    ctx.stroke();

    ctx.restore();
  }
}
