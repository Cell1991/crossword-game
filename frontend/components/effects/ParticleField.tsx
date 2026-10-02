'use client';

import { useEffect, useRef } from 'react';

type Node = { x: number; y: number; vy: number; char: string };
type Beam = { x: number; y: number; length: number; speed: number; opacity: number };

const CHARS = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ*+#'.split('');
const NODE_COUNT = 44;
const BEAM_COUNT = 12;
const LINK_DISTANCE = 110;
const MOUSE_RADIUS = 160;

type ParticleFieldProps = {
  className?: string;
  /** Accent color as an "r, g, b" triplet, used near the cursor and on beams. */
  accent?: string;
};

/** Ambient canvas backdrop: drifting ASCII nodes, proximity links, and rising light beams. */
export default function ParticleField({ className = '', accent = '251, 191, 36' }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true, desynchronized: true });
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let nodes: Node[] = [];
    let beams: Beam[] = [];
    const device = navigator as Navigator & { deviceMemory?: number };
    const isTouchDevice = window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches;
    const isLowPowerDevice = isTouchDevice || (device.hardwareConcurrency ?? 8) <= 4 || (device.deviceMemory ?? 8) <= 4;
    const nodeCount = isTouchDevice ? 14 : isLowPowerDevice ? 24 : NODE_COUNT;
    const beamCount = isTouchDevice ? 4 : isLowPowerDevice ? 6 : BEAM_COUNT;
    const frameInterval = isTouchDevice ? 1000 / 25 : 1000 / 30;
    let lastDrawAt = 0;
    const mouse = { x: -1000, y: -1000 };
    /** The canvas box, measured on resize: reading it on every pointer move forced a layout each time. */
    let canvasLeft = 0;
    let canvasTop = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvasLeft = rect.left;
      canvasTop = rect.top;
      const prevWidth = width;
      const prevHeight = height;

      // Use actual client size or fallback to window viewport
      width = Math.max(rect.width || canvas.clientWidth || window.innerWidth, 320);
      height = Math.max(rect.height || canvas.clientHeight || window.innerHeight, 240);

      const dpr = isTouchDevice ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // If dimensions expanded from an initial small/default size (e.g. 300x150), redistribute or reseed nodes
      if (prevWidth > 0 && prevHeight > 0 && (prevWidth < width * 0.7 || prevHeight < height * 0.7)) {
        seed();
      }
    };

    const seed = () => {
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: Math.random() * 0.35 + 0.1,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
      }));
      beams = Array.from({ length: beamCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 90 + 50,
        speed: Math.random() * 4 + 2,
        opacity: Math.random() * 0.4 + 0.2,
      }));
    };

    // Initial measurement & seeding
    resize();
    seed();

    // A window drag or layout shift fires resize events; re-measure and reseed once per frame.
    let resizeFrame: number | null = null;
    const onResize = () => {
      if (resizeFrame !== null) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        resize();
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX - canvasLeft;
      mouse.y = e.clientY - canvasTop;
    };

    // Use ResizeObserver so when CSS layout finishes or canvas expands, it resizes immediately
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(onResize)
      : null;
    if (resizeObserver) {
      resizeObserver.observe(canvas);
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const draw = () => {
      const now = performance.now();
      if (document.visibilityState === 'hidden') {
        frame = requestAnimationFrame(draw);
        return;
      }
      if (now - lastDrawAt < frameInterval) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastDrawAt = now;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Beams
      ctx.lineWidth = 1.5;
      for (const beam of beams) {
        beam.y -= beam.speed;
        if (beam.y + beam.length < 0) {
          beam.y = height + 100;
          beam.x = Math.random() * width;
        }
        const gradient = ctx.createLinearGradient(beam.x, beam.y, beam.x, beam.y + beam.length);
        gradient.addColorStop(0, `rgba(${accent}, ${beam.opacity})`);
        gradient.addColorStop(1, 'transparent');
        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(beam.x, beam.y);
        ctx.lineTo(beam.x, beam.y + beam.length);
        ctx.stroke();
      }

      // 2. Batch Links
      ctx.strokeStyle = `rgba(${accent}, 0.12)`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const linkDistSq = LINK_DISTANCE * LINK_DISTANCE;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (dx * dx + dy * dy < linkDistSq) {
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
          }
        }
      }
      ctx.stroke();

      // 3. Draw Nodes in Golden Glow
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const node of nodes) {
        node.y += node.vy;
        if (node.y > height + 20) {
          node.y = -20;
          node.x = Math.random() * width;
        }

        const dist = Math.hypot(mouse.x - node.x, mouse.y - node.y);
        if (dist < MOUSE_RADIUS || Math.random() > 0.985) {
          node.char = CHARS[Math.floor(Math.random() * CHARS.length)];
        }

        if (dist < MOUSE_RADIUS) {
          ctx.strokeStyle = `rgba(${accent}, ${0.5 * (1 - dist / MOUSE_RADIUS)})`;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        ctx.fillStyle = dist < MOUSE_RADIUS ? 'rgb(254, 240, 138)' : `rgba(${accent}, 0.55)`;
        ctx.fillText(node.char, node.x, node.y);
      }

      frame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(frame);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [accent]);

  return <canvas ref={canvasRef} className={className} />;
}
