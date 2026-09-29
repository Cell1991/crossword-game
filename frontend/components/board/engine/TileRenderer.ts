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
    isFrozen = false
  ): void {
    const { ctx, offset, cellSize, lowPower, tilePalette, temporaryTilesValid } = context;
    const x = offset.x + col * cellSize;
    const y = offset.y + row * cellSize;
    const pad = Math.max(1, cellSize * 0.06);
    const tileW = cellSize - pad * 2;
    const radius = Math.max(2, cellSize * 0.12);

    const isGolden = !isRemote && !isFrozen && (!isTemporary || temporaryTilesValid === true);
    const isCorrectPlacement = !isRemote && isTemporary && temporaryTilesValid === true;

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

      if (!lowPower || isCorrectPlacement || isRemote) {
        ctx.save();
        ctx.shadowColor = isCorrectPlacement
          ? 'rgba(52, 211, 153, 0.9)'
          : isRemote
          ? 'rgba(6, 182, 212, 0.8)'
          : shadowFill;
        ctx.shadowBlur = isCorrectPlacement
          ? Math.max(8, cellSize * 0.22)
          : isRemote
          ? Math.max(8, cellSize * 0.2)
          : Math.max(4, cellSize * 0.1);
      }
      ctx.fillStyle = shadowFill;
      drawRoundedRect(ctx, x + pad, y + pad + 1.5, tileW, tileW, radius);
      ctx.fill();
      if (!lowPower || isCorrectPlacement || isRemote) ctx.restore();
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
      grad.addColorStop(0, TILE_THEME.face.top);
      grad.addColorStop(0.5, TILE_THEME.face.middle);
      grad.addColorStop(1, TILE_THEME.face.bottom);
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
        const fontSize = Math.max(12, Math.round(cellSize * 0.70));
        ctx.font = `italic 900 ${fontSize}px 'Inter Black Italic', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = x + cellSize / 2;
        const textY = y + cellSize / 2 + fontSize * 0.04;
        
        if (!isRemote) {
          ctx.lineJoin = 'round';
          ctx.lineWidth = Math.max(1.8, fontSize * 0.09);
          ctx.strokeStyle = isFrozen ? '#02182b' : tilePalette.letter.stroke;
          ctx.strokeText(letter, textX, textY);
        }
        ctx.shadowColor = isRemote ? 'transparent' : isFrozen ? 'rgba(56, 189, 248, 0.85)' : tilePalette.letter.shadow;
        ctx.shadowBlur = isRemote ? 0 : isFrozen ? Math.max(4, cellSize * 0.09) : Math.max(2, cellSize * 0.06);
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
        ctx.shadowColor = isFrozen ? 'rgba(250, 204, 21, 0.9)' : tilePalette.score.glow;
        ctx.shadowBlur = lowPower ? 2 : Math.max(4, numFontSize * 0.6);
        ctx.lineWidth = Math.max(0.6, numFontSize * 0.06);
        ctx.strokeStyle = isFrozen ? '#020617' : tilePalette.score.stroke;
        ctx.strokeText(`${effectiveValue}`, numX, numY);
        ctx.fillStyle = tilePalette.score.color;
        ctx.fillText(`${effectiveValue}`, numX, numY);
        ctx.restore();
      }
    }
  }
}
