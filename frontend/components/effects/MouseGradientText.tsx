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

    const onPointerMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
    };

    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
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
