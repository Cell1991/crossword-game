'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

/** How long a flashed toast stays on screen. */
const TOAST_MS = 4000;

/** The two toasts stacked over the board: the latest move/info line and the latest error. */
export function useGameToasts() {
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const infoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissInfo = useCallback(() => {
    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    setInfo(null);
  }, []);

  const dismissError = useCallback(() => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError('');
  }, []);

  /** Shows an info line that clears itself after a few seconds. */
  const flashInfo = useCallback((message: string) => {
    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    setInfo(message);
    infoTimerRef.current = setTimeout(() => {
      setInfo(null);
      infoTimerRef.current = null;
    }, TOAST_MS);
  }, []);

  /** Shows an error that clears itself after a few seconds. */
  const flashError = useCallback((message: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setError(message);
    errorTimerRef.current = setTimeout(() => {
      setError('');
      errorTimerRef.current = null;
    }, TOAST_MS);
  }, []);

  return useMemo(() => ({
    info,
    error,
    setError,
    flashInfo,
    flashError,
    dismissInfo,
    dismissError,
  }), [info, error, flashInfo, flashError, dismissInfo, dismissError]);
}

export type GameToasts = ReturnType<typeof useGameToasts>;
