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
import { cellKey, isBlankLetter } from '@/lib/tiles';
import { TILE_THEME, type TilePalette } from '@/lib/tileTheme';

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
  tilePalette: TilePalette;
}

/** Extended grid lines reach this many cells past the playable board before fading out. */
const EXTEND_MARGIN_COLS = 16;
const EXTEND_MARGIN_ROWS = 12;
const LOW_POWER_GRID_ALPHA_BUCKETS = 24;

export interface BoardVisualExpansion {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const NO_BOARD_EXPANSION: BoardVisualExpansion = { top: 0, bottom: 0, left: 0, right: 0 };

/** Let the full-opacity grid edge ease outward on sides where tiles approach the playable edge. */
export function getBoardVisualExpansion(tiles: CellPosition[]): BoardVisualExpansion {
  if (tiles.length === 0) return NO_BOARD_EXPANSION;
  const rows = tiles.map(tile => tile.row);
  const cols = tiles.map(tile => tile.col);
  const edgeGrowth = (distance: number) => distance <= 2 ? ((3 - distance) / 3) * 5 : 0;
  return {
    top: edgeGrowth(Math.min(...rows)),
    bottom: edgeGrowth(BOARD_ROWS - 1 - Math.max(...rows)),
    left: edgeGrowth(Math.min(...cols)),
    right: edgeGrowth(BOARD_COLS - 1 - Math.max(...cols)),
  };
}

/** 1 across the playable 27×19 board, fading smoothly to 0 for the extended grid beyond it. */
export function getCellAlpha(row: number, col: number, expansion = NO_BOARD_EXPANSION): number {
  const horizontalRadius = 13 + (col < CENTER_COL ? expansion.left : expansion.right);
  const verticalRadius = 9 + (row < CENTER_ROW ? expansion.top : expansion.bottom);
  const dx = (col - CENTER_COL) / horizontalRadius;
  const dy = (row - CENTER_ROW) / verticalRadius;
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

  // Keep placement status on the outline; the tile face itself stays consistent.
  const isGolden = !isRemote && (!isTemporary || temporaryTilesValid === true);
  const isCorrectPlacement = !isRemote && isTemporary && temporaryTilesValid === true;

  // Shadow layer
  const shadowFill = isRemote ? TILE_THEME.remoteFace.shadow : TILE_THEME.face.shadow;
  if (!lowPower || isCorrectPlacement) {
    ctx.save();
    ctx.shadowColor = isCorrectPlacement ? 'rgba(52, 211, 153, 0.9)' : shadowFill;
    ctx.shadowBlur = isCorrectPlacement
      ? Math.max(8, cellSize * 0.22)
      : Math.max(4, cellSize * 0.1);
  }
  ctx.fillStyle = shadowFill;
  drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
  ctx.fill();
  if (!lowPower || isCorrectPlacement) ctx.restore();

  // Tile face fill
  if (isRemote) {
    const ghostGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
    ghostGrad.addColorStop(0, TILE_THEME.remoteFace.top);
    ghostGrad.addColorStop(0.35, TILE_THEME.remoteFace.middle);
    ghostGrad.addColorStop(1, TILE_THEME.remoteFace.bottom);
    ctx.fillStyle = ghostGrad;
  } else {
    const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
    grad.addColorStop(0, TILE_THEME.face.top);
    grad.addColorStop(0.5, TILE_THEME.face.middle);
    grad.addColorStop(1, TILE_THEME.face.bottom);
    ctx.fillStyle = grad;
  }
  drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
  ctx.fill();

  // Stroke
  if (isRemote) {
    ctx.save();
    ctx.shadowColor = 'rgba(96, 165, 250, 0.28)';
    ctx.shadowBlur = lowPower ? 0 : Math.max(1, cellSize * 0.03);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.62)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
    return;
  } else if (isCorrectPlacement) {
    ctx.save();
    ctx.shadowColor = 'rgba(52, 211, 153, 0.95)';
    ctx.shadowBlur = Math.max(12, cellSize * 0.32);
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = Math.max(2.5, cellSize * 0.055);
  } else if (isGolden) {
    ctx.strokeStyle = isTemporary ? '#f5d98a' : 'rgba(226, 184, 93, 0.9)';
    ctx.lineWidth = isTemporary ? 1.8 : 1.3;
  } else {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
    ctx.lineWidth = 1.5;
  }
  drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
  ctx.stroke();
  if (isCorrectPlacement) ctx.restore();

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
      ctx.shadowColor = scene.tilePalette.blank.glow;
      ctx.shadowBlur = lowPower ? 0 : Math.max(4, cellSize * 0.12);
      ctx.fillStyle = scene.tilePalette.blank.color;
      drawStarburst(ctx, cx, cy, starSize, starSize * 0.4);
      ctx.fill();
      ctx.lineWidth = Math.max(0.5, cellSize * 0.055);
      ctx.strokeStyle = scene.tilePalette.blank.stroke;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, starSize * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const letterFill = scene.tilePalette.letter.color;
      if (isRemote) {
        const letterGrad = ctx.createLinearGradient(0, y + cellSize * 0.27, 0, y + cellSize * 0.72);
        letterGrad.addColorStop(0, '#0f172a');
        letterGrad.addColorStop(1, '#334155');
        ctx.fillStyle = letterGrad;
      } else {
        ctx.fillStyle = letterFill;
      }
      const fontSize = Math.max(12, Math.round(cellSize * 0.70));
      ctx.font = `400 ${fontSize}px 'Granix Demo', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const metrics = ctx.measureText(letter);
      const textX = x + cellSize / 2 + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2;
      const textY = y + cellSize / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      if (!isRemote) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1.6, fontSize * 0.08);
        ctx.strokeStyle = scene.tilePalette.letter.stroke;
        ctx.strokeText(letter, textX, textY);
      }
      ctx.shadowColor = isRemote ? 'transparent' : scene.tilePalette.letter.shadow;
      ctx.shadowBlur = isRemote ? 0 : Math.max(2, cellSize * 0.06);
      ctx.shadowOffsetY = isRemote ? 0 : Math.max(1, cellSize * 0.035);
      ctx.fillText(letter, textX, textY);
    }
    ctx.restore();

    if (cellSize >= 20) {
      const numFontSize = Math.max(9, Math.round(cellSize * 0.28));
      ctx.font = `${scene.tilePalette.score.weight} ${numFontSize}px 'Geist', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const numX = x + cellSize - pad * 1.5;
      const numY = y + cellSize - pad * 1.5;

