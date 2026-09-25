'use client';

import { useCallback, useMemo, useState } from 'react';

/** How long a flashed toast stays on screen. */
const TOAST_MS = 4000;

/** The two toasts stacked over the board: the latest move/info line and the latest error. */
export function useGameToasts() {
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState('');

  /** Shows an info line that clears itself after a few seconds. */
  const flashInfo = useCallback((message: string) => {
    setInfo(message);
    setTimeout(() => setInfo(null), TOAST_MS);
  }, []);

  /** Shows an error that clears itself after a few seconds. */
  const flashError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(''), TOAST_MS);
  }, []);

  return useMemo(() => ({ info, error, setError, flashInfo, flashError }), [info, error, flashInfo, flashError]);
}

export type GameToasts = ReturnType<typeof useGameToasts>;
