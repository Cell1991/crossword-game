'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom, joinRoom, startGame, sessionStore, debugSessionStore, StoredSession } from '@/lib/api';

export default function DebugSetupPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await createRoom('Debug Player 1', null);
      const hostSession: StoredSession = {
        gameId: res.game_id,
        playerId: res.host_player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: true,
        gamePin: res.game_pin,
      };
      sessionStore.save(hostSession);
      setSessions([hostSession]);
      setGamePin(res.game_pin);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create debug room');
    } finally {
      setBusy(false);
    }
  };

  const handleAddClone = async () => {
    if (!gamePin) return;
    setBusy(true);
    setError('');
    try {
      const res = await joinRoom(gamePin, `Debug Player ${sessions.length + 1}`);
      const cloneSession: StoredSession = {
        gameId: res.game_id,
        playerId: res.player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: res.is_host,
        gamePin,
      };
      setSessions(previous => [...previous, cloneSession]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add clone player');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    const host = sessions.find(s => s.isHost);
    if (!host) return;
    setBusy(true);
    setError('');
    try {
      await startGame(host.gamePin!, host.playerId);
      debugSessionStore.save(host.gameId, sessions);
      sessionStore.save(host);
      router.push(`/game/${host.gameId}?debug=1`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start debug game');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 flex flex-col gap-5">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-rose-400/80">Solo bug testing</p>
          <h1 className="text-2xl font-bold text-white">Debug Mode</h1>
          <p className="mt-1 text-sm text-slate-400">
            Play against yourself: add clone players you control, then reveal every rack, adjust HP,
            rewrite tiles, or grant power cards once the game starts.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {!gamePin ? (
          <button
            onClick={handleCreateRoom}
            disabled={busy}
            className="w-full rounded-2xl bg-rose-500 hover:bg-rose-400 py-3.5 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create Debug Game'}
          </button>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Players ({sessions.length})</p>
              <div className="flex flex-col gap-1.5">
                {sessions.map(s => (
                  <div key={s.playerId} className="flex items-center justify-between text-sm text-white">
                    <span>{s.displayName}</span>
                    {s.isHost && <span className="text-[10px] font-bold uppercase text-amber-400">Host</span>}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleAddClone}
              disabled={busy}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-3 font-semibold text-white disabled:opacity-50"
            >
              + Add Clone Player
            </button>
            <button
              onClick={handleStart}
              disabled={busy}
              className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 py-3.5 text-lg font-bold text-slate-950 disabled:opacity-50"
            >
              {busy ? 'Starting…' : `Start Debug Game (${sessions.length} player${sessions.length === 1 ? '' : 's'})`}
            </button>
          </>
        )}

        <button
          onClick={() => router.push('/')}
          className="text-center text-xs text-slate-500 hover:text-slate-300"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}
