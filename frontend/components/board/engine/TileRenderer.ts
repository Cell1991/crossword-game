import { cellMultiplier, isDoubleLetterCell, isTripleLetterCell, isPowerCell } from '@/lib/board';
import { isBlankLetter } from '@/lib/tiles';
import { TILE_THEME, type TilePalette } from '@/lib/tileTheme';

export interface TileRenderContext {
  ctx: CanvasRenderingContext2D;
  offset: { x: number; y: number };
  cellSize: number;
  lowPower: boolean;
  tilePalette: TilePalette;
  temporaryTilesValid: boolean | null;
  animTime?: number;
  tileAnimations?: Map<string, number>;
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

function drawFrostFern(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  angle: number,
  length: number,
  curve: number,
  alpha = 0.9
) {
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const steps = 11;
  const stepLen = length / steps;
  let curX = startX;
  let curY = startY;
  let curAngle = angle;

  const stemPoints: { x: number; y: number; angle: number; progress: number }[] = [];
  stemPoints.push({ x: curX, y: curY, angle: curAngle, progress: 0 });

  // 1. Trace the curved central fern spine
  ctx.beginPath();
  ctx.moveTo(curX, curY);
  ctx.lineWidth = Math.max(0.85, length * 0.022);

  for (let i = 1; i <= steps; i++) {
    curAngle += curve / steps;
    curX += Math.cos(curAngle) * stepLen;
    curY += Math.sin(curAngle) * stepLen;
    ctx.lineTo(curX, curY);
    stemPoints.push({ x: curX, y: curY, angle: curAngle, progress: i / steps });
  }
  ctx.stroke();

  // 2. Draw lateral pinnule needles on both sides
  for (let i = 1; i < stemPoints.length; i++) {
    const pt = stemPoints[i];
    const taper = Math.sin((1 - pt.progress * 0.72) * Math.PI * 0.5);
    const branchLen = length * 0.38 * taper;

    ctx.lineWidth = Math.max(0.65, length * 0.014 * taper);

    const branchAngles = [pt.angle + 0.95, pt.angle - 0.95];

    for (const bAngle of branchAngles) {
      const bx = pt.x + Math.cos(bAngle) * branchLen;
      const by = pt.y + Math.sin(bAngle) * branchLen;

      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Sub-pinnules (fine feathered needles)
      if (branchLen > 3.5) {
        const subLen = branchLen * 0.42;
        const subAngle1 = bAngle + 0.8;
        const subAngle2 = bAngle - 0.8;
        const midX = pt.x + Math.cos(bAngle) * (branchLen * 0.5);
        const midY = pt.y + Math.sin(bAngle) * (branchLen * 0.5);

        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + Math.cos(subAngle1) * subLen, midY + Math.sin(subAngle1) * subLen);
        ctx.moveTo(midX, midY);
        ctx.lineTo(midX + Math.cos(subAngle2) * subLen, midY + Math.sin(subAngle2) * subLen);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function drawPerimeterFrostNeedles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.8;

  // Top edge needles
  for (let i = 0.12; i <= 0.88; i += 0.07) {
    const px = x + w * i;
    const py = y;
    const len = 1.2 + ((Math.sin(i * 37) + 1) * 1.6);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (Math.cos(i * 12) * 1.2), py - len);
    ctx.stroke();
  }
  // Bottom edge needles
  for (let i = 0.12; i <= 0.88; i += 0.07) {
    const px = x + w * i;
    const py = y + h;
    const len = 1.2 + ((Math.sin(i * 43) + 1) * 1.6);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (Math.cos(i * 15) * 1.2), py + len);
    ctx.stroke();
  }
  // Left edge needles
  for (let i = 0.12; i <= 0.88; i += 0.07) {
    const px = x;
    const py = y + h * i;
    const len = 1.2 + ((Math.sin(i * 29) + 1) * 1.6);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - len, py + (Math.cos(i * 18) * 1.2));
    ctx.stroke();
  }
  // Right edge needles
  for (let i = 0.12; i <= 0.88; i += 0.07) {
    const px = x + w;
    const py = y + h * i;
    const len = 1.2 + ((Math.sin(i * 51) + 1) * 1.6);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + len, py + (Math.cos(i * 21) * 1.2));
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlacialCracks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  cellSize: number
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';

  // Major Crack 1: Top-Left downward slicing fracture with branches
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = Math.max(0.75, cellSize * 0.02);
  ctx.beginPath();
  ctx.moveTo(x + tileW * 0.38, y + tileW * 0.02);
  ctx.lineTo(x + tileW * 0.34, y + tileW * 0.16);
  ctx.lineTo(x + tileW * 0.20, y + tileW * 0.32);
  ctx.lineTo(x + tileW * 0.14, y + tileW * 0.48);
  ctx.lineTo(x + tileW * 0.08, y + tileW * 0.65);
  ctx.stroke();

  // Branch 1A
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
  ctx.lineWidth = Math.max(0.55, cellSize * 0.014);
  ctx.moveTo(x + tileW * 0.34, y + tileW * 0.16);
  ctx.lineTo(x + tileW * 0.48, y + tileW * 0.22);
  ctx.lineTo(x + tileW * 0.58, y + tileW * 0.18);
  ctx.stroke();

