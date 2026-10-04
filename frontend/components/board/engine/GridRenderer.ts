import {
  CENTER_COL,
  CENTER_ROW,
  getCellType,
  CELL_TYPE_CENTER,
  CELL_TYPE_DOUBLE,
  CELL_TYPE_TRIPLE,
  CELL_TYPE_POWER,
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
/**
 * Grid line segments grouped by alpha. Reused across frames and only truncated, never
 * reallocated, so a steady-state frame allocates nothing while the board stays free to grow:
 * the fixed-capacity buffer this replaces silently dropped lines once a view exceeded it.
 */
const gridBuckets: number[][] = Array.from({ length: NUM_GRID_BUCKETS }, () => []);

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

    // 1. Special cell fills (2L, 3L, Power, Center Star), collecting each cell's grid lines in
    //    the same pass: the alpha drives both, and computing it once per cell halves the work.
    for (const bucket of gridBuckets) bucket.length = 0;

    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const lineAlpha = model.getCellAlpha(r, c);
        if (lineAlpha <= 0.005) continue;

        const x = offset.x + c * cellSize;
        const y = offset.y + r * cellSize;

        const bucketIndex = Math.min(NUM_GRID_BUCKETS - 1, Math.floor(lineAlpha * NUM_GRID_BUCKETS));
        gridBuckets[bucketIndex].push(
          x, y, x + cellSize, y,          // top horizontal segment
          x, y, x, y + cellSize,          // left vertical segment
        );

        const isCenter = r === CENTER_ROW && c === CENTER_COL;
        const cellType = isCenter ? CELL_TYPE_CENTER : getCellType(r, c);

        if (cellType !== 0) {
          ctx.globalAlpha = lineAlpha;
          const specialRadius = Math.max(2, cellSize * 0.12);

          if (cellType === CELL_TYPE_TRIPLE) {
            // Radiant Ruby Fire Gradient & Glow
            const rubyGrad = ctx.createLinearGradient(x + 1, y + 1, x + cellSize - 1, y + cellSize - 1);
            rubyGrad.addColorStop(0, '#991b1b');
            rubyGrad.addColorStop(0.5, '#7f1d1d');
            rubyGrad.addColorStop(1, '#450a0a');
            ctx.fillStyle = rubyGrad;
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
            ctx.strokeStyle = 'rgba(252, 165, 165, 0.55)';
            ctx.lineWidth = 1;
            ctx.stroke();

            if (cellSize >= 13) {
              ctx.fillStyle = '#ffffff';
              const fontSize = Math.max(9, Math.round(cellSize * 0.44));
              ctx.font = `italic 900 ${fontSize}px 'Inter Black Italic', sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('3L', x + cellSize / 2, y + cellSize / 2 + 0.5);
            }
          } else if (cellType === CELL_TYPE_DOUBLE) {
            // Radiant Emerald Forest Gradient & Glow
            const emeraldGrad = ctx.createLinearGradient(x + 1, y + 1, x + cellSize - 1, y + cellSize - 1);
            emeraldGrad.addColorStop(0, '#166534');
            emeraldGrad.addColorStop(0.5, '#14532d');
            emeraldGrad.addColorStop(1, '#052e16');
            ctx.fillStyle = emeraldGrad;
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
            ctx.strokeStyle = 'rgba(187, 247, 208, 0.55)';
            ctx.lineWidth = 1;
            ctx.stroke();

            if (cellSize >= 13) {
              ctx.fillStyle = '#ffffff';
              const fontSize = Math.max(9, Math.round(cellSize * 0.44));
              ctx.font = `italic 900 ${fontSize}px 'Inter Black Italic', sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('2L', x + cellSize / 2, y + cellSize / 2 + 0.5);
            }
          } else if (cellType === CELL_TYPE_POWER) {
            // Electric Cyan Storm Gradient & Glow
            const cyanGrad = ctx.createLinearGradient(x + 1, y + 1, x + cellSize - 1, y + cellSize - 1);
            cyanGrad.addColorStop(0, '#0369a1');
            cyanGrad.addColorStop(0.5, '#0e7490');
            cyanGrad.addColorStop(1, '#082f49');
            ctx.fillStyle = cyanGrad;
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
            ctx.strokeStyle = 'rgba(165, 243, 252, 0.7)';
            ctx.lineWidth = 1;
            ctx.stroke();

            if (cellSize >= 12) {
              ctx.fillStyle = '#e0f2fe';
              const fontSize = Math.max(10, Math.round(cellSize * 0.54));
              ctx.font = `${fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('⚡', x + cellSize / 2, y + cellSize / 2);
            }
          } else if (cellType === CELL_TYPE_CENTER) {
            // Cosmic Indigo Crown
            const starGrad = ctx.createLinearGradient(x + 1, y + 1, x + cellSize - 1, y + cellSize - 1);
            starGrad.addColorStop(0, '#312e81');
            starGrad.addColorStop(0.5, '#1e1b4b');
            starGrad.addColorStop(1, '#0f0e26');
            ctx.fillStyle = starGrad;
            drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
            ctx.fill();
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            if (cellSize >= 10) {
              if (!lowPower) {
                ctx.save();
                ctx.shadowColor = 'rgba(251, 191, 36, 0.85)';
                ctx.shadowBlur = Math.max(4, cellSize * 0.2);
              }
              ctx.fillStyle = '#fbbf24';
              const starSize = Math.max(11, Math.round(cellSize * 0.74));
              ctx.font = `${starSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('★', x + cellSize / 2, y + cellSize / 2);
              if (!lowPower) {
                ctx.restore();
              }
            }
          }
        }
      }
    }

    // 2. Stroke the collected grid lines, one batched path per alpha bucket.
    ctx.strokeStyle = 'rgba(245, 190, 72, 0.24)';
    ctx.lineWidth = 1;
    for (let b = 0; b < NUM_GRID_BUCKETS; b++) {
      const segments = gridBuckets[b];
      if (segments.length === 0) continue;
      ctx.globalAlpha = (b + 0.5) / NUM_GRID_BUCKETS;
      ctx.beginPath();
      for (let i = 0; i < segments.length; i += 4) {
        ctx.moveTo(segments[i], segments[i + 1]);
        ctx.lineTo(segments[i + 2], segments[i + 3]);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