      ctx.save();
      ctx.shadowColor = scene.tilePalette.score.glow;
      ctx.shadowBlur = lowPower ? 2 : Math.max(4, numFontSize * 0.6);
      ctx.lineWidth = Math.max(0.5, numFontSize * 0.05);
      ctx.strokeStyle = scene.tilePalette.score.stroke;
      ctx.fillStyle = scene.tilePalette.score.color;
      ctx.strokeText(`${effectiveValue}`, numX, numY);
      ctx.fillText(`${effectiveValue}`, numX, numY);
      ctx.restore();
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
  bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number },
  expansion: BoardVisualExpansion
) {
  const { offset, cellSize, lowPower } = scene;
  const gridPaths = lowPower
    ? Array.from({ length: LOW_POWER_GRID_ALPHA_BUCKETS }, () => new Path2D())
    : null;
  const gridPathCounts = lowPower ? new Uint16Array(LOW_POWER_GRID_ALPHA_BUCKETS) : null;
  ctx.save();
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      const x = offset.x + c * cellSize;
      const y = offset.y + r * cellSize;
      const lineAlpha = getCellAlpha(r, c, expansion);

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
          ctx.fillStyle = '#166534';
          drawRoundedRect(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, specialRadius);
          ctx.fill();
        } else if (isPower) {
          ctx.fillStyle = '#0e7490';
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

      // Batch low-power grid strokes by opacity; desktop keeps per-cell alpha unchanged.
      if (gridPaths && gridPathCounts) {
        const bucket = Math.min(
          LOW_POWER_GRID_ALPHA_BUCKETS - 1,
          Math.floor(lineAlpha * LOW_POWER_GRID_ALPHA_BUCKETS)
        );
        const path = gridPaths[bucket];
        path.moveTo(x, y);
        path.lineTo(x + cellSize, y);
        path.moveTo(x, y);
        path.lineTo(x, y + cellSize);
        gridPathCounts[bucket]++;
      } else {
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
  }
  if (gridPaths && gridPathCounts) {
    ctx.strokeStyle = 'rgba(245, 190, 72, 0.24)';
    ctx.lineWidth = 1;
    for (let bucket = 0; bucket < gridPaths.length; bucket++) {
      if (gridPathCounts[bucket] === 0) continue;
      ctx.globalAlpha = (bucket + 0.5) / LOW_POWER_GRID_ALPHA_BUCKETS;
      ctx.stroke(gridPaths[bucket]);
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

  const occupiedTiles = [
    ...Object.values(scene.boardState),
    ...scene.temporaryTiles,
    ...scene.remotePlacements,
  ];
  const expansion = getBoardVisualExpansion(occupiedTiles);
  drawGrid(ctx, scene, { minRow, maxRow, minCol, maxCol }, expansion);

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
