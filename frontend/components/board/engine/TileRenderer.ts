import { cellMultiplier } from '@/lib/board';
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

function drawFrostMist(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number
) {
  // 1. Diagonal frosty ice sheet sheen
  const sheenGrad = ctx.createLinearGradient(x, y, x + tileW, y + tileW);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  sheenGrad.addColorStop(0.18, 'rgba(224, 242, 254, 0.45)');
  sheenGrad.addColorStop(0.42, 'rgba(56, 189, 248, 0.12)');
  sheenGrad.addColorStop(0.68, 'rgba(224, 242, 254, 0.35)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.55)');
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(x, y, tileW, tileW);

  // 2. Swirling ice mist fog clouds (bottom-left cold vapor puff)
  const fog1 = ctx.createRadialGradient(
    x + tileW * 0.28,
    y + tileW * 0.75,
    tileW * 0.05,
    x + tileW * 0.28,
    y + tileW * 0.75,
    tileW * 0.55
  );
  fog1.addColorStop(0, 'rgba(240, 249, 255, 0.6)');
  fog1.addColorStop(0.45, 'rgba(186, 230, 253, 0.32)');
  fog1.addColorStop(1, 'rgba(186, 230, 253, 0)');
  ctx.fillStyle = fog1;
  ctx.fillRect(x, y, tileW, tileW);

  // 3. Top-right drifting sub-zero mist
  const fog2 = ctx.createRadialGradient(
    x + tileW * 0.75,
    y + tileW * 0.28,
    tileW * 0.05,
    x + tileW * 0.75,
    y + tileW * 0.28,
    tileW * 0.5
  );
  fog2.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  fog2.addColorStop(0.45, 'rgba(125, 211, 252, 0.28)');
  fog2.addColorStop(1, 'rgba(125, 211, 252, 0)');
  ctx.fillStyle = fog2;
  ctx.fillRect(x, y, tileW, tileW);

  // 4. Center ethereal mist band
  const mistBand = ctx.createLinearGradient(x, y + tileW * 0.38, x + tileW, y + tileW * 0.62);
  mistBand.addColorStop(0, 'rgba(255, 255, 255, 0)');
  mistBand.addColorStop(0.3, 'rgba(224, 242, 254, 0.3)');
  mistBand.addColorStop(0.5, 'rgba(255, 255, 255, 0.42)');
  mistBand.addColorStop(0.75, 'rgba(186, 230, 253, 0.22)');
  mistBand.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = mistBand;
  ctx.fillRect(x, y, tileW, tileW);
}