  // Branch 1B
  ctx.beginPath();
  ctx.moveTo(x + tileW * 0.20, y + tileW * 0.32);
  ctx.lineTo(x + tileW * 0.28, y + tileW * 0.44);
  ctx.lineTo(x + tileW * 0.26, y + tileW * 0.58);
  ctx.stroke();

  // Major Crack 2: Bottom-spanning glacial fracture
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = Math.max(0.8, cellSize * 0.022);
  ctx.moveTo(x + tileW * 0.06, y + tileW * 0.80);
  ctx.lineTo(x + tileW * 0.24, y + tileW * 0.72);
  ctx.lineTo(x + tileW * 0.46, y + tileW * 0.84);
  ctx.lineTo(x + tileW * 0.70, y + tileW * 0.76);
  ctx.lineTo(x + tileW * 0.92, y + tileW * 0.86);
  ctx.stroke();

  // Branch 2A
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.8)';
  ctx.lineWidth = Math.max(0.5, cellSize * 0.012);
  ctx.moveTo(x + tileW * 0.46, y + tileW * 0.84);
  ctx.lineTo(x + tileW * 0.50, y + tileW * 0.96);
  ctx.moveTo(x + tileW * 0.70, y + tileW * 0.76);
  ctx.lineTo(x + tileW * 0.66, y + tileW * 0.64);
  ctx.stroke();

  // Major Crack 3: Top-Right / Right Edge fracture
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.lineWidth = Math.max(0.7, cellSize * 0.018);
  ctx.moveTo(x + tileW * 0.92, y + tileW * 0.18);
  ctx.lineTo(x + tileW * 0.74, y + tileW * 0.30);
  ctx.lineTo(x + tileW * 0.78, y + tileW * 0.48);
  ctx.lineTo(x + tileW * 0.88, y + tileW * 0.62);
  ctx.stroke();

  ctx.restore();
}

function drawGlacialIceBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  radius: number,
  cellSize: number
) {
  ctx.save();

  // 1. Outer Translucent Ice Encasing Bevel (Thick 3D Glass/Ice shell)
  const outerBevel = ctx.createLinearGradient(x, y, x + tileW, y + tileW);
  outerBevel.addColorStop(0, 'rgba(255, 255, 255, 0.90)');
  outerBevel.addColorStop(0.2, 'rgba(224, 242, 254, 0.55)');
  outerBevel.addColorStop(0.5, 'rgba(56, 189, 248, 0.30)');
  outerBevel.addColorStop(0.8, 'rgba(2, 132, 199, 0.48)');
  outerBevel.addColorStop(1, 'rgba(186, 230, 253, 0.85)');
  
  ctx.fillStyle = 'rgba(186, 230, 253, 0.25)';
  drawRoundedRect(ctx, x, y, tileW, tileW, radius);
  ctx.fill();

  ctx.strokeStyle = outerBevel;
  ctx.lineWidth = Math.max(2.6, cellSize * 0.068);
  drawRoundedRect(ctx, x + 0.8, y + 0.8, tileW - 1.6, tileW - 1.6, radius);
  ctx.stroke();

  // 2. Inner Deep Glacial Ice Face
  const innerMargin = Math.max(2, cellSize * 0.055);
  const innerW = tileW - innerMargin * 2;
  const innerR = Math.max(1.5, radius - 1.5);

  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, x + innerMargin, y + innerMargin, innerW, innerW, innerR);
  ctx.clip();

  // Deep Arctic Glacier Core Gradient
  const coreGrad = ctx.createLinearGradient(x + innerMargin, y + innerMargin, x + innerMargin, y + innerMargin + innerW);
  coreGrad.addColorStop(0, '#0284c7');
  coreGrad.addColorStop(0.35, '#0369a1');
  coreGrad.addColorStop(0.75, '#075985');
  coreGrad.addColorStop(1, '#082f49');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(x + innerMargin, y + innerMargin, innerW, innerW);

  // 3. Inner Electric Cyan Refractive Prismatic Rim
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = Math.max(1.2, cellSize * 0.028);
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = Math.max(4, cellSize * 0.1);
  drawRoundedRect(ctx, x + innerMargin + 0.5, y + innerMargin + 0.5, innerW - 1, innerW - 1, innerR);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 4. Intricate Frost Ferns (Flourishing from all 4 corners into the ice core)
  if (cellSize >= 14) {
    const fernScale = innerW;
    // Top-Left corner fern cluster
    drawFrostFern(ctx, x + innerMargin + 2, y + innerMargin + 2, 0.78, fernScale * 0.46, 0.15, 0.95);
    drawFrostFern(ctx, x + innerMargin + 4, y + innerMargin + 1, 0.45, fernScale * 0.32, -0.1, 0.88);
    
    // Bottom-Left corner fern cluster (large prominent feather)
    drawFrostFern(ctx, x + innerMargin + 2, y + innerMargin + innerW - 2, -0.82, fernScale * 0.50, -0.2, 0.98);
    drawFrostFern(ctx, x + innerMargin + 6, y + innerMargin + innerW - 1, -0.52, fernScale * 0.36, 0.1, 0.90);

    // Top-Right corner fern cluster
    drawFrostFern(ctx, x + innerMargin + innerW - 2, y + innerMargin + 2, 2.35, fernScale * 0.42, -0.15, 0.92);

    // Bottom-Right corner fern cluster
    drawFrostFern(ctx, x + innerMargin + innerW - 2, y + innerMargin + innerW - 4, -2.4, fernScale * 0.38, 0.12, 0.88);

    // Side edge micro-tufts
    drawFrostFern(ctx, x + innerMargin + 1, y + innerMargin + innerW * 0.45, 0.2, fernScale * 0.28, 0.05, 0.82);
    drawFrostFern(ctx, x + innerMargin + innerW - 1, y + innerMargin + innerW * 0.52, 3.0, fernScale * 0.28, -0.05, 0.82);
  }

  // 5. Razor-sharp Glacial Fracture Cracks
  if (cellSize >= 12) {
    drawGlacialCracks(ctx, x + innerMargin, y + innerMargin, innerW, cellSize);
  }

  // 6. Top-Diagonal Glassy Specular Ice Sheet
  const iceGlassGrad = ctx.createLinearGradient(x + innerMargin, y + innerMargin, x + innerMargin + innerW * 0.8, y + innerMargin + innerW * 0.8);
  iceGlassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.68)');
  iceGlassGrad.addColorStop(0.25, 'rgba(224, 242, 254, 0.25)');
  iceGlassGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = iceGlassGrad;
  ctx.fillRect(x + innerMargin, y + innerMargin, innerW, innerW);

  // Bottom frosted condensation
  const botFrostedGrad = ctx.createLinearGradient(0, y + innerMargin + innerW * 0.75, 0, y + innerMargin + innerW);
  botFrostedGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  botFrostedGrad.addColorStop(1, 'rgba(224, 242, 254, 0.28)');
  ctx.fillStyle = botFrostedGrad;
  ctx.fillRect(x + innerMargin, y + innerMargin + innerW * 0.75, innerW, innerW * 0.25);

  ctx.restore();

  // 7. Outer Perimeter Frost Needles (protruding outward around the ice block)
  drawPerimeterFrostNeedles(ctx, x, y, tileW, tileW, radius);

  ctx.restore();
}



