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
    const isLowPowerDevice = isTouchDevice || (device.hardwareConcurrency ?? 8) <= 8 || (device.deviceMemory ?? 8) <= 8;
    const nodeCount = isTouchDevice ? 14 : isLowPowerDevice ? 24 : NODE_COUNT;
    const beamCount = isTouchDevice ? 4 : isLowPowerDevice ? 6 : BEAM_COUNT;
    const frameInterval = isTouchDevice ? 1000 / 15 : isLowPowerDevice ? 1000 / 20 : 1000 / 30;
    let lastDrawAt = 0;
    const mouse = { x: -1000, y: -1000 };
    /** The canvas box, measured on resize: reading it on every pointer move forced a layout each time. */
    let canvasLeft = 0;
    let canvasTop = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvasLeft = rect.left;
      canvasTop = rect.top;
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, isLowPowerDevice ? 1 : 1.5);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    // A window drag fires many resize events per frame; re-measure and reseed once per frame.
    let resizeFrame: number | null = null;
    const onResize = () => {
      if (resizeFrame !== null) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        resize();
        seed();
        if (isTouchDevice) draw();
      });
    };
    const onPointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX - canvasLeft;
      mouse.y = e.clientY - canvasTop;
    };

    resize();
    seed();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove);

    const draw = () => {
      const now = performance.now();
      if (document.visibilityState === 'hidden') {
        if (!isTouchDevice) frame = requestAnimationFrame(draw);
        return;
      }
      if (now - lastDrawAt < frameInterval) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastDrawAt = now;
      ctx.clearRect(0, 0, width, height);

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
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(beam.x, beam.y);
        ctx.lineTo(beam.x, beam.y + beam.length);
        ctx.stroke();
      }

      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < LINK_DISTANCE * LINK_DISTANCE) {
            const d = Math.sqrt(distanceSquared);
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.12 * (1 - d / LINK_DISTANCE)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

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
          ctx.strokeStyle = `rgba(${accent}, ${0.4 * (1 - dist / MOUSE_RADIUS)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        ctx.fillStyle = dist < MOUSE_RADIUS ? `rgb(${accent})` : 'rgba(148, 163, 184, 0.35)';
        ctx.fillText(node.char, node.x, node.y);
      }

      if (!isTouchDevice) frame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(frame);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [accent]);

  return <canvas ref={canvasRef} className={className} />;
}
