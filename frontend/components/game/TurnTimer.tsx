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
      className={`inline-flex h-8 sm:h-9 items-center justify-center gap-1.5 whitespace-nowrap text-xs sm:text-sm font-black px-3 py-1 rounded-xl border transition-all duration-200 select-none shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] ${
        isLowTime
          ? 'border-rose-400 bg-rose-950/95 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.6)] ring-1 ring-rose-400 animate-pulse'
          : 'border-amber-400/40 bg-[#121432]/95 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.2)] ring-1 ring-amber-400/25'
      }`}
      title="Turn Time Remaining"
    >
      <Timer className={`w-3.5 h-3.5 ${isLowTime ? 'text-rose-400 animate-spin' : 'text-amber-400'}`} style={{ animationDuration: '4s' }} />
      <span className="tabular-nums tracking-wider">{formattedTime}</span>
    </div>
  );
};
