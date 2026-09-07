'use client';

import { useEffect, useRef } from 'react';

type Node = { x: number; y: number; vy: number; char: string };
type Beam = { x: number; y: number; length: number; speed: number; opacity: number };

const CHARS = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ*+#'.split('');
const NODE_COUNT = 70;
const BEAM_COUNT = 18;
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
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let nodes: Node[] = [];
    let beams: Beam[] = [];
    const mouse = { x: -1000, y: -1000 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: Math.random() * 0.35 + 0.1,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
      }));
      beams = Array.from({ length: BEAM_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 90 + 50,
        speed: Math.random() * 4 + 2,
        opacity: Math.random() * 0.4 + 0.2,
      }));
    };

    const onResize = () => { resize(); seed(); };
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    resize();
    seed();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove);

    const draw = () => {
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
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < LINK_DISTANCE) {
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

      frame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [accent]);

  return <canvas ref={canvasRef} className={className} />;
}