export class TileRenderer {
  public static renderTile(
    context: TileRenderContext,
    row: number,
    col: number,
    letter: string,
    value: number,
    isTemporary: boolean,
    showLetter = true,
    isRemote = false,
    isFrozen = false,
    isLastMove = false
  ): void {
    const { ctx, offset, cellSize, lowPower, tilePalette, temporaryTilesValid, animTime, tileAnimations } = context;
    const x = offset.x + col * cellSize;
    const y = offset.y + row * cellSize;
    const pad = Math.max(1, cellSize * 0.06);
    const tileW = cellSize - pad * 2;
    const radius = Math.max(2, cellSize * 0.12);

    // Animation physics (spring drop & bounce when placed, or gemstone morph on confirm)
    const animStart = tileAnimations?.get(`${row}_${col}`);
    let scale = 1.0;
    let bounceY = 0;
    let animProgress = 1.0;
    let morphProgress = 1.0;

    const isConfirmed = !isTemporary && !isRemote;
    const is2L = isConfirmed && isDoubleLetterCell(row, col);
    const is3L = isConfirmed && isTripleLetterCell(row, col);
    const isPower = isConfirmed && isPowerCell(row, col);
    const isSpecialCellTile = is2L || is3L || isPower;

    if (animStart && animTime) {
      const elapsed = animTime - animStart;
      if (isSpecialCellTile || isFrozen) {
        if (elapsed >= 0 && elapsed < 650) {
          morphProgress = elapsed / 650;
          // Juicy elastic jewel bounce & pulse
          scale = 1.0 + 0.18 * Math.sin(morphProgress * Math.PI) * Math.exp(-morphProgress * 2.5);
        }
      } else if (elapsed >= 0 && elapsed < 320) {
        animProgress = elapsed / 320;
        // Elastic spring formula: starts elevated and slightly larger, lands with a micro-bounce
        scale = 1.0 + 0.26 * Math.exp(-animProgress * 5) * Math.cos(animProgress * 10);
        bounceY = -Math.max(0, 1 - animProgress) * cellSize * 0.16;
      }
    }

    const isGolden = !isRemote && !isFrozen && !isSpecialCellTile;
    const isCorrectPlacement = !isRemote && isTemporary && temporaryTilesValid === true;
    const isInvalidPlacement = !isRemote && isTemporary && temporaryTilesValid === false;
    const isPendingPlacement = !isRemote && isTemporary && (temporaryTilesValid === null || temporaryTilesValid === undefined);
    const isPlacedTile = !isRemote && isTemporary;

    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;
    const hasTransform = scale !== 1.0 || bounceY !== 0;
    if (hasTransform) {
      ctx.save();
      ctx.translate(cx, cy + bounceY);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }

    // 1. Shadow layer & Outer Aura
    if (isFrozen) {
      // Atmospheric Sub-Zero Cold Mist Aura
      ctx.save();
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;
      const mistOuter = ctx.createRadialGradient(cx, cy, tileW * 0.25, cx, cy, cellSize * 0.8);
      mistOuter.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      mistOuter.addColorStop(0.45, 'rgba(14, 165, 233, 0.22)');
      mistOuter.addColorStop(0.75, 'rgba(186, 230, 253, 0.1)');
      mistOuter.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = mistOuter;
      ctx.beginPath();
      ctx.arc(cx, cy, cellSize * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Cold glacial shadow
      if (!lowPower) {
        ctx.shadowColor = 'rgba(56, 189, 248, 0.95)';
        ctx.shadowBlur = Math.max(12, cellSize * 0.32);
      }
      ctx.fillStyle = 'rgba(4, 28, 56, 0.8)';
      drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
      ctx.fill();
      ctx.restore();
    } else {
      const shadowFill = isRemote
        ? 'rgba(6, 182, 212, 0.5)'
        : is2L
        ? 'rgba(4, 30, 15, 0.7)'
        : is3L
        ? 'rgba(45, 6, 15, 0.7)'
        : isPower
        ? 'rgba(4, 24, 48, 0.7)'
        : TILE_THEME.face.shadow;

      if (!lowPower) {
        ctx.save();
        if (isCorrectPlacement) {
          ctx.shadowColor = 'rgba(34, 197, 94, 0.85)';
          ctx.shadowBlur = Math.max(14, cellSize * 0.32);
        } else if (isInvalidPlacement) {
          ctx.shadowColor = 'rgba(244, 63, 94, 0.85)';
          ctx.shadowBlur = Math.max(14, cellSize * 0.32);
        } else if (isPendingPlacement) {
          ctx.shadowColor = 'rgba(14, 165, 233, 0.8)';
          ctx.shadowBlur = Math.max(12, cellSize * 0.28);
        } else if (isLastMove) {
          ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
          ctx.shadowBlur = Math.max(10, cellSize * 0.24);
        } else if (isRemote) {
          ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
          ctx.shadowBlur = Math.max(8, cellSize * 0.2);
        } else if (is2L) {
          ctx.shadowColor = 'rgba(34, 197, 94, 0.65)';
          ctx.shadowBlur = Math.max(8, cellSize * 0.2);
        } else if (is3L) {
          ctx.shadowColor = 'rgba(244, 63, 94, 0.65)';
          ctx.shadowBlur = Math.max(8, cellSize * 0.2);
        } else if (isPower) {
          ctx.shadowColor = 'rgba(14, 165, 233, 0.7)';
          ctx.shadowBlur = Math.max(8, cellSize * 0.2);
        } else {
          ctx.shadowColor = shadowFill;
          ctx.shadowBlur = Math.max(4, cellSize * 0.1);
        }
      }
      ctx.fillStyle = shadowFill;
      drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
      ctx.fill();
      if (!lowPower) ctx.restore();

      // Atmospheric outer aura on the board under the tile
      if (!lowPower && (isPlacedTile || isLastMove)) {
        ctx.save();
        if (isCorrectPlacement) {
          ctx.shadowColor = 'rgba(34, 197, 94, 0.9)';
          ctx.shadowBlur = Math.max(12, cellSize * 0.28);
          ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
        } else if (isInvalidPlacement) {
          ctx.shadowColor = 'rgba(244, 63, 94, 0.9)';
          ctx.shadowBlur = Math.max(12, cellSize * 0.28);
          ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        } else if (isPendingPlacement) {
          ctx.shadowColor = 'rgba(14, 165, 233, 0.85)';
          ctx.shadowBlur = Math.max(10, cellSize * 0.24);
          ctx.fillStyle = 'rgba(14, 165, 233, 0.3)';
        } else if (isLastMove) {
          ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
          ctx.shadowBlur = Math.max(9, cellSize * 0.22);
          ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
        }
        drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. Tile face fill
    if (isFrozen) {
      // 3D Glacial Ice Block Encasing (matching realistic reference)
      drawGlacialIceBlock(ctx, x + pad, y + pad, tileW, radius, cellSize);
    } else if (isRemote) {
      const ghostGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      ghostGrad.addColorStop(0, '#0284c7');
      ghostGrad.addColorStop(0.3, '#0369a1');
      ghostGrad.addColorStop(0.7, '#075985');
      ghostGrad.addColorStop(1, '#082f49');
      ctx.fillStyle = ghostGrad;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.fill();
    } else if (is2L) {
      // 2L Emerald Green Gemstone Face Gradient
      const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      grad.addColorStop(0, '#4ade80');
      grad.addColorStop(0.25, '#22c55e');
      grad.addColorStop(0.60, '#16a34a');
      grad.addColorStop(0.85, '#15803d');
      grad.addColorStop(1, '#064e3b');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.fill();
    } else if (is3L) {
      // 3L Ruby Crimson Gemstone Face Gradient
      const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      grad.addColorStop(0, '#fb7185');
      grad.addColorStop(0.25, '#f43f5e');
      grad.addColorStop(0.60, '#e11d48');
      grad.addColorStop(0.85, '#be123c');
      grad.addColorStop(1, '#881337');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.fill();
    } else if (isPower) {
      // Lightning Electric Cyan Power Gemstone Face Gradient
      const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.25, '#0ea5e9');
      grad.addColorStop(0.60, '#0284c7');
      grad.addColorStop(0.85, '#0369a1');
      grad.addColorStop(1, '#082f49');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.fill();
    } else {
      // Standard Golden Amber Resin Face Gradient
      const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      grad.addColorStop(0, '#fbbf24');
      grad.addColorStop(0.28, '#f59e0b');
      grad.addColorStop(0.65, '#d97706');
      grad.addColorStop(0.88, '#b45309');
      grad.addColorStop(1, '#78350f');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.fill();
    }

    // 3. Specular Sheen, Chiseled Facets & Holographic Glyphs
    if (isRemote) {
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.clip();

      // Top-diagonal specular glass highlight
      const sheenGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad + tileW * 0.75, y + pad + tileW * 0.75);
      sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      sheenGrad.addColorStop(0.25, 'rgba(56, 189, 248, 0.25)');
      sheenGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(x + pad, y + pad, tileW, tileW);

      // Center Holographic Energy Rune Star
      if (cellSize >= 14) {
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;
        const hr = Math.max(2, cellSize * 0.16);
        if (!lowPower) {
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 6;
        }
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(cx, cy - hr * 1.5);
        ctx.lineTo(cx + hr * 0.35, cy - hr * 0.35);
        ctx.lineTo(cx + hr * 1.5, cy);
        ctx.lineTo(cx + hr * 0.35, cy + hr * 0.35);
        ctx.lineTo(cx, cy + hr * 1.5);
        ctx.lineTo(cx - hr * 0.35, cy + hr * 0.35);
        ctx.lineTo(cx - hr * 1.5, cy);
        ctx.lineTo(cx - hr * 0.35, cy - hr * 0.35);
        ctx.closePath();
        ctx.fill();

        // Subtle inner glowing neon rim
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, x + pad + 1.5, y + pad + 1.5, tileW - 3, tileW - 3, Math.max(1, radius - 1));
        ctx.stroke();
      }
      ctx.restore();
    } else if (!isFrozen && !isRemote) {
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.clip();

      // Top edge crisp subtle warm luster line (does not wash out the body)
      const topEdgeGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + Math.max(2, cellSize * 0.08));
      if (is2L) {
        topEdgeGrad.addColorStop(0, 'rgba(220, 255, 230, 0.7)');
        topEdgeGrad.addColorStop(1, 'rgba(220, 255, 230, 0)');
      } else if (is3L) {
        topEdgeGrad.addColorStop(0, 'rgba(255, 225, 230, 0.75)');
        topEdgeGrad.addColorStop(1, 'rgba(225, 225, 230, 0)');
      } else if (isPower) {
        topEdgeGrad.addColorStop(0, 'rgba(224, 242, 254, 0.8)');
        topEdgeGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
      } else {
        topEdgeGrad.addColorStop(0, 'rgba(255, 245, 180, 0.65)');
        topEdgeGrad.addColorStop(1, 'rgba(255, 245, 180, 0)');
      }
      ctx.fillStyle = topEdgeGrad;
      ctx.fillRect(x + pad, y + pad, tileW, Math.max(2, cellSize * 0.08));

      // Bottom subtle chiseled bevel shadow
      const botShade = ctx.createLinearGradient(0, y + pad + tileW * 0.78, 0, y + pad + tileW);
      if (is2L) {
        botShade.addColorStop(0, 'rgba(3, 30, 15, 0)');
        botShade.addColorStop(1, 'rgba(3, 30, 15, 0.6)');
      } else if (is3L) {
        botShade.addColorStop(0, 'rgba(50, 5, 15, 0)');
        botShade.addColorStop(1, 'rgba(50, 5, 15, 0.65)');
      } else if (isPower) {
        botShade.addColorStop(0, 'rgba(3, 20, 45, 0)');
        botShade.addColorStop(1, 'rgba(3, 20, 45, 0.65)');
      } else {
        botShade.addColorStop(0, 'rgba(60, 20, 0, 0)');
        botShade.addColorStop(1, 'rgba(60, 20, 0, 0.55)');
      }
      ctx.fillStyle = botShade;
      ctx.fillRect(x + pad, y + pad + tileW * 0.78, tileW, tileW * 0.22);

      // Inner crisp glowing rim
      if (is2L) {
        ctx.strokeStyle = 'rgba(187, 247, 208, 0.45)';
      } else if (is3L) {
        ctx.strokeStyle = 'rgba(254, 205, 211, 0.45)';
      } else if (isPower) {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
      } else {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      }
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x + pad + 0.5, y + pad + 0.5, tileW - 1, tileW - 1, Math.max(1, radius - 0.5));
      ctx.stroke();

