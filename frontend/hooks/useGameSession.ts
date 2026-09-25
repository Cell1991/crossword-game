'use client';

import { startTransition, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { debugSessionStore, sessionStore, StoredSession } from '@/lib/api';

/**
 * The browser-side seat for this game, read from sessionStorage after hydration. A visitor
 * without one is sent back to the home page. Debug games also keep every clone's session so
 * the tester can switch who they act as.
 */
export function useGameSession(gameId: string, isDebug: boolean) {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [debugSessions, setDebugSessions] = useState<StoredSession[]>([]);

  useEffect(() => {
    startTransition(() => {
      setSession(sessionStore.get(gameId));
      if (isDebug) setDebugSessions(debugSessionStore.get(gameId));
      setHydrated(true);
    });
  }, [gameId, isDebug]);

  useEffect(() => {
    if (hydrated && !session) router.replace('/');
  }, [hydrated, session, router]);

  /** Acts as another seat from now on (debug games), remembering the choice for reloads. */
  const switchSession = useCallback((next: StoredSession) => {
    sessionStore.save(next);
    setSession(next);
  }, []);

  return { session, hydrated, debugSessions, switchSession };
}
