'use client';

import React, { RefObject, useEffect, useRef, useState } from 'react';
import { parseServerTimestamp } from '@/lib/serverTime';

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
 * The turn countdown. It owns its own clock tick, so only this badge re-renders four times a
 * second rather than the whole game screen.
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
  /** The latest clock reading, tagged with the snapshot it was taken after. */
  const [tick, setTick] = useState<{ now: number; since: number } | null>(null);
  const timeoutRequestRef = useRef<{ turnNumber: number; at: number } | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick({ now: Date.now() + clockOffsetRef.current, since: syncedAt });
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [clockOffsetRef, syncedAt]);

  // A fresh snapshot resets the clock to the server's reading; ticks taken before it are stale.
  const now = tick && tick.since === syncedAt ? tick.now : syncedAt;
  const turnStartedAtMs = parseServerTimestamp(turnStartedAt);
  const secondsRemaining = turnTimeLimit && Number.isFinite(turnStartedAtMs)
    ? Math.max(0, turnTimeLimit - Math.floor((now - turnStartedAtMs) / 1000))
    : null;

  useEffect(() => {
    if (secondsRemaining !== 0 || !turnTimeLimit || !currentPlayerId) return;
    // The server has the final say. If it answers "not yet" (clocks never match exactly), ask again
    // shortly instead of leaving the turn stuck at 0s.
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl border transition-all duration-200 select-none shadow-[0_4px_12px_rgba(0,0,0,0.6)] ${
        isLowTime
          ? 'border-rose-400 bg-rose-950/95 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.5)] ring-1 ring-rose-400 animate-pulse'
          : 'border-amber-400/70 bg-[#0c0803]/90 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/30'
      }`}
      title="Time left this turn"
    >
      <span className={isLowTime ? 'text-rose-400 animate-bounce' : 'text-amber-400'}>
        {isLowTime ? '⚠️' : '⏱️'}
      </span>
      <span className="tabular-nums tracking-wider">{formattedTime}</span>
    </div>
  );
};