      ctx.restore();
    }

    // 4. Stroke outline
    if (isRemote) {
      ctx.save();
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = lowPower ? 0 : Math.max(6, cellSize * 0.16);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1.6, cellSize * 0.04);
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();
      ctx.restore();
    } else if (isCorrectPlacement) {
      ctx.save();

      // Razor-sharp, clean, vibrant warm emerald border
      const greenGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad + tileW, y + pad + tileW);
      greenGrad.addColorStop(0, '#86efac');  // Crisp warm lime-mint highlight
      greenGrad.addColorStop(0.3, '#4ade80'); // Radiant neon emerald
      greenGrad.addColorStop(0.7, '#22c55e'); // Rich tournament green
      greenGrad.addColorStop(1, '#16a34a');  // Deep pure emerald

      ctx.strokeStyle = greenGrad;
      ctx.lineWidth = Math.max(2.6, cellSize * 0.065);
      if (!lowPower) {
        ctx.shadowColor = 'rgba(34, 197, 94, 0.85)';
        ctx.shadowBlur = Math.max(4, cellSize * 0.1);
      }
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();

      // Subtle inner bright glint rim
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      const innerPad = 1;
      drawRoundedRect(ctx, x + pad + innerPad, y + pad + innerPad, tileW - innerPad * 2, tileW - innerPad * 2, Math.max(1, radius - innerPad));
      ctx.stroke();

      ctx.restore();
    } else if (isInvalidPlacement) {
      ctx.save();

      // High-contrast, vibrant Crimson / Rose warning border
      const roseGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad + tileW, y + pad + tileW);
      roseGrad.addColorStop(0, '#fecdd3');
      roseGrad.addColorStop(0.3, '#fb7185');
      roseGrad.addColorStop(0.7, '#f43f5e');
      roseGrad.addColorStop(1, '#be123c');

      ctx.strokeStyle = roseGrad;
      ctx.lineWidth = Math.max(2.8, cellSize * 0.07);
      if (!lowPower) {
        ctx.shadowColor = 'rgba(244, 63, 94, 0.85)';
        ctx.shadowBlur = Math.max(5, cellSize * 0.12);
      }
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();

      // Subtle inner bright glint rim
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      const innerPad = 1;
      drawRoundedRect(ctx, x + pad + innerPad, y + pad + innerPad, tileW - innerPad * 2, tileW - innerPad * 2, Math.max(1, radius - innerPad));
      ctx.stroke();

      ctx.restore();
    } else if (isPendingPlacement) {
      ctx.save();

      // Glowing Electric Sky-Blue border
      const blueGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad + tileW, y + pad + tileW);
      blueGrad.addColorStop(0, '#e0f2fe');
      blueGrad.addColorStop(0.3, '#38bdf8');
      blueGrad.addColorStop(0.7, '#0284c7');
      blueGrad.addColorStop(1, '#0369a1');

      ctx.strokeStyle = blueGrad;
      ctx.lineWidth = Math.max(2.6, cellSize * 0.065);
      if (!lowPower) {
        ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
        ctx.shadowBlur = Math.max(4, cellSize * 0.1);
      }
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();

      // Subtle inner bright glint rim
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      const innerPad = 1;
      drawRoundedRect(ctx, x + pad + innerPad, y + pad + innerPad, tileW - innerPad * 2, tileW - innerPad * 2, Math.max(1, radius - innerPad));
      ctx.stroke();

      ctx.restore();
    } else if (is2L) {
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.95)';
      ctx.lineWidth = 1.3;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();
    } else if (is3L) {
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.95)';
      ctx.lineWidth = 1.3;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();
    } else if (isPower) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
      ctx.lineWidth = 1.3;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();
    } else if (isLastMove && !isSpecialCellTile && !isFrozen) {
      ctx.save();

      // Radiant Amber-Gold outline for most recently completed move (ONLY for normal gold tiles)
      const amberGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad + tileW, y + pad + tileW);
      amberGrad.addColorStop(0, '#fef08a');
      amberGrad.addColorStop(0.4, '#facc15');
      amberGrad.addColorStop(0.8, '#f59e0b');
      amberGrad.addColorStop(1, '#d97706');

      ctx.strokeStyle = amberGrad;
      ctx.lineWidth = Math.max(2.2, cellSize * 0.052);
      if (!lowPower) {
        ctx.shadowColor = 'rgba(245, 158, 11, 0.7)';
        ctx.shadowBlur = Math.max(4, cellSize * 0.09);
      }
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1;
      const innerPad = 1;
      drawRoundedRect(ctx, x + pad + innerPad, y + pad + innerPad, tileW - innerPad * 2, tileW - innerPad * 2, Math.max(1, radius - innerPad));
      ctx.stroke();

      ctx.restore();
    } else if (isGolden) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
      ctx.lineWidth = 1.3;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();
    }

    const multiplier = (!isRemote && (isGolden || isSpecialCellTile || isFrozen))
      ? cellMultiplier(row, col)
      : 1;
    const effectiveValue = value * multiplier;

    // 5. Letter & Score Rendering
    if (showLetter && cellSize >= 12) {
      ctx.save();
      if (isBlankLetter(letter)) {
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;
        const starSize = Math.max(6, cellSize * 0.28);
        ctx.shadowColor = isFrozen ? '#bae6fd' : tilePalette.blank.glow;
        ctx.shadowBlur = lowPower ? 0 : Math.max(4, cellSize * 0.12);
        ctx.fillStyle = tilePalette.blank.color;
        drawStarburst(ctx, cx, cy, starSize, starSize * 0.4);
        ctx.fill();
        ctx.lineWidth = Math.max(0.5, cellSize * 0.055);
        ctx.strokeStyle = tilePalette.blank.stroke;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, starSize * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const letterFill = tilePalette.letter.color;
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
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2 + fontSize * 0.04;

        ctx.save();
        ctx.translate(cx, cy);
        if (letter === 'W') {
          ctx.scale(0.86, 1.0);
          ctx.translate(-cellSize * 0.02, 0);
        } else if (letter === 'M') {
          ctx.scale(0.92, 1.0);
        }
        
        if (!isRemote) {
          ctx.lineJoin = 'round';
          ctx.lineWidth = Math.max(2.4, fontSize * 0.11);
          ctx.strokeStyle = isFrozen ? '#011627' : tilePalette.letter.stroke;
          ctx.strokeText(letter, 0, 0);
        }
        if (!lowPower && !isRemote) {
          ctx.shadowColor = isFrozen ? 'rgba(56, 189, 248, 0.95)' : tilePalette.letter.shadow;
          ctx.shadowBlur = isFrozen ? Math.max(4, cellSize * 0.09) : Math.max(2, cellSize * 0.06);
          ctx.shadowOffsetY = Math.max(1.2, cellSize * 0.04);
        }
        ctx.fillText(letter, 0, 0);
        ctx.restore();
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
        if (!lowPower) {
          ctx.shadowColor = isFrozen ? 'rgba(56, 189, 248, 0.95)' : tilePalette.score.glow;
          ctx.shadowBlur = Math.max(4, numFontSize * 0.6);
        }
        ctx.lineWidth = Math.max(1.4, numFontSize * 0.14);
        ctx.strokeStyle = isFrozen ? '#011627' : tilePalette.score.stroke;
        ctx.strokeText(`${effectiveValue}`, numX, numY);
        ctx.fillStyle = tilePalette.score.color;
        ctx.fillText(`${effectiveValue}`, numX, numY);
        ctx.restore();
      }
    }

    // 5.5 Corner Status Pip for staged / recently placed tiles (ONLY on normal gold tiles)
    if (cellSize >= 16 && !isRemote && !isSpecialCellTile && !isFrozen && (isPlacedTile || isLastMove)) {
      ctx.save();
      const pipOffset = Math.max(3.5, cellSize * 0.12);
      const pipX = x + pad + pipOffset;
      const pipY = y + pad + pipOffset;
      const pipRadius = Math.max(2, cellSize * 0.055);

      let pipColor = '#38bdf8';
      let ringColor = '#7dd3fc';
      if (isCorrectPlacement) {
        pipColor = '#22c55e';
        ringColor = '#86efac';
      } else if (isInvalidPlacement) {
        pipColor = '#f43f5e';
        ringColor = '#fda4af';
      } else if (isLastMove) {
        pipColor = '#f59e0b';
        ringColor = '#fde047';
      }

      if (!lowPower) {
        ctx.shadowColor = pipColor;
        ctx.shadowBlur = Math.max(3, pipRadius * 1.5);
      }

      // Outer status pip ring
      ctx.beginPath();
      ctx.arc(pipX, pipY, pipRadius, 0, Math.PI * 2);
      ctx.fillStyle = pipColor;
      ctx.fill();

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Tiny inner specular glint
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(pipX - pipRadius * 0.25, pipY - pipRadius * 0.25, Math.max(0.8, pipRadius * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }

    // Shimmer wave gleam across temporary placed tiles
    if (isTemporary && !isRemote && animTime && !lowPower) {
      const phase = (animTime / 1400) % 1;
      const gleamX = x + pad + (tileW * 2.2) * phase - tileW * 0.6;
      const gleamGrad = ctx.createLinearGradient(gleamX - 18, y + pad, gleamX + 18, y + pad + tileW);
      if (isCorrectPlacement) {
        gleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gleamGrad.addColorStop(0.5, 'rgba(134, 239, 172, 0.42)');
        gleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else if (isInvalidPlacement) {
        gleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gleamGrad.addColorStop(0.5, 'rgba(254, 205, 211, 0.42)');
        gleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        gleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gleamGrad.addColorStop(0.5, 'rgba(224, 242, 254, 0.42)');
        gleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.clip();
      ctx.fillStyle = gleamGrad;
      ctx.fillRect(x + pad, y + pad, tileW, tileW);
      ctx.restore();
    }

    if (hasTransform) {
      ctx.restore();
    }

    // 6. Gemstone Transformation FX: Shockwave Aura Ring & Specular Beam Sweep
    if (morphProgress < 1.0 && !lowPower && (isSpecialCellTile || isFrozen)) {
      ctx.save();
      const waveRadius = tileW * (0.4 + morphProgress * 0.75);
      const waveAlpha = (1 - morphProgress) * 0.85;
      let auraColor = 'rgba(34, 197, 94, ';
      if (is3L) auraColor = 'rgba(244, 63, 94, ';
      else if (isFrozen) auraColor = 'rgba(224, 242, 254, ';
      else if (isPower) auraColor = 'rgba(56, 189, 248, ';

      // 6.1 Expanding Shockwave Ring
      ctx.strokeStyle = `${auraColor}${waveAlpha})`;
      ctx.lineWidth = Math.max(1.5, cellSize * 0.045 * (1 - morphProgress));
      ctx.shadowColor = `${auraColor}1)`;
      ctx.shadowBlur = Math.max(4, cellSize * 0.18);
      ctx.beginPath();
      ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 6.2 Diagonal Specular Gleam Sweep across the newly transformed face
      ctx.beginPath();
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.clip();

      const gleamX = x + pad - tileW * 0.8 + morphProgress * tileW * 2.6;
      const gleamGrad = ctx.createLinearGradient(gleamX, y + pad, gleamX + tileW * 0.6, y + pad + tileW);
      gleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gleamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.85 * (1 - morphProgress)})`);
      gleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gleamGrad;
      ctx.fillRect(x + pad, y + pad, tileW, tileW);

      ctx.restore();
    }

    // Landing drop shockwave on the board
    if (animStart && animProgress < 1.0 && !lowPower && !isSpecialCellTile && !isFrozen) {
      ctx.save();
      ctx.beginPath();
      const waveRadius = (tileW * 0.48) + (cellSize * 0.38) * animProgress;
      ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isRemote
        ? `rgba(56, 189, 248, ${(1 - animProgress) * 0.65})`
        : `rgba(251, 191, 36, ${(1 - animProgress) * 0.55})`;
      ctx.lineWidth = Math.max(1.2, cellSize * 0.04 * (1 - animProgress));
      ctx.stroke();
      ctx.restore();
    }
  }

  public static renderGhostTile(
    context: TileRenderContext,
    row: number,
    col: number,
    letter: string,
    value: number
  ): void {
    const { ctx, offset, cellSize, lowPower, tilePalette } = context;
    const x = offset.x + col * cellSize;
    const y = offset.y + row * cellSize;
    const pad = Math.max(1, cellSize * 0.05);
    const tileW = cellSize - pad * 2;
    const radius = Math.max(2, cellSize * 0.12);

    ctx.save();

    // 1. Solid frosted dark-amber base: cleanly blocks underlying multiplier text (2L, 3L, etc.)
    ctx.fillStyle = 'rgba(15, 12, 6, 0.92)';
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.fill();

    // 2. Luminous holographic gold glass gradient
    const glassGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad + tileW * 0.5, y + pad + tileW);
    glassGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    glassGrad.addColorStop(0.3, 'rgba(245, 158, 11, 0.25)');
    glassGrad.addColorStop(0.7, 'rgba(217, 119, 6, 0.30)');
    glassGrad.addColorStop(1, 'rgba(146, 64, 14, 0.45)');
    ctx.fillStyle = glassGrad;
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.fill();

    // 3. Top glass specular reflection sheen
    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.clip();
    const sheenGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad, y + pad + tileW * 0.55);
    sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    sheenGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.15)');
    sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(x + pad, y + pad, tileW, tileW * 0.55);

    // Diagonal light sweep
    const sweepGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad + tileW, y + pad + tileW);
    sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    sweepGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.22)');
    sweepGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.32)');
    sweepGrad.addColorStop(0.65, 'rgba(254, 240, 138, 0.15)');
    sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(x + pad, y + pad, tileW, tileW);
    ctx.restore();

    // 4. Dual border with soft ambient glow
    ctx.save();
    if (!lowPower) {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
      ctx.shadowBlur = Math.max(6, cellSize * 0.22);
    }
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = Math.max(1.8, cellSize * 0.045);
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.stroke();

    // Inner subtle gold highlight rim
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.5)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x + pad + 1.2, y + pad + 1.2, tileW - 2.4, tileW - 2.4, Math.max(1, radius - 1));
    ctx.stroke();
    ctx.restore();

    // 5. Letter & Score Rendering (Matching real game tile aesthetics with high contrast)
    if (cellSize >= 12 && letter) {
      const fontSize = Math.max(12, Math.round(cellSize * 0.70));
      ctx.font = `italic 900 ${fontSize}px 'Inter Black Italic', -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textX = x + cellSize / 2;
      const textY = y + cellSize / 2 + fontSize * 0.04;

      // Dark drop stroke for supreme contrast against any board cell
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = Math.max(2.2, fontSize * 0.11);
      ctx.strokeText(letter, textX, textY);

      // Letter face: Golden radiant gradient
      const letterGrad = ctx.createLinearGradient(0, y + cellSize * 0.25, 0, y + cellSize * 0.75);
      letterGrad.addColorStop(0, '#ffffff');
      letterGrad.addColorStop(0.4, '#fef08a');
      letterGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = letterGrad;
      ctx.fillText(letter, textX, textY);

      // Score subscript
      if (cellSize >= 18 && value > 0) {
        const numFontSize = Math.max(8, Math.round(cellSize * 0.24));
        ctx.font = `italic 900 ${numFontSize}px 'Inter Black Italic', sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const numX = x + cellSize - pad * 1.5;
        const numY = y + cellSize - pad * 1.5;

        ctx.strokeStyle = '#020617';
        ctx.lineWidth = Math.max(1.6, numFontSize * 0.16);
        ctx.strokeText(`${value}`, numX, numY);
        ctx.fillStyle = '#fef08a';
        ctx.fillText(`${value}`, numX, numY);
      }
    }

    ctx.restore();
  }
}
