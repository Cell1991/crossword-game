import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import {
  BOARD_COLS,
  BOARD_ROWS,
  CENTER_COL,
  CENTER_ROW,
  DOUBLE_LETTER,
  SECRET_POWER,
  TRIPLE_LETTER,
} from '@/lib/board';
import { getConstellationData } from '@/lib/constellations';
import { cellKey, isBlankLetter } from '@/lib/tiles';

/**
 * Canvas drawing for the board. Everything here is a pure function of the scene passed in, so
 * the React component only decides *when* to draw, never *what*.
 */
export interface BoardScene {
  /** Canvas size in CSS pixels. */
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
  /** Skip glows and twinkling on weaker devices. */
  lowPower: boolean;
  /** Seconds, drives the constellation twinkle. */
  time: number;
}

/** Extended grid lines reach this many cells past the playable board before fading out. */
const EXTEND_MARGIN_COLS = 16;
const EXTEND_MARGIN_ROWS = 12;

/** 1 across the playable 27×19 board, fading smoothly to 0 for the extended grid beyond it. */
export function getCellAlpha(row: number, col: number): number {
  const dx = (col - CENTER_COL) / 13.0;
  const dy = (row - CENTER_ROW) / 9.0;
  const norm = Math.hypot(dx, dy); // 0 at center (9,13), 1.0 at 27x19 board edge midpoints

  // Playable 27x19 board area is 100% solid visible
  if (norm <= 0.95) return 1.0;

  // Extended grid lines beyond 27x19 fade out smoothly into space
  const t = (norm - 0.95) / 1.15;
  return Math.max(0, Math.min(1, 1 - Math.pow(Math.max(0, t), 1.4)));
}

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

