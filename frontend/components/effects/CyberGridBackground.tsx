'use client';

import React from 'react';

export default function CyberGridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* 1. Perspective 3D Glowing Ground Grid */}
      <div 
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(245, 158, 11, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(245, 158, 11, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 15%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 15%, transparent 75%)',
        }}
      />

      {/* 2. Secondary High-Tech Cyan Micro-Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(6, 182, 212, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(6, 182, 212, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '192px 192px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 80%)',
        }}
      />

      {/* 3. Glowing Crosshair Intersection Nodes */}
      <div 
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle 1.5px at center, rgba(251, 191, 36, 0.8) 100%, transparent 100%)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(circle 350px at 50% 50%, black 10%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(circle 350px at 50% 50%, black 10%, transparent 80%)',
        }}
      />
    </div>
  );
}