function drawIceCrystals(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileW: number,
  cellSize: number
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Top-Left Frost Crystal Shard / Fracture line
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1, cellSize * 0.024);
  ctx.moveTo(x + tileW * 0.08, y + tileW * 0.24);
  ctx.lineTo(x + tileW * 0.22, y + tileW * 0.17);
  ctx.lineTo(x + tileW * 0.32, y + tileW * 0.25);
  ctx.lineTo(x + tileW * 0.42, y + tileW * 0.14);
  ctx.stroke();

  // Branch offshoot
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.65)';
  ctx.lineWidth = Math.max(0.75, cellSize * 0.016);
  ctx.moveTo(x + tileW * 0.22, y + tileW * 0.17);
  ctx.lineTo(x + tileW * 0.2, y + tileW * 0.07);
  ctx.moveTo(x + tileW * 0.32, y + tileW * 0.25);
  ctx.lineTo(x + tileW * 0.36, y + tileW * 0.33);
  ctx.stroke();

  // 2. Bottom-Right Frost Spikes / Ice Crystal Cluster
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = Math.max(0.85, cellSize * 0.02);
  ctx.moveTo(x + tileW * 0.92, y + tileW * 0.66);
  ctx.lineTo(x + tileW * 0.78, y + tileW * 0.78);
  ctx.lineTo(x + tileW * 0.64, y + tileW * 0.74);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
  ctx.moveTo(x + tileW * 0.78, y + tileW * 0.78);
  ctx.lineTo(x + tileW * 0.82, y + tileW * 0.92);
  ctx.stroke();

  // 3. Ice Glint Stars (Sparkling Ice Diamonds)
  const drawGlint = (gx: number, gy: number, r: number) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(gx, gy - r * 1.8);
    ctx.lineTo(gx + r * 0.35, gy - r * 0.35);
    ctx.lineTo(gx + r * 1.8, gy);
    ctx.lineTo(gx + r * 0.35, gy + r * 0.35);
    ctx.lineTo(gx, gy + r * 1.8);
    ctx.lineTo(gx - r * 0.35, gy + r * 0.35);
    ctx.lineTo(gx - r * 1.8, gy);
    ctx.lineTo(gx - r * 0.35, gy - r * 0.35);
    ctx.closePath();
    ctx.fill();

    // Glint core point
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(gx, gy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  };

  // Primary frost diamond star (top left)
  drawGlint(x + tileW * 0.18, y + tileW * 0.18, Math.max(1.8, cellSize * 0.045));
  // Secondary micro glint (top right)
  drawGlint(x + tileW * 0.82, y + tileW * 0.22, Math.max(1.2, cellSize * 0.028));
  // Micro glint (bottom left)
  drawGlint(x + tileW * 0.24, y + tileW * 0.82, Math.max(1.0, cellSize * 0.022));

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

    // Animation physics (spring drop & bounce when placed)
    const animStart = tileAnimations?.get(`${row}_${col}`);
    let scale = 1.0;
    let bounceY = 0;
    let animProgress = 1.0;
    if (animStart && animTime) {
      const elapsed = animTime - animStart;
      if (elapsed >= 0 && elapsed < 320) {
        animProgress = elapsed / 320;
        // Elastic spring formula: starts elevated and slightly larger, lands with a micro-bounce
        scale = 1.0 + 0.26 * Math.exp(-animProgress * 5) * Math.cos(animProgress * 10);
        bounceY = -Math.max(0, 1 - animProgress) * cellSize * 0.16;
      }
    }

    const isGolden = !isRemote && !isFrozen;
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
      ctx.shadowColor = 'rgba(56, 189, 248, 0.95)';
      ctx.shadowBlur = lowPower ? 4 : Math.max(12, cellSize * 0.32);
      ctx.fillStyle = 'rgba(4, 28, 56, 0.8)';
      drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
      ctx.fill();
      ctx.restore();
    } else {
      const shadowFill = isRemote
        ? 'rgba(6, 182, 212, 0.5)'
        : TILE_THEME.face.shadow;

      if (!lowPower || isPlacedTile || isLastMove || isRemote) {
        ctx.save();
        if (isCorrectPlacement) {
          ctx.shadowColor = 'rgba(34, 197, 94, 0.85)';
          ctx.shadowBlur = lowPower ? 2 : Math.max(14, cellSize * 0.32);
        } else if (isInvalidPlacement) {
          ctx.shadowColor = 'rgba(244, 63, 94, 0.85)';
          ctx.shadowBlur = lowPower ? 2 : Math.max(14, cellSize * 0.32);
        } else if (isPendingPlacement) {
          ctx.shadowColor = 'rgba(14, 165, 233, 0.8)';
          ctx.shadowBlur = lowPower ? 2 : Math.max(12, cellSize * 0.28);
        } else if (isLastMove) {
          ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
          ctx.shadowBlur = lowPower ? 2 : Math.max(10, cellSize * 0.24);
        } else if (isRemote) {
          ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
          ctx.shadowBlur = lowPower ? 2 : Math.max(8, cellSize * 0.2);
        } else {
          ctx.shadowColor = shadowFill;
          ctx.shadowBlur = lowPower ? 1 : Math.max(4, cellSize * 0.1);
        }
      }
      ctx.fillStyle = shadowFill;
      drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
      ctx.fill();
      if (!lowPower || isPlacedTile || isLastMove || isRemote) ctx.restore();

      // Atmospheric outer aura on the board under the tile (rendered BEFORE the face so gold stays 100% pure)
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
      const iceGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      iceGrad.addColorStop(0, '#bae6fd');
      iceGrad.addColorStop(0.18, '#38bdf8');
      iceGrad.addColorStop(0.55, '#0284c7');
      iceGrad.addColorStop(0.85, '#0369a1');
      iceGrad.addColorStop(1, '#082f49');
      ctx.fillStyle = iceGrad;
    } else if (isRemote) {
      const ghostGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      ghostGrad.addColorStop(0, '#0284c7');
      ghostGrad.addColorStop(0.3, '#0369a1');
      ghostGrad.addColorStop(0.7, '#075985');
      ghostGrad.addColorStop(1, '#082f49');
      ctx.fillStyle = ghostGrad;
    } else {
      const grad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      grad.addColorStop(0, '#fbbf24');
      grad.addColorStop(0.28, '#f59e0b');
      grad.addColorStop(0.65, '#d97706');
      grad.addColorStop(0.88, '#b45309');
      grad.addColorStop(1, '#78350f');
      ctx.fillStyle = grad;
    }
    drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
    ctx.fill();

    // 3. Specular Sheen, Chiseled Facets & Holographic Glyphs / Ice Frost
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
    } else if (isFrozen) {
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.clip();

      // 1. Draw billowing frost mist clouds
      drawFrostMist(ctx, x + pad, y + pad, tileW);

      // 2. Inner frosty condensation border
      const innerFrostGrad = ctx.createLinearGradient(x + pad, y + pad, x + pad, y + pad + tileW);
      innerFrostGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      innerFrostGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.45)');
      innerFrostGrad.addColorStop(1, 'rgba(56, 189, 248, 0.65)');
      ctx.strokeStyle = innerFrostGrad;
      ctx.lineWidth = Math.max(1.2, cellSize * 0.03);
      drawRoundedRect(ctx, x + pad + 1, y + pad + 1, tileW - 2, tileW - 2, Math.max(1, radius - 1));
      ctx.stroke();

      // 3. Draw crystalline ice shards, fractures & diamond frost stars
      if (cellSize >= 14) {
        drawIceCrystals(ctx, x + pad, y + pad, tileW, cellSize);
      }

      ctx.restore();
    } else if (!isFrozen && !isRemote) {
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.clip();

      // Top edge crisp subtle warm luster line (does not wash out the golden body)
      const topEdgeGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + Math.max(2, cellSize * 0.08));
      topEdgeGrad.addColorStop(0, 'rgba(255, 245, 180, 0.65)');
      topEdgeGrad.addColorStop(1, 'rgba(255, 245, 180, 0)');
      ctx.fillStyle = topEdgeGrad;
      ctx.fillRect(x + pad, y + pad, tileW, Math.max(2, cellSize * 0.08));

      // Bottom subtle chiseled bevel shadow
      const botShade = ctx.createLinearGradient(0, y + pad + tileW * 0.78, 0, y + pad + tileW);
      botShade.addColorStop(0, 'rgba(60, 20, 0, 0)');
      botShade.addColorStop(1, 'rgba(60, 20, 0, 0.55)');
      ctx.fillStyle = botShade;
      ctx.fillRect(x + pad, y + pad + tileW * 0.78, tileW, tileW * 0.22);

      // Inner crisp golden rim
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x + pad + 0.5, y + pad + 0.5, tileW - 1, tileW - 1, Math.max(1, radius - 0.5));
      ctx.stroke();

      ctx.restore();
    }

    // 4. Stroke outline
    if (isFrozen) {
      ctx.save();
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = lowPower ? 2 : Math.max(8, cellSize * 0.2);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = Math.max(2, cellSize * 0.048);
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.stroke();

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = Math.max(1, cellSize * 0.024);
      drawRoundedRect(ctx, x + pad + 0.5, y + pad + 0.5, tileW - 1, tileW - 1, radius);
      ctx.stroke();
      ctx.restore();
    } else if (isRemote) {
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
    } else if (isLastMove) {
      ctx.save();

      // Radiant Amber-Gold outline for most recently completed move
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

    const multiplier = (!isRemote && (isGolden || isFrozen))
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
        ctx.shadowColor = isFrozen ? '#38bdf8' : tilePalette.blank.glow;
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
        if (isFrozen) {
          const frostLetterGrad = ctx.createLinearGradient(0, y + cellSize * 0.25, 0, y + cellSize * 0.75);
          frostLetterGrad.addColorStop(0, '#ffffff');
          frostLetterGrad.addColorStop(0.65, '#f0f9ff');
          frostLetterGrad.addColorStop(1, '#bae6fd');
          ctx.fillStyle = frostLetterGrad;
        } else if (isRemote) {
          const letterGrad = ctx.createLinearGradient(0, y + cellSize * 0.27, 0, y + cellSize * 0.72);
          letterGrad.addColorStop(0, '#0f172a');
          letterGrad.addColorStop(1, '#334155');
          ctx.fillStyle = letterGrad;
        } else {
          ctx.fillStyle = letterFill;
        }
        const letterScale = letter === 'W' ? 0.78 : letter === 'M' ? 0.86 : 1.0;
        let fontSize = Math.max(10, Math.round(cellSize * 0.68 * letterScale));
        ctx.font = `italic 900 ${fontSize}px 'Inter Black Italic', sans-serif`;

        // Safety clamp: ensure wide letters never touch tile borders or score numbers
        const metrics = ctx.measureText(letter);
        const maxAllowedW = tileW * 0.68;
        if (metrics.width > maxAllowedW && metrics.width > 0) {
          fontSize = Math.max(9, Math.round(fontSize * (maxAllowedW / metrics.width)));
          ctx.font = `italic 900 ${fontSize}px 'Inter Black Italic', sans-serif`;
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = x + cellSize / 2 + (letter === 'W' ? -0.5 : 0);
        const textY = y + cellSize / 2 + fontSize * 0.04;
        
        if (!isRemote) {
          ctx.lineJoin = 'round';
          ctx.lineWidth = Math.max(2.0, fontSize * 0.10);
          ctx.strokeStyle = isFrozen ? '#02182b' : tilePalette.letter.stroke;
          ctx.strokeText(letter, textX, textY);
        }
        ctx.shadowColor = isRemote ? 'transparent' : isFrozen ? 'rgba(56, 189, 248, 0.85)' : tilePalette.letter.shadow;
        ctx.shadowBlur = isRemote ? 0 : isFrozen ? Math.max(4, cellSize * 0.09) : Math.max(2, cellSize * 0.06);
        ctx.shadowOffsetY = isRemote ? 0 : Math.max(1.2, cellSize * 0.04);
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
        ctx.shadowColor = isFrozen ? 'rgba(250, 204, 21, 0.9)' : tilePalette.score.glow;
        ctx.shadowBlur = lowPower ? 2 : Math.max(4, numFontSize * 0.6);
        ctx.lineWidth = Math.max(1.2, numFontSize * 0.12);
        ctx.strokeStyle = isFrozen ? '#020617' : tilePalette.score.stroke;
        ctx.strokeText(`${effectiveValue}`, numX, numY);
        ctx.fillStyle = tilePalette.score.color;
        ctx.fillText(`${effectiveValue}`, numX, numY);
        ctx.restore();
      }
    }

    // 5.5 Corner Status Pip for staged / recently placed tiles
    if (cellSize >= 16 && !isRemote && (isPlacedTile || isLastMove)) {
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

    // Landing drop shockwave on the board
    if (animStart && animProgress < 1.0 && !lowPower) {
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
