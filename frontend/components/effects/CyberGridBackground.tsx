'use client';

import React from 'react';

export default function CyberGridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* 1. Tactical Crossword Board Grid (Enhanced Visibility) */}
      <div 
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(245, 158, 11, 0.22) 1.2px, transparent 1.2px),
            linear-gradient(to bottom, rgba(245, 158, 11, 0.22) 1.2px, transparent 1.2px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 85% 75% at 50% 50%, black 25%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 50%, black 25%, transparent 85%)',
        }}
      />

      {/* 2. Secondary High-Tech Major Grid Lines */}
      <div 
        className="absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(6, 182, 212, 0.35) 1.5px, transparent 1.5px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.35) 1.5px, transparent 1.5px)
          `,
          backgroundSize: '192px 192px',
          maskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 30%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 50%, black 30%, transparent 90%)',
        }}
      />

      {/* 3. Tactical Intersection Star / Spark Nodes */}
      <div 
        className="absolute inset-0 opacity-[0.6]"
        style={{
          backgroundImage: `radial-gradient(circle 2px at center, rgba(251, 191, 36, 0.95) 100%, transparent 100%)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(circle 500px at 50% 50%, black 20%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(circle 500px at 50% 50%, black 20%, transparent 85%)',
        }}
      />
    </div>
  );
}
