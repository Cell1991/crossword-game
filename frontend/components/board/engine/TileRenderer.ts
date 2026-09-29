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
      const iceGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      iceGrad.addColorStop(0, '#7dd3fc');
      iceGrad.addColorStop(0.25, '#38bdf8');
      iceGrad.addColorStop(0.68, '#0284c7');
      iceGrad.addColorStop(1, '#075985');
      ctx.fillStyle = iceGrad;
    } else if (isRemote) {
      // 1. Shadow & Outer Aura
      if (!lowPower) {
        ctx.save();
        ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
        ctx.shadowBlur = Math.max(6, cellSize * 0.18);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
        drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
        ctx.fill();
        ctx.restore();
      }

      // 2. Cosmic Obsidian Hologram Face Fill
      const ghostGrad = ctx.createLinearGradient(0, y + pad, 0, y + pad + tileW);
      ghostGrad.addColorStop(0, '#1e293b');
      ghostGrad.addColorStop(0.3, '#0f172a');
      ghostGrad.addColorStop(0.75, '#090d16');
      ghostGrad.addColorStop(1, '#020617');
      ctx.fillStyle = ghostGrad;
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.fill();

      // 3. Holographic Specular Bevel & Inner Sheen
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(ctx, x + pad, y + pad, tileW, tileW, radius);
      ctx.clip();

      const sheen = ctx.createLinearGradient(x + pad, y + pad, x + pad, y + pad + tileW * 0.55);
      sheen.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      sheen.addColorStop(0.35, 'rgba(56, 189, 248, 0.1)');
      sheen.addColorStop(1, 'transparent');
      ctx.fillStyle = sheen;
      ctx.fillRect(x + pad, y + pad, tileW, tileW);

      // Inner subtle neon bevel
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = Math.max(0.8, cellSize * 0.02);
      drawRoundedRect(ctx, x + pad + 1, y + pad + 1, tileW - 2, tileW - 2, Math.max(1, radius - 1));
      ctx.stroke();

      // Center Holographic Staged Glyph (Celestial Sparkle Beacon)
      if (cellSize >= 16) {
        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;
        const starSize = Math.max(4, cellSize * 0.2);

        if (!lowPower) {
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = Math.max(4, cellSize * 0.12);
        }
        ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - starSize * 1.35);
        ctx.lineTo(cx + starSize * 0.35, cy - starSize * 0.35);
        ctx.lineTo(cx + starSize * 1.35, cy);
        ctx.lineTo(cx + starSize * 0.35, cy + starSize * 0.35);
        ctx.lineTo(cx, cy + starSize * 1.35);
        ctx.lineTo(cx - starSize * 0.35, cy + starSize * 0.35);
        ctx.lineTo(cx - starSize * 1.35, cy);
        ctx.lineTo(cx - starSize * 0.35, cy - starSize * 0.35);
        ctx.closePath();
        ctx.fill();

        // Center bright diamond core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, starSize * 0.28), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. Glowing Cyberpunk Outer Border Stroke
      ctx.save();
      ctx.shadowColor = 'rgba(6, 182, 212, 0.85)';
      ctx.shadowBlur = lowPower ? 0 : Math.max(4, cellSize * 0.1);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1.5, cellSize * 0.04);
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
          ctx.strokeStyle = isFrozen ? '#020617' : tilePalette.letter.stroke;
          ctx.strokeText(letter, textX, textY);
        }
        ctx.shadowColor = isRemote ? 'transparent' : isFrozen ? 'rgba(0, 0, 0, 0.95)' : tilePalette.letter.shadow;
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
