'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Snowflake, Flame, Repeat2, Heart, Swords, Shield, AlertTriangle, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { soundFx } from '@/lib/soundFx';
import { BoardCamera } from '@/hooks/useBoardCamera';

export interface BoardCellEffect {
  id: string;
  type: 'FREEZE' | 'DESTROY';
  row: number;
  col: number;
  timestamp: number;
}

export interface SpySwapAlertData {
  id: string;
  sourcePlayerId: string;
  sourcePlayerName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  count: number;
  isVictim: boolean;
  isCaster: boolean;
}

/**
 * 1. Screen-Wide Cinematic Environmental Vignette (Frost, Fire, Healing, Bloodlust)
 */
export const ScreenVignettePulse: React.FC<{
  type: 'FREEZE' | 'DESTROY' | 'HEAL' | 'DOUBLE_DAMAGE' | 'SWAP' | null;
  onComplete?: () => void;
}> = ({ type, onComplete }) => {
  useEffect(() => {
    if (!type) return;
    const timer = setTimeout(() => onComplete?.(), 1600);
    return () => clearTimeout(timer);
  }, [type, onComplete]);

  if (!type) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {type === 'FREEZE' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.5, 0] }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          className="absolute inset-0 shadow-[inset_0_0_120px_rgba(56,189,248,0.7),inset_0_0_240px_rgba(186,230,253,0.4)]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(56, 189, 248, 0.18) 75%, rgba(14, 165, 233, 0.35) 100%)',
          }}
        />
      )}

      {type === 'DESTROY' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.4, 0] }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute inset-0 shadow-[inset_0_0_120px_rgba(249,115,22,0.8),inset_0_0_240px_rgba(239,68,68,0.45)]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(249, 115, 22, 0.22) 75%, rgba(185, 28, 28, 0.35) 100%)',
          }}
        />
      )}

      {type === 'HEAL' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0.3, 0] }}
          transition={{ duration: 1.3, ease: 'easeOut' }}
          className="absolute inset-0 shadow-[inset_0_0_100px_rgba(34,197,94,0.65)]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 45%, rgba(34, 197, 94, 0.18) 80%, rgba(21, 128, 61, 0.3) 100%)',
          }}
        />
      )}

      {type === 'DOUBLE_DAMAGE' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.4, 0] }}
          transition={{ duration: 1.3, ease: 'easeOut' }}
          className="absolute inset-0 shadow-[inset_0_0_110px_rgba(168,85,247,0.7)]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 45%, rgba(168, 85, 247, 0.2) 80%, rgba(88, 28, 135, 0.35) 100%)',
          }}
        />
      )}

      {type === 'SWAP' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.4, 0] }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          className="absolute inset-0 shadow-[inset_0_0_110px_rgba(16,185,129,0.7)]"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(16, 185, 129, 0.2) 75%, rgba(6, 78, 59, 0.35) 100%)',
          }}
        />
      )}
    </div>
  );
};

/**
 * 2. Dramatic Spy Swap Cinematic Modal / Banner ("YOU GOT PLAYED / TILES STOLEN!")
 */
