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
    cellSize: number,
    isValid?: boolean | null
  ): void {
    const pad = Math.max(1, cellSize * 0.06);
    const x = offset.x + cell.col * cellSize + pad;
    const y = offset.y + cell.row * cellSize + pad;
    const w = cellSize - pad * 2;
    const radius = Math.max(2, cellSize * 0.12);

    ctx.save();

    if (isValid === true) {
      // 1. Radiant Emerald Victory Halo
      ctx.shadowColor = 'rgba(34, 197, 94, 0.85)';
      ctx.shadowBlur = Math.max(12, cellSize * 0.32);

      const haloGrad = ctx.createLinearGradient(x, y, x + w, y + w);
      haloGrad.addColorStop(0, '#86efac');  // Crisp warm lime-mint
      haloGrad.addColorStop(0.3, '#4ade80'); // Radiant neon emerald
      haloGrad.addColorStop(0.7, '#22c55e'); // Rich tournament green
      haloGrad.addColorStop(1, '#16a34a');  // Deep pure emerald

      ctx.strokeStyle = haloGrad;
      ctx.lineWidth = Math.max(2.5, cellSize * 0.055);
      drawRoundedRect(ctx, x, y, w, w, radius);
      ctx.stroke();

      // Crystal edge specular accent
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1;
      const innerPad = 1;
      drawRoundedRect(ctx, x + innerPad, y + innerPad, w - innerPad * 2, w - innerPad * 2, Math.max(1, radius - innerPad));
      ctx.stroke();
    } else {
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
    }

    ctx.restore();
  }

  public static renderDragHoverTrail(
    ctx: CanvasRenderingContext2D,
    activeHover: CellPosition | null,
    trailMap: Map<string, { row: number; col: number; time: number }> | undefined,
    offset: { x: number; y: number },
    cellSize: number,
    now: number
  ): void {
    if (!activeHover && (!trailMap || trailMap.size === 0)) return;

    const pad = Math.max(1, cellSize * 0.05);
    const radius = Math.max(3, cellSize * 0.14);
    const FADE_DURATION = 320; // ms

    ctx.save();

    // 1. Render fading comet trail cells
    if (trailMap) {
      for (const [key, item] of trailMap.entries()) {
        const isCurrent = activeHover && activeHover.row === item.row && activeHover.col === item.col;
        if (isCurrent) continue;

        const age = now - item.time;
        if (age >= FADE_DURATION) {
          trailMap.delete(key);
          continue;
        }

        const progress = Math.max(0, 1 - age / FADE_DURATION);
        const alpha = Math.pow(progress, 1.6);
        if (alpha <= 0.01) continue;

        const x = offset.x + item.col * cellSize + pad;
        const y = offset.y + item.row * cellSize + pad;
        const w = cellSize - pad * 2;

        // Soft white starlight trail fill
        ctx.fillStyle = `rgba(255, 255, 255, ${0.14 * alpha})`;
        drawRoundedRect(ctx, x, y, w, w, radius);
        ctx.fill();

        // Soft starlight border
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * alpha})`;
        ctx.lineWidth = Math.max(1.5, cellSize * 0.035);
        ctx.shadowColor = `rgba(255, 255, 255, ${0.6 * alpha})`;
        ctx.shadowBlur = Math.max(4, cellSize * 0.12) * alpha;
        drawRoundedRect(ctx, x, y, w, w, radius);
        ctx.stroke();
      }
    }

    // 2. Render active hovered cell with radiant celestial starlight aura
    if (activeHover) {
      const x = offset.x + activeHover.col * cellSize + pad;
      const y = offset.y + activeHover.row * cellSize + pad;
      const w = cellSize - pad * 2;

      // Inner radiant flare
      const centerFlare = ctx.createRadialGradient(
        x + w / 2, y + w / 2, 0,
        x + w / 2, y + w / 2, w * 0.75
      );
      centerFlare.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
      centerFlare.addColorStop(0.5, 'rgba(255, 255, 255, 0.20)');
      centerFlare.addColorStop(1, 'rgba(255, 255, 255, 0.06)');

      ctx.fillStyle = centerFlare;
      drawRoundedRect(ctx, x, y, w, w, radius);
      ctx.fill();

      // Outer luminous starlight halo
      ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = Math.max(8, cellSize * 0.24);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, cellSize * 0.045);
      drawRoundedRect(ctx, x, y, w, w, radius);
      ctx.stroke();

      // Inner specular crisp ring
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      const innerPad = 1;
      drawRoundedRect(ctx, x + innerPad, y + innerPad, w - innerPad * 2, w - innerPad * 2, Math.max(1, radius - innerPad));
      ctx.stroke();
    }

    ctx.restore();
  }
}
