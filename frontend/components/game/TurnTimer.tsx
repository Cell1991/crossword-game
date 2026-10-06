'use client';

import React, { RefObject, useEffect, useRef, useState } from 'react';
import { parseServerTimestamp } from '@/lib/serverTime';
import { Timer } from 'lucide-react';

/** How often the countdown refreshes. */
const TICK_MS = 250;
/** How long to wait before asking the server again whether a turn that reads 0s has expired. */
const TIMEOUT_RETRY_MS = 2000;

interface TurnTimerProps {
  turnTimeLimit: number | null;
  turnStartedAt: string | null;
  turnNumber: number;
  currentPlayerId: string | null;
  /** Server clock minus this device's clock. */
  clockOffsetRef: RefObject<number>;
  /** Server time when the latest snapshot arrived. */
  syncedAt: number;
  /** Asks the server to end a turn that ran out of time. */
  onTimeUp: () => Promise<unknown>;
}

/**
 * Cyber/Tactical Turn Chronometer with glowing LED digits and emergency pulse.
 */
export const TurnTimer: React.FC<TurnTimerProps> = ({
  turnTimeLimit,
  turnStartedAt,
  turnNumber,
  currentPlayerId,
  clockOffsetRef,
  syncedAt,
  onTimeUp,
}) => {
  const [tick, setTick] = useState<{ now: number; since: number } | null>(null);
  const timeoutRequestRef = useRef<{ turnNumber: number; at: number } | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick({ now: Date.now() + clockOffsetRef.current, since: syncedAt });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [clockOffsetRef, syncedAt]);

  const now = tick && tick.since === syncedAt ? tick.now : syncedAt;
  const turnStartedAtMs = parseServerTimestamp(turnStartedAt);
  const secondsRemaining =
    turnTimeLimit && Number.isFinite(turnStartedAtMs)
      ? Math.max(0, turnTimeLimit - Math.floor((now - turnStartedAtMs) / 1000))
      : null;

  useEffect(() => {
    if (secondsRemaining !== 0 || !turnTimeLimit || !currentPlayerId) return;
    const lastRequest = timeoutRequestRef.current;
    if (lastRequest?.turnNumber === turnNumber && now - lastRequest.at < TIMEOUT_RETRY_MS) return;
    timeoutRequestRef.current = { turnNumber, at: now };
    void onTimeUp().catch(() => undefined);
  }, [currentPlayerId, now, onTimeUp, secondsRemaining, turnNumber, turnTimeLimit]);

  if (secondsRemaining === null) return null;
  const isLowTime = secondsRemaining <= 10;
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedTime = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

  return (
    <div
      className={`inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 whitespace-nowrap text-xs sm:text-sm font-black px-3 py-1 rounded-xl border transition-all duration-200 select-none sm:backdrop-blur-xl relative overflow-hidden ${
        isLowTime
          ? 'border-rose-400/80 bg-gradient-to-r from-rose-950/95 via-[#2a0c16]/98 to-rose-950/95 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.6),inset_0_1px_1px_rgba(255,255,255,0.25)] ring-1 ring-rose-400/60 animate-pulse'
          : 'border-amber-400/40 bg-gradient-to-r from-[#181636]/90 via-[#100f28]/95 to-[#090818]/90 text-amber-200 shadow-[0_4px_14px_rgba(0,0,0,0.6),0_0_12px_rgba(245,158,11,0.2),inset_0_1px_1px_rgba(255,255,255,0.18)] hover:border-amber-400/60'
      }`}
      title="Turn Time Remaining"
    >
      {/* Specular shimmer */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

      <Timer className={`w-3.5 h-3.5 relative z-10 ${isLowTime ? 'text-rose-300 animate-spin' : 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]'}`} style={{ animationDuration: '3s' }} />
      <span className="tabular-nums font-mono font-black tracking-wider relative z-10">{formattedTime}</span>
    </div>
  );
};

