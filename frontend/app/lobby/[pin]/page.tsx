'use client';

import React, { startTransition, useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { getRoom, startGame, sessionStore } from '../../../lib/api';
import { PinDisplay } from '../../../components/lobby/PinDisplay';
import { PlayerList } from '../../../components/lobby/PlayerList';
import { Player } from '../../../lib/types';

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const pin = params.pin as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [turnTimeLimit, setTurnTimeLimit] = useState<number | null>(null);

  // Load session
  useEffect(() => {
    const session = sessionStore.getLast();
    if (!session) {
      router.replace('/');
      return;
    }
    startTransition(() => {
      setMyPlayerId(session.playerId);
      setIsHost(session.isHost);
      setGameId(session.gameId);
    });
  }, [router]);

  const fetchRoom = useCallback(async () => {
    try {
      const room = await getRoom(pin);
      setPlayers(room.players);
      setTurnTimeLimit(room.turn_time_limit);
      setLoading(false);
      // If game already started, redirect to game
      if (room.status === 'PLAYING' || room.status === 'ACTIVE') {
        const session = sessionStore.getLast();
        if (session) router.replace(`/game/${session.gameId}`);
      }
    } catch {
      setLoading(false);
    }
  }, [pin, router]);

  // Poll room state every 2 seconds
  useEffect(() => {
    const initialFetch = setTimeout(() => { void fetchRoom(); }, 0);
    const interval = setInterval(fetchRoom, 2000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchRoom]);

  const handleStart = async () => {
    if (!gameId || !myPlayerId) return;
    setStarting(true);
    setError('');
    try {
      await startGame(pin, myPlayerId);
      router.push(`/game/${gameId}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to start game');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading lobby...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 gap-6">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <Image
            src="/wordx-icon.png"
            alt="WordX logo"
            width={72}
            height={72}
            priority
            className="mx-auto mb-2 h-[72px] w-[72px] object-contain drop-shadow-2xl"
          />
          <h1 className="text-3xl font-black text-white tracking-tight">
            Word<span className="text-amber-400">X</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isHost ? 'Share the PIN and start when ready!' : 'Waiting for host to start the game...'}
          </p>
        </div>

        {/* PIN Display */}
        <PinDisplay pin={pin} />

        <div className="text-sm text-slate-300 bg-slate-900/70 border border-slate-700/50 rounded-xl px-4 py-2">
          Turn Time: <span className="font-semibold text-amber-300">{turnTimeLimit === null ? 'Unlimited' : `${turnTimeLimit} sec`}</span>
        </div>

        {/* Player List */}
        <div className="w-full bg-slate-900/80 border border-slate-700/50 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
          <PlayerList players={players} myPlayerId={myPlayerId} />

          {players.length < 2 && (
            <p className="text-center text-slate-500 text-sm mt-4">
              Waiting for at least 2 players to join...
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {/* Start Button (host only) */}
        {isHost && (
          <button
            onClick={handleStart}
            disabled={starting || players.length < 1}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            {starting ? 'Starting...' : '▶ Start Game'}
          </button>
        )}

        {!isHost && (
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm">Waiting for host to start...</span>
          </div>
        )}

        {/* Back to home */}
        <button
          onClick={() => router.push('/')}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
        >
          ← Leave lobby
        </button>
      </div>
    </div>
  );
}