export const SpySwapNotificationOverlay: React.FC<{
  data: SpySwapAlertData | null;
  onDismiss: () => void;
}> = ({ data, onDismiss }) => {
  useEffect(() => {
    if (!data) return;
    if (data.isVictim) {
      soundFx.playCardActivate('DESTROY_TILE'); // Heavy dramatic warning sound
    } else {
      soundFx.playCardActivate('SPY_SWAP');
    }

    const timer = setTimeout(() => {
      onDismiss();
    }, 4200);
    return () => clearTimeout(timer);
  }, [data, onDismiss]);

  if (!data) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center p-4 select-none">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.6, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, y: -30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 450, damping: 26 }}
          className={`pointer-events-auto relative max-w-md w-full overflow-hidden rounded-3xl border-2 p-6 text-center shadow-2xl backdrop-blur-xl ${
            data.isVictim
              ? 'border-rose-500 bg-gradient-to-b from-[#2a0812]/98 via-[#18050c]/98 to-[#090205]/98 shadow-[0_0_60px_rgba(244,63,94,0.6),inset_0_0_30px_rgba(244,63,94,0.3)]'
              : 'border-emerald-400 bg-gradient-to-b from-[#062418]/98 via-[#03140e]/98 to-[#020a06]/98 shadow-[0_0_60px_rgba(16,185,129,0.6),inset_0_0_30px_rgba(16,185,129,0.3)]'
          }`}
        >
          {/* Top light sheen */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full border border-white/20 bg-black/40 text-slate-300 hover:text-white hover:border-white/40 active:scale-95 transition-all cursor-pointer z-20"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Badge */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border-2 shadow-xl relative z-10">
            {data.isVictim ? (
              <div className="flex h-full w-full items-center justify-center rounded-3xl border-rose-400 bg-rose-500/20 shadow-lg shadow-rose-500/40 animate-pulse">
                <AlertTriangle className="h-10 w-10 text-rose-300 fill-rose-500/30 drop-shadow-[0_0_12px_#fb7185]" />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-3xl border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/40">
                <Repeat2 className="h-10 w-10 text-emerald-300 drop-shadow-[0_0_12px_#34d399]" />
              </div>
            )}
          </div>

          {/* Header Title */}
          <h2
            className={`text-2xl sm:text-3xl font-black font-maple tracking-wide drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] ${
              data.isVictim ? 'text-rose-200' : 'text-emerald-200'
            }`}
          >
            {data.isVictim ? 'TILES STOLEN!' : 'SPY SWAP EXECUTED!'}
          </h2>

          <span
            className={`mt-1 inline-block text-[11px] sm:text-xs font-black uppercase tracking-[0.25em] ${
              data.isVictim ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {data.isVictim ? 'YOU GOT PLAYED!' : 'STEALTH HEIST SUCCESS'}
          </span>

          {/* Detailed Message Box */}
          <div className="mt-4 rounded-2xl border border-white/15 bg-black/60 p-3.5 sm:p-4 text-center relative z-10 backdrop-blur-md">
            <p className="text-sm sm:text-base font-bold text-slate-100 leading-snug drop-shadow-sm">
              {data.isVictim ? (
                <>
                  <span className="text-amber-300 font-extrabold">{data.sourcePlayerName}</span> snatched{' '}
                  <span className="text-rose-300 font-black text-lg">{data.count}</span> tile
                  {data.count > 1 ? 's' : ''} directly from your rack!
                </>
              ) : (
                <>
                  You successfully swapped{' '}
                  <span className="text-emerald-300 font-black text-lg">{data.count}</span> tile
                  {data.count > 1 ? 's' : ''} with{' '}
                  <span className="text-amber-300 font-extrabold">{data.targetPlayerName}</span>!
                </>
              )}
            </p>
          </div>

          {/* Action button */}
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onDismiss}
              className={`px-6 py-2 rounded-full border text-xs sm:text-sm font-black tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer ${
                data.isVictim
                  ? 'border-rose-400 bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/50'
                  : 'border-emerald-400 bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/50'
              }`}
            >
              {data.isVictim ? 'Acknowledge' : 'Continue'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

/**
 * 3. Board-Space Cinematic Burst Layer (Freeze Ice Blast & Tile Incineration)
 * Uses pure GPU transform positioning synchronized with board camera for 120 FPS.
 */
export const BoardEffectsLayer: React.FC<{
  camera: BoardCamera;
  effects: BoardCellEffect[];
  onEffectEnd: (id: string) => void;
}> = ({ camera, effects, onEffectEnd }) => {
  const [view, setView] = useState(() => camera.getView());

  useEffect(() => {
    return camera.subscribe(() => setView(camera.getView()));
  }, [camera]);

  const baseCellSize = camera.baseCellSize;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <div
        className="absolute left-0 top-0 transform-gpu will-change-transform"
        style={{
          transformOrigin: '0 0',
          transform: `translate3d(${view.offset.x}px, ${view.offset.y}px, 0) scale(${view.scale})`,
        }}
      >
        <AnimatePresence>
          {effects.map((fx) => {
            const cx = fx.col * baseCellSize + baseCellSize / 2;
            const cy = fx.row * baseCellSize + baseCellSize / 2;
            const size = baseCellSize;

            if (fx.type === 'FREEZE') {
              return (
                <motion.div
                  key={`fx-freeze-${fx.id}`}
                  initial={{ scale: 0.2, opacity: 1 }}
                  animate={{ scale: [0.2, 1.8, 2.2], opacity: [1, 0.9, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                  onAnimationComplete={() => onEffectEnd(fx.id)}
                  className="absolute pointer-events-none flex items-center justify-center transform-gpu"
                  style={{
                    left: `${cx - size}px`,
                    top: `${cy - size}px`,
                    width: `${size * 2}px`,
                    height: `${size * 2}px`,
                  }}
                >
                  {/* Expanding Glacial Shockwave Ring */}
                  <div className="absolute inset-2 rounded-full border-4 border-cyan-200 bg-cyan-400/25 shadow-[0_0_35px_#38bdf8,inset_0_0_20px_#e0f2fe] animate-ping" />
                  {/* Center Frost Starburst */}
                  <Snowflake className="h-16 w-16 text-white drop-shadow-[0_0_20px_#00f0ff] animate-spin" />
                  {/* Radiating Frost Spikes */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent rotate-45 scale-125" />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent -rotate-45 scale-125" />
                </motion.div>
              );
            }

            if (fx.type === 'DESTROY') {
              return (
                <motion.div
                  key={`fx-destroy-${fx.id}`}
                  initial={{ scale: 0.3, opacity: 1 }}
                  animate={{ scale: [0.3, 2.0, 2.4], opacity: [1, 0.95, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.65, ease: 'easeOut' }}
                  onAnimationComplete={() => onEffectEnd(fx.id)}
                  className="absolute pointer-events-none flex items-center justify-center transform-gpu"
                  style={{
                    left: `${cx - size}px`,
                    top: `${cy - size}px`,
                    width: `${size * 2}px`,
                    height: `${size * 2}px`,
                  }}
                >
                  {/* Incinerating Fireball Blast Ring */}
                  <div className="absolute inset-2 rounded-full border-4 border-orange-300 bg-orange-500/35 shadow-[0_0_40px_#f97316,inset_0_0_25px_#fef08a] animate-ping" />
                  {/* Center Flame Icon */}
                  <Flame className="h-16 w-16 text-yellow-200 fill-orange-500 drop-shadow-[0_0_24px_#ef4444]" />
                  {/* Exploding Fragment Streaks */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-orange-400/60 to-transparent rotate-30 scale-150" />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-red-500/60 to-transparent -rotate-60 scale-150" />
                </motion.div>
              );
            }

            return null;
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