function drawStarburst(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number
) {
  const points = 8;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  scene: BoardScene,
  row: number,
  col: number,
  letter: string,
  value: number,
  isTemporary: boolean,
  showLetter = true,
  isRemote = false
) {
  const { offset, cellSize, temporaryTilesValid, lowPower } = scene;
  const x = offset.x + col * cellSize;
  const y = offset.y + row * cellSize;
  const pad = Math.max(1, cellSize * 0.06);
  const tileW = cellSize - pad * 2;
  const radius = Math.max(2, cellSize * 0.12);

  // Is this tile in a golden state? (Both confirmed/committed tiles AND valid temporary tiles)
  const isGolden = !isRemote && (!isTemporary || temporaryTilesValid === true);

  // Shadow layer
  const shadowFill = isGolden
    ? 'rgba(120, 53, 15, 0.4)'
    : (isRemote ? 'rgba(0,0,0,0.3)' : 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = shadowFill;
  drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
  ctx.fill();

  // Tile face fill
  if (isRemote) {
    ctx.fillStyle = '#cbd5e1';
  } else if (isGolden) {
    // Confirmed on board OR Valid temporary move → Original Deep Royal Amber Gold crystal gradient
    const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
    grad.addColorStop(0, '#d97706');
    grad.addColorStop(0.45, '#854d0e');
    grad.addColorStop(1, '#3f1a04');
    ctx.fillStyle = grad;
  } else {
    // In-progress / unverified placement on board → natural navy gradient
    const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
    grad.addColorStop(0, '#23407a');
    grad.addColorStop(0.5, '#1a305e');
    grad.addColorStop(1, '#122244');
    ctx.fillStyle = grad;
  }
  drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
  ctx.fill();

  // 3D Glass Specular Highlight (Top Rim)
  if (!isRemote && cellSize >= 16) {
    ctx.save();
    const glossGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW * 0.38);
    glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = glossGrad;
    drawRoundedRect(ctx, x + pad + 1, y + pad + 1, tileW - 2, tileW * 0.38, Math.max(1.5, radius - 1));
    ctx.fill();
    ctx.restore();
  }

  // Celestial Star Constellation Background (Authentic star chart matching letter with dynamic twinkling)
  if (!isRemote && letter && cellSize >= 18) {
    ctx.save();
    const constellation = getConstellationData(letter);
    const time = lowPower ? 0 : scene.time;

    // Color scheme: warm celestial gold/champagne for gold tiles, crisp starlight cyan for blue tiles
    const lineColor = isGolden ? 'rgba(254, 240, 138, 0.26)' : 'rgba(147, 220, 252, 0.20)';
    const starGlow = isGolden ? 'rgba(251, 191, 36, 0.60)' : 'rgba(56, 189, 248, 0.55)';
    const starFill = isGolden ? '#fef3c7' : 'rgba(224, 242, 254, 0.80)';
    const burstFill = isGolden ? '#fde68a' : 'rgba(186, 230, 253, 0.85)';

    // 1. Background stardust specks with gentle shimmer
    for (let i = 0; i < constellation.dust.length; i++) {
      const speck = constellation.dust[i];
      const dx = x + pad + speck.x * tileW;
      const dy = y + pad + speck.y * tileW;
      const rad = Math.max(0.35, speck.r * (cellSize / 40));
      const shimmer = 0.5 + 0.5 * Math.sin(time * 2.2 + speck.x * 7 + i * 1.7);
      ctx.fillStyle = starFill;
      ctx.globalAlpha = speck.opacity * 0.45 * (0.6 + 0.4 * shimmer);
      ctx.beginPath();
      ctx.arc(dx, dy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 2. Faint Starlight Constellation Lines (thin, solid, subtle breath)
    const linePulse = 0.75 + 0.25 * Math.sin(time * 1.6 + row * 0.7 + col * 0.5);
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = linePulse;
    ctx.lineWidth = Math.max(0.65, cellSize * 0.015);
    for (const [i, j] of constellation.lines) {
      const s1 = constellation.stars[i];
      const s2 = constellation.stars[j];
      if (!s1 || !s2) continue;
      ctx.beginPath();
      ctx.moveTo(x + pad + s1.x * tileW, y + pad + s1.y * tileW);
      ctx.lineTo(x + pad + s2.x * tileW, y + pad + s2.y * tileW);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 3. Constellation Stars with dynamic twinkle and breathing starburst
    for (let idx = 0; idx < constellation.stars.length; idx++) {
      const star = constellation.stars[idx];
      const sx = x + pad + star.x * tileW;
      const sy = y + pad + star.y * tileW;
      const scale = star.size ?? 1.0;
      const baseRad = Math.max(0.8, (cellSize * 0.024) * scale);

      // Dynamic twinkle factor per individual star
      const twinklePhase = time * (2.0 + (idx % 3) * 0.7) + star.x * 6.28 + (idx * 1.35);
      const twinkle = 0.5 + 0.5 * Math.sin(twinklePhase);
      const curScale = 0.72 + 0.45 * twinkle;

      if (star.isStarburst && cellSize >= 20) {
        // 8-Pointed Celestial Starburst (equal scale for gold and blue)
        const outer = baseRad * 2.0 * curScale;
        const inner = baseRad * 0.8 * curScale;
        ctx.save();
        ctx.shadowColor = starGlow;
        ctx.shadowBlur = lowPower ? 0 : Math.max(2, cellSize * 0.05 * curScale);
        ctx.fillStyle = burstFill;
        ctx.globalAlpha = 0.85 * curScale;
        drawStarburst(ctx, sx, sy, outer, inner);
        ctx.fill();
        // Bright core point
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.90 * curScale;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.45, baseRad * 0.4 * curScale), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Regular Star (Round Dot + Soft Halo with twinkle)
        ctx.save();
        ctx.shadowColor = starGlow;
        ctx.shadowBlur = lowPower ? 0 : Math.max(1.5, cellSize * 0.035 * curScale);
        ctx.fillStyle = starFill;
        ctx.globalAlpha = 0.80 * curScale;
        ctx.beginPath();
        ctx.arc(sx, sy, baseRad * curScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // Stroke
  if (isRemote) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
  } else if (isGolden) {
    ctx.strokeStyle = isTemporary ? 'rgba(251, 191, 36, 0.85)' : 'rgba(217, 119, 6, 0.55)';
    ctx.lineWidth = isTemporary ? 1.8 : 1.2;
  } else {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
    ctx.lineWidth = 1.5;
  }
  ctx.stroke();

  const key = cellKey(row, col);
  const multiplier = (!isRemote && isGolden)
    ? (DOUBLE_LETTER.has(key) ? 2 : TRIPLE_LETTER.has(key) ? 3 : 1)
    : 1;
  const effectiveValue = value * multiplier;

  if (showLetter && cellSize >= 12) {
    ctx.save();
    if (isBlankLetter(letter)) {
      // Draw centered glowing wildcard star
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const starSize = Math.max(6, cellSize * 0.28);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = lowPower ? 0 : Math.max(4, cellSize * 0.12);
      ctx.fillStyle = '#bae6fd';
      drawStarburst(ctx, cx, cy, starSize, starSize * 0.4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, starSize * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // White text on both navy and royal gold tiles for max clarity and texture with drop shadow
      ctx.shadowColor = isRemote ? 'transparent' : 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = lowPower ? 0 : Math.max(2, cellSize * 0.08);
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = isRemote ? '#0f172a' : '#ffffff';
      const fontSize = Math.max(12, Math.round(cellSize * 0.70));
      ctx.font = `${fontSize}px 'QuakDuck', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textX = Math.round(x + cellSize / 2);
      const textY = Math.round(y + cellSize / 2 - (cellSize >= 20 ? 1 : 0));
      ctx.fillText(letter, textX, textY);
    }
    ctx.restore();

    if (cellSize >= 20) {
      const numFontSize = Math.max(9, Math.round(cellSize * 0.28));
      ctx.font = `bold ${numFontSize}px 'Geist', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const numX = x + cellSize - pad * 1.5;
      const numY = y + cellSize - pad * 1.5;

      if (multiplier > 1) {
        // Multiplier Bonus (2L / 3L): Vibrant Glowing Badge
        ctx.save();
        const numStr = `${effectiveValue}`;
        const metrics = ctx.measureText(numStr);
        const badgeW = Math.max(numFontSize * 1.25, metrics.width + 6);
        const badgeH = numFontSize + 4;
        const badgeX = numX - badgeW + 2;
        const badgeY = numY - badgeH + 2;
        const badgeRadius = 4;

        // Outer Glow
        ctx.shadowColor = multiplier === 3 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.85)';
        ctx.shadowBlur = lowPower ? 0 : 8;
        ctx.fillStyle = multiplier === 3 ? 'rgba(220, 38, 38, 0.95)' : 'rgba(217, 119, 6, 0.95)';
        drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeRadius);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Reset shadow for crisp text
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(numStr, badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5);
        ctx.restore();
      } else {
        // Standard Score Number with clear contrast and aura
        ctx.save();
        if (isGolden) {
          // Golden Tile: Radiant Golden Amber Glow
          ctx.shadowColor = 'rgba(251, 191, 36, 0.85)';
          ctx.shadowBlur = lowPower ? 0 : 6;
          ctx.fillStyle = '#fef08a';
          ctx.fillText(`${effectiveValue}`, numX, numY);
        } else if (isRemote) {
          ctx.fillStyle = '#334155';
          ctx.fillText(`${effectiveValue}`, numX, numY);
        } else {
          // Navy Tile: Glowing Sky Cyan Neon Aura
          ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
          ctx.shadowBlur = lowPower ? 0 : 6;
          ctx.fillStyle = '#7dd3fc';
          ctx.fillText(`${effectiveValue}`, numX, numY);
        }
        ctx.restore();
      }
    }
  }
}

/**
 * The grid lines, premium cell fills and centre star for every visible cell.
 *
 * One save/restore wraps the whole pass instead of one pair per cell: a few hundred pairs cost
 * several ms a frame, and every property a cell uses (alpha, fill, stroke, line width) is set
 * explicitly before it is used, so each cell draws exactly as it would from a fresh state.
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  scene: BoardScene,
  bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
) {
  const { offset, cellSize, lowPower } = scene;
  ctx.save();
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      const x = offset.x + c * cellSize;
      const y = offset.y + r * cellSize;
      const lineAlpha = getCellAlpha(r, c);

      if (lineAlpha <= 0.005) continue;

      ctx.globalAlpha = lineAlpha;

      // Special cell fills and Center Star (only for 27x19 playable board cells)
      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
        const key = cellKey(r, c);
        const isCenter = r === CENTER_ROW && c === CENTER_COL;
        const isTriple = TRIPLE_LETTER.has(key);
        const isDouble = DOUBLE_LETTER.has(key);
        const isPower = SECRET_POWER.has(key);
        const specialRadius = Math.max(3, cellSize * 0.12);

        if (isTriple) {
          ctx.fillStyle = '#7f1d1d';
          drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
          ctx.fill();
        } else if (isDouble) {
          ctx.fillStyle = '#854d0e';
          drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
          ctx.fill();
        } else if (isPower) {
          ctx.fillStyle = '#075985';
          drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
          ctx.fill();
        }
        if (isCenter) {
          ctx.fillStyle = '#1e1b4b'; // Soft indigo center
          drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          if (cellSize >= 12) {
            ctx.save();
            ctx.shadowColor = 'rgba(251, 191, 36, 0.85)';
            ctx.shadowBlur = lowPower ? 0 : Math.max(4, cellSize * 0.2);
            ctx.fillStyle = '#fbbf24';
            const starSize = Math.max(12, Math.round(cellSize * 0.72));
            ctx.font = `${starSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', x + cellSize / 2, y + cellSize / 2);
            ctx.restore();
          }
        }
      }

      // Extended Grid lines
      ctx.strokeStyle = 'rgba(245, 190, 72, 0.24)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + cellSize, y);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + cellSize);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Draws the whole board: grid, committed tiles, overlays, staged tiles, drag preview, selection. */
export function drawBoard(ctx: CanvasRenderingContext2D, dpr: number, scene: BoardScene) {
  const { width, height, offset, cellSize } = scene;
  ctx.save();
  ctx.scale(dpr, dpr);

  // Clear background transparently to reveal background ParticleField (floating letters)
  ctx.clearRect(0, 0, width, height);

  // Viewport bounds in cell coordinates (extending grid lines far beyond 27x19 board)
  const minCol = Math.max(-EXTEND_MARGIN_COLS, Math.floor(-offset.x / cellSize));
  const maxCol = Math.min(BOARD_COLS + EXTEND_MARGIN_COLS, Math.ceil((width - offset.x) / cellSize));
  const minRow = Math.max(-EXTEND_MARGIN_ROWS, Math.floor(-offset.y / cellSize));
  const maxRow = Math.min(BOARD_ROWS + EXTEND_MARGIN_ROWS, Math.ceil((height - offset.y) / cellSize));
  const visible = (cell: CellPosition) => (
    cell.row >= minRow && cell.row <= maxRow && cell.col >= minCol && cell.col <= maxCol
  );

  drawGrid(ctx, scene, { minRow, maxRow, minCol, maxCol });

  // Draw Committed Tiles
  for (const key in scene.boardState) {
    const cell = scene.boardState[key];
    if (visible(cell)) {
      drawTile(ctx, scene, cell.row, cell.col, cell.letter, cell.value, false);
    }
  }

  // Freeze/Hint overlays
  const { frozenTile, hintCell } = scene;
  if (frozenTile && visible(frozenTile)) {
    const x = offset.x + frozenTile.col * cellSize;
    const y = offset.y + frozenTile.row * cellSize;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
    if (cellSize >= 16) {
      ctx.font = `${Math.max(10, cellSize * 0.4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❄️', x + cellSize / 2, y + cellSize * 0.24);
    }
  }
  if (hintCell && visible(hintCell)) {
    const x = offset.x + hintCell.col * cellSize;
    const y = offset.y + hintCell.row * cellSize;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
    ctx.setLineDash([]);
  }

  // Draw Temporary Placed Tiles
  for (const pt of scene.temporaryTiles) {
    if (pt.tile_id === scene.draggingTileId) continue;
    if (visible(pt)) {
      drawTile(ctx, scene, pt.row, pt.col, pt.letter, pt.value, true);
    }
  }

  const { dragPreviewCell, dragPreviewTile } = scene;
  if (dragPreviewCell && dragPreviewTile) {
    drawTile(ctx, scene, dragPreviewCell.row, dragPreviewCell.col, dragPreviewTile.letter, dragPreviewTile.value, true);
    const previewX = offset.x + dragPreviewCell.col * cellSize;
    const previewY = offset.y + dragPreviewCell.row * cellSize;
    ctx.strokeStyle = scene.dragPreviewIsValid ? '#38bdf8' : '#f87171';
    ctx.lineWidth = 3;
    ctx.strokeRect(previewX + 1, previewY + 1, cellSize - 2, cellSize - 2);
  }

  for (const placement of scene.remotePlacements) {
    if (visible(placement)) {
      drawTile(ctx, scene, placement.row, placement.col, '', 0, true, false, true);
    }
  }

  // Highlight Selected Cell
  const { selectedCell } = scene;
  if (selectedCell && visible(selectedCell)) {
    const sx = offset.x + selectedCell.col * cellSize;
    const sy = offset.y + selectedCell.row * cellSize;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sx + 1, sy + 1, cellSize - 2, cellSize - 2);
  }

  ctx.restore();
}
