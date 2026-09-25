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
  return (
    <span className="whitespace-nowrap font-mono text-xs text-amber-300 font-semibold px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60" title="Time left this turn">
      ⏳ {secondsRemaining}s
    </span>
  );
};
