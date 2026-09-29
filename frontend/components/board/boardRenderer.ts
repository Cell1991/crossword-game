import { BoardCell, CellPosition, PlacedTile } from '@/lib/types';
import {
  BOARD_COLS,
  BOARD_ROWS,
  CENTER_COL,
  CENTER_ROW,
  cellMultiplier,
  isDoubleLetterCell,
  isPowerCell,
  isTripleLetterCell,
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
  /** A DESTROY/FREEZE card's target tile, picked but not yet confirmed. */
  pendingArmedCell: CellPosition | null;
  /** Skip glows and twinkling on weaker devices. */
  lowPower: boolean;
  tilePalette: TilePalette;
}

const LOW_POWER_GRID_ALPHA_BUCKETS = 24;

/** Smooth Superellipse with filled corners, 2 extra vertical fade rows, and 8-block lookahead */
export function getCellAlpha(row: number, col: number, occupiedTiles: CellPosition[] = []): number {
  // 1. Superellipse norm (p = 2.6): extended 2 rows vertically (dy / 11.6) for graceful top/bottom fade
  const p = 2.6;
  const dx = Math.abs(col - CENTER_COL) / 14.6;
  const dy = Math.abs(row - CENTER_ROW) / 11.6;
  const superellipseNorm = Math.pow(Math.pow(dx, p) + Math.pow(dy, p), 1 / p);

  let alpha = 0;
  if (superellipseNorm <= 0.88) {
    alpha = 1.0;
  } else if (superellipseNorm <= 1.24) {
    // Smooth ease-out fade in an oval ring around the board
    const t = (superellipseNorm - 0.88) / (1.24 - 0.88);
    alpha = Math.pow(1 - t, 1.5);
  }

  // 2. 8-Block lookahead aura around any placed tiles (committed, staged, or extended words)
  for (let i = 0; i < occupiedTiles.length; i++) {
    const t = occupiedTiles[i];
    const tileDist = Math.hypot(row - t.row, (col - t.col) * 0.85);
    if (tileDist <= 1.2) {
      alpha = Math.max(alpha, 1.0);
    } else if (tileDist <= 8.2) {
      const u = (tileDist - 1.2) / 7.0;
      const tileAlpha = Math.pow(1 - u, 1.4);
      if (tileAlpha > alpha) alpha = tileAlpha;
    }
  }

  return Math.max(0, Math.min(1, alpha));
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
  isRemote = false,
  isFrozen = false
) {
  const { offset, cellSize, temporaryTilesValid, lowPower } = scene;
  const x = offset.x + col * cellSize;
  const y = offset.y + row * cellSize;
  const pad = Math.max(1, cellSize * 0.06);
  const tileW = cellSize - pad * 2;
  const radius = Math.max(2, cellSize * 0.12);

  // Keep placement status on the outline; the tile face itself stays consistent.
  const isGolden = !isRemote && !isFrozen && (!isTemporary || temporaryTilesValid === true);
  const isCorrectPlacement = !isRemote && isTemporary && temporaryTilesValid === true;

  // 1. Shadow layer & Outer Aura
  const shadowFill = isFrozen
    ? 'rgba(4, 28, 56, 0.75)'
    : isRemote
    ? TILE_THEME.remoteFace.shadow
    : TILE_THEME.face.shadow;

  if (!lowPower || isCorrectPlacement || isFrozen) {
    ctx.save();
    ctx.shadowColor = isCorrectPlacement
      ? 'rgba(52, 211, 153, 0.9)'
      : isFrozen
      ? 'rgba(6, 182, 212, 0.95)'
      : shadowFill;
    ctx.shadowBlur = isCorrectPlacement
      ? Math.max(8, cellSize * 0.22)
      : isFrozen
      ? Math.max(10, cellSize * 0.28)
      : Math.max(4, cellSize * 0.1);
  }
  ctx.fillStyle = shadowFill;
  drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
  ctx.fill();
  if (!lowPower || isCorrectPlacement || isFrozen) ctx.restore();

  // 2. Tile face fill
  if (isFrozen) {
    // 3D Ice Cube Face Gradient
    const iceGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
    iceGrad.addColorStop(0, '#7dd3fc');    // Light frost cyan top
    iceGrad.addColorStop(0.25, '#38bdf8'); // Vivid azure crystal
    iceGrad.addColorStop(0.68, '#0284c7'); // Deep glacial blue
    iceGrad.addColorStop(1, '#075985');    // Arctic bottom base
    ctx.fillStyle = iceGrad;
  } else if (isRemote) {
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

  // 3. 3D Ice Cube Inner Depth, Specular Sheen & Chiseled Facets
  if (isFrozen) {
    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.clip();

    // Diagonal glassy light glare across the top-left quadrant
    const sheenGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad + tileW * 0.75, y + pad + tileW * 0.75);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    sheenGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
    sheenGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(x + pad, y + pad, tileW, tileW);

    // Inner 3D ice depth rim
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = Math.max(1, cellSize * 0.025);
    drawRoundedRect(ctx, x + pad + 1, y + pad + 1, tileW - 2, tileW - 2, Math.max(1, radius - 1));
    ctx.stroke();

    // Delicate frozen frost crystal sparkle in top-left corner
    if (cellSize >= 16) {
      ctx.fillStyle = '#ffffff';
      if (!lowPower) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 4;
      }
      const starX = x + pad + tileW * 0.2;
      const starY = y + pad + tileW * 0.2;
      const sr = Math.max(1.5, cellSize * 0.035);
      ctx.beginPath();
      ctx.moveTo(starX, starY - sr * 1.6);
      ctx.lineTo(starX + sr * 0.4, starY - sr * 0.4);
      ctx.lineTo(starX + sr * 1.6, starY);
      ctx.lineTo(starX + sr * 0.4, starY + sr * 0.4);
      ctx.lineTo(starX, starY + sr * 1.6);
      ctx.lineTo(starX - sr * 0.4, starY + sr * 0.4);
      ctx.lineTo(starX - sr * 1.6, starY);
      ctx.lineTo(starX - sr * 0.4, starY - sr * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Stroke
  if (isFrozen) {
    ctx.save();
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = lowPower ? 0 : Math.max(4, cellSize * 0.1);
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = Math.max(1.8, cellSize * 0.045);
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.stroke();
    ctx.restore();
  } else if (isRemote) {
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
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.stroke();
    ctx.restore();
  } else if (isGolden) {
    ctx.strokeStyle = isTemporary ? '#f5d98a' : 'rgba(226, 184, 93, 0.9)';
    ctx.lineWidth = isTemporary ? 1.8 : 1.3;
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.stroke();
  }

  const multiplier = (!isRemote && (isGolden || isFrozen))
    ? cellMultiplier(row, col)
    : 1;
  const effectiveValue = value * multiplier;

  // 5. Letter & Score Rendering (Always 100% Bold and Crystal Clear)
  if (showLetter && cellSize >= 12) {
    ctx.save();
    if (isBlankLetter(letter)) {
      // Draw centered glowing wildcard star
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const starSize = Math.max(6, cellSize * 0.28);
      ctx.shadowColor = isFrozen ? '#38bdf8' : scene.tilePalette.blank.glow;
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
      ctx.font = `italic 900 ${fontSize}px 'Inter Black Italic', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textX = x + cellSize / 2;
      const textY = y + cellSize / 2 + fontSize * 0.04;
      
      if (!isRemote) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1.8, fontSize * 0.09);
        ctx.strokeStyle = isFrozen ? '#020617' : scene.tilePalette.letter.stroke;
        ctx.strokeText(letter, textX, textY);
      }
      ctx.shadowColor = isRemote ? 'transparent' : isFrozen ? 'rgba(0, 0, 0, 0.95)' : scene.tilePalette.letter.shadow;
      ctx.shadowBlur = isRemote ? 0 : isFrozen ? Math.max(3, cellSize * 0.06) : Math.max(2, cellSize * 0.06);
      ctx.shadowOffsetY = isRemote ? 0 : Math.max(1, cellSize * 0.035);
      ctx.fillText(letter, textX, textY);
    }
    ctx.restore();

    if (cellSize >= 20) {
      const numFontSize = Math.max(9, Math.round(cellSize * 0.28));
      ctx.font = `italic 900 ${numFontSize}px 'Inter Black Italic', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const numX = x + cellSize - pad * 1.5;
      const numY = y + cellSize - pad * 1.5;

      ctx.save();
      ctx.shadowColor = isFrozen ? 'rgba(250, 204, 21, 0.9)' : scene.tilePalette.score.glow;
      ctx.shadowBlur = lowPower ? 2 : Math.max(4, numFontSize * 0.6);
      ctx.lineWidth = Math.max(0.6, numFontSize * 0.06);
      ctx.strokeStyle = isFrozen ? '#020617' : scene.tilePalette.score.stroke;
      ctx.strokeText(`${effectiveValue}`, numX, numY);
      ctx.fillStyle = scene.tilePalette.score.color;
      ctx.fillText(`${effectiveValue}`, numX, numY);
      ctx.restore();
    }
  }

  // 6. Frost Mist & Freezing Cold Vapor (หมอกน้ำแข็งพาดผ่านหน้าเบี้ย)
  if (isFrozen) {
    ctx.save();

    // Ambient cold vapor billowing around the tile perimeter
    if (!lowPower) {
      const outerMist = ctx.createRadialGradient(
        x + cellSize / 2, y + cellSize / 2, tileW * 0.4,
        x + cellSize / 2, y + cellSize / 2, tileW * 0.75
      );
      outerMist.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      outerMist.addColorStop(0.5, 'rgba(186, 230, 253, 0.18)');
      outerMist.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = outerMist;
      ctx.beginPath();
      ctx.arc(x + cellSize / 2, y + cellSize / 2, tileW * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    // Clip to the tile rounded bounds for the internal swirling frost fog
    ctx.beginPath();
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.clip();

    // Mist Cloud 1: Bottom-left rolling cold fog
    const mist1 = ctx.createRadialGradient(
      x + pad + tileW * 0.25, y + pad + tileW * 0.8, 0,
      x + pad + tileW * 0.25, y + pad + tileW * 0.8, tileW * 0.55
    );
    mist1.addColorStop(0, 'rgba(240, 249, 255, 0.52)');
    mist1.addColorStop(0.45, 'rgba(186, 230, 253, 0.32)');
    mist1.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = mist1;
    ctx.beginPath();
    ctx.arc(x + pad + tileW * 0.25, y + pad + tileW * 0.8, tileW * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Mist Cloud 2: Top-right drifting frost vapor
    const mist2 = ctx.createRadialGradient(
      x + pad + tileW * 0.78, y + pad + tileW * 0.25, 0,
      x + pad + tileW * 0.78, y + pad + tileW * 0.25, tileW * 0.5
    );
    mist2.addColorStop(0, 'rgba(240, 249, 255, 0.45)');
    mist2.addColorStop(0.5, 'rgba(125, 211, 252, 0.25)');
    mist2.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = mist2;
    ctx.beginPath();
    ctx.arc(x + pad + tileW * 0.78, y + pad + tileW * 0.25, tileW * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Wispy curved mist streak billowing diagonally across the tile
    ctx.beginPath();
    ctx.moveTo(x + pad, y + pad + tileW * 0.55);
    ctx.bezierCurveTo(
      x + pad + tileW * 0.3, y + pad + tileW * 0.4,
      x + pad + tileW * 0.6, y + pad + tileW * 0.65,
      x + pad + tileW, y + pad + tileW * 0.45
    );
    ctx.bezierCurveTo(
      x + pad + tileW * 0.7, y + pad + tileW * 0.75,
      x + pad + tileW * 0.35, y + pad + tileW * 0.6,
      x + pad, y + pad + tileW * 0.72
    );
    ctx.closePath();
    ctx.fillStyle = 'rgba(224, 242, 254, 0.30)';
    ctx.fill();

    // Tiny frost specks / ice dust in the mist
    if (cellSize >= 16) {
      const drawSpeck = (sx: number, sy: number, sr: number, alpha: number) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      };
      drawSpeck(x + pad + tileW * 0.3, y + pad + tileW * 0.72, Math.max(0.8, cellSize * 0.018), 0.85);
      drawSpeck(x + pad + tileW * 0.48, y + pad + tileW * 0.65, Math.max(0.7, cellSize * 0.015), 0.75);
      drawSpeck(x + pad + tileW * 0.72, y + pad + tileW * 0.35, Math.max(0.9, cellSize * 0.02), 0.8);
      drawSpeck(x + pad + tileW * 0.82, y + pad + tileW * 0.5, Math.max(0.6, cellSize * 0.014), 0.65);
    }

    ctx.restore();
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
  occupiedTiles: CellPosition[]
) {
  const { offset, cellSize, lowPower } = scene;
  const numBuckets = 24;
  const gridPaths: Path2D[] = Array.from({ length: numBuckets }, () => new Path2D());
  const gridPathCounts = new Uint16Array(numBuckets);

  ctx.save();
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      const lineAlpha = getCellAlpha(r, c, occupiedTiles);
      if (lineAlpha <= 0.005) continue;

      const x = offset.x + c * cellSize;
      const y = offset.y + r * cellSize;

      // Special cell fills and Center Star (100% mirrored)
      const isCenter = r === CENTER_ROW && c === CENTER_COL;
      const isTriple = isTripleLetterCell(r, c);
      const isDouble = isDoubleLetterCell(r, c);
      const isPower = isPowerCell(r, c);
      const specialRadius = Math.max(3, cellSize * 0.12);

      if (isTriple || isDouble || isPower || isCenter) {
        ctx.globalAlpha = lineAlpha;
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

      // Batch grid strokes by opacity bucket
      const bucket = Math.min(
        numBuckets - 1,
        Math.floor(lineAlpha * numBuckets)
      );
      const path = gridPaths[bucket];
      path.moveTo(x, y);
      path.lineTo(x + cellSize, y);
      path.moveTo(x, y);
      path.lineTo(x, y + cellSize);
      gridPathCounts[bucket]++;
    }
  }

  // Single batched stroke per alpha bucket
  ctx.strokeStyle = 'rgba(245, 190, 72, 0.24)';
  ctx.lineWidth = 1;
  for (let bucket = 0; bucket < numBuckets; bucket++) {
    if (gridPathCounts[bucket] === 0) continue;
    ctx.globalAlpha = (bucket + 0.5) / numBuckets;
    ctx.stroke(gridPaths[bucket]);
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

  const occupiedTiles = [
    ...Object.values(scene.boardState),
    ...scene.temporaryTiles,
    ...scene.remotePlacements,
  ];

  // Calculate active envelope bounds
  let activeMinRow = 0;
  let activeMaxRow = BOARD_ROWS - 1;
  let activeMinCol = 0;
  let activeMaxCol = BOARD_COLS - 1;
  for (let i = 0; i < occupiedTiles.length; i++) {
    const t = occupiedTiles[i];
    if (t.row < activeMinRow) activeMinRow = t.row;
    if (t.row > activeMaxRow) activeMaxRow = t.row;
    if (t.col < activeMinCol) activeMinCol = t.col;
    if (t.col > activeMaxCol) activeMaxCol = t.col;
  }

  // Tightly bounded to viewport intersection with active area + 3 margin cells
  const viewportMinCol = Math.floor(-offset.x / cellSize) - 1;
  const viewportMaxCol = Math.ceil((width - offset.x) / cellSize) + 1;
  const viewportMinRow = Math.floor(-offset.y / cellSize) - 1;
  const viewportMaxRow = Math.ceil((height - offset.y) / cellSize) + 1;

  const minCol = Math.max(viewportMinCol, activeMinCol - 8);
  const maxCol = Math.min(viewportMaxCol, activeMaxCol + 8);
  const minRow = Math.max(viewportMinRow, activeMinRow - 8);
  const maxRow = Math.min(viewportMaxRow, activeMaxRow + 8);

  const visible = (cell: CellPosition) => (
    cell.row >= viewportMinRow && cell.row <= viewportMaxRow && cell.col >= viewportMinCol && cell.col <= viewportMaxCol
  );

  if (minCol <= maxCol && minRow <= maxRow) {
    drawGrid(ctx, scene, { minRow, maxRow, minCol, maxCol }, occupiedTiles);
  }

  // Draw Committed Tiles
  for (const key in scene.boardState) {
    const cell = scene.boardState[key];
    if (visible(cell)) {
      const isFrozen = scene.frozenTile?.row === cell.row && scene.frozenTile?.col === cell.col;
      drawTile(ctx, scene, cell.row, cell.col, cell.letter, cell.value, false, true, false, isFrozen);
    }
  }

  // Hint overlays
  const { hintCell } = scene;
  if (hintCell && visible(hintCell)) {
    const x = offset.x + hintCell.col * cellSize;
    const y = offset.y + hintCell.row * cellSize;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
    ctx.setLineDash([]);
  }

  const { pendingArmedCell } = scene;
  if (pendingArmedCell && visible(pendingArmedCell)) {
    const x = offset.x + pendingArmedCell.col * cellSize;
    const y = offset.y + pendingArmedCell.row * cellSize;
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.fillRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
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
