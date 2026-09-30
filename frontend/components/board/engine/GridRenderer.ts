import {
  CENTER_COL,
  CENTER_ROW,
  isDoubleLetterCell,
  isDoubleWordCell,
  isPowerCell,
  isTripleLetterCell,
  isTripleWordCell,
} from '@/lib/board';
import { BoardModel } from '@/lib/engine/boardModel';

export interface GridRenderContext {
  ctx: CanvasRenderingContext2D;
  offset: { x: number; y: number };
  cellSize: number;
  lowPower: boolean;
  model: BoardModel;
  bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number };
}

const NUM_GRID_BUCKETS = 16;
const BUCKET_CAPACITY = 8000;
const gridBuffer = new Float32Array(NUM_GRID_BUCKETS * BUCKET_CAPACITY);
const gridCounts = new Int32Array(NUM_GRID_BUCKETS);

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class GridRenderer {
  public static render(renderContext: GridRenderContext): void {
    const { ctx, offset, cellSize, lowPower, model, bounds } = renderContext;

    ctx.save();

    // 1. Special cell background fills (2L, 3L, 2W, 3W, Power, Center Star)
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const isCenter = r === CENTER_ROW && c === CENTER_COL;
        const isTriple = isTripleLetterCell(r, c);
        const isDouble = isDoubleLetterCell(r, c);
        const isDoubleWord = isDoubleWordCell(r, c);
        const isTripleWord = isTripleWordCell(r, c);
        const isPower = isPowerCell(r, c);

        if (isTriple || isDouble || isDoubleWord || isTripleWord || isPower || isCenter) {
          const lineAlpha = model.getCellAlpha(r, c);
          if (lineAlpha <= 0.005) continue;

          const x = offset.x + c * cellSize;
          const y = offset.y + r * cellSize;
          const specialRadius = Math.max(3, cellSize * 0.12);

          ctx.globalAlpha = lineAlpha;
          if (isTriple) {
            ctx.fillStyle = '#be123c';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          } else if (isDouble) {
            ctx.fillStyle = '#15803d';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          } else if (isDoubleWord) {
            ctx.fillStyle = '#7e22ce';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          } else if (isTripleWord) {
            ctx.fillStyle = '#b45309';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          } else if (isPower) {
            ctx.fillStyle = '#0891b2';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
          }
          if (isCenter) {
            ctx.fillStyle = '#1e1b4b';
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
            ctx.lineWidth = 1.4;
            ctx.stroke();

            if (cellSize >= 12) {
              ctx.save();
              ctx.shadowColor = 'rgba(251, 191, 36, 0.95)';
              ctx.shadowBlur = lowPower ? 0 : Math.max(5, cellSize * 0.25);
              ctx.fillStyle = '#fde047';
              const starSize = Math.max(16, Math.round(cellSize * 0.74));
              ctx.font = `bold ${starSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('★', x + cellSize / 2, y + cellSize / 2);
              ctx.restore();
            }
          }
        }
      }
    }

    // 2. Batched zero-allocation grid line stroke with smooth alpha buckets
    gridCounts.fill(0);
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const lineAlpha = model.getCellAlpha(r, c);
        if (lineAlpha <= 0.005) continue;

        const bucket = Math.min(NUM_GRID_BUCKETS - 1, Math.floor(lineAlpha * NUM_GRID_BUCKETS));
        const count = gridCounts[bucket];
        if (count + 8 < BUCKET_CAPACITY) {
          const base = bucket * BUCKET_CAPACITY + count;
          const x = offset.x + c * cellSize;
          const y = offset.y + r * cellSize;
          // Top horizontal segment
          gridBuffer[base] = x;
          gridBuffer[base + 1] = y;
          gridBuffer[base + 2] = x + cellSize;
          gridBuffer[base + 3] = y;
          // Left vertical segment
          gridBuffer[base + 4] = x;
          gridBuffer[base + 5] = y;
          gridBuffer[base + 6] = x;
          gridBuffer[base + 7] = y + cellSize;
          gridCounts[bucket] += 8;
        }
      }
    }

    ctx.strokeStyle = 'rgba(245, 190, 72, 0.24)';
    ctx.lineWidth = 1;
    for (let b = 0; b < NUM_GRID_BUCKETS; b++) {
      const count = gridCounts[b];
      if (count === 0) continue;
      ctx.globalAlpha = (b + 0.5) / NUM_GRID_BUCKETS;
      ctx.beginPath();
      const base = b * BUCKET_CAPACITY;
      for (let i = 0; i < count; i += 4) {
        ctx.moveTo(gridBuffer[base + i], gridBuffer[base + i + 1]);
        ctx.lineTo(gridBuffer[base + i + 2], gridBuffer[base + i + 3]);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
