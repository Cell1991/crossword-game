'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type MouseGradientTextProps = {
  children: ReactNode;
  className?: string;
};

/** Text whose fill color shifts along a radial gradient centered on the cursor. */
export default function MouseGradientText({ children, className = '' }: MouseGradientTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Pointer events can outnumber frames; measure and restyle once per frame with the latest one.
    let frame: number | null = null;
    let latest = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      latest = { x: e.clientX, y: e.clientY };
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${((latest.x - rect.left) / rect.width) * 100}%`);
        el.style.setProperty('--my', `${((latest.y - rect.top) / rect.height) * 100}%`);
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span
      ref={ref}
      className={`bg-clip-text text-transparent [background-image:radial-gradient(circle_at_var(--mx,50%)_var(--my,50%),#fde68a_0%,#fbbf24_30%,#818cf8_65%,#f8fafc_100%)] ${className}`}
    >
      {children}
    </span>
  );
}
