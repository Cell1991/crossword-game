'use client';

import React, { startTransition, useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { getRoom, leaveRoom, startGame, sessionStore } from '../../../lib/api';
import { PinDisplay } from '../../../components/lobby/PinDisplay';
import { PlayerList } from '../../../components/lobby/PlayerList';
import ParticleField from '../../../components/effects/ParticleField';
import { Player } from '../../../lib/types';

/** Matches MIN_PLAYERS on the backend: a host may start alone and play solo. */
const MIN_PLAYERS = 1;

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const pin = params.pin as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  // The room says who hosts: the host can leave and hand the room to someone else.
  const [hostPlayerId, setHostPlayerId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
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
      setGameId(session.gameId);
      setIsSpectator(Boolean(session.isSpectator));
    });
  }, [router]);

  const isHost = Boolean(myPlayerId && hostPlayerId === myPlayerId);

  const fetchRoom = useCallback(async () => {
    try {
      const room = await getRoom(pin);
      setPlayers(room.players);
      setHostPlayerId(room.host_player_id);
      setSpectatorCount(room.spectator_count ?? 0);
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

  /** Gives the seat back so the game does not deal this player in and wait for their turns. */
  const handleLeave = async () => {
    setLeaving(true);
    if (myPlayerId) await leaveRoom(pin, myPlayerId).catch(() => undefined);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading lobby...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 gap-6 overflow-hidden">
      <ParticleField className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80" />
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <Image
            src="/wordx-icon.png?v=20260915"
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

          <div className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-sm text-sky-100">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">ผู้ชม</span>
              <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200">
                {spectatorCount}/2
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              {isSpectator
                ? 'คุณกำลังเข้าร่วมในโหมดผู้ชม'
                : 'คนที่เข้ามาหลังจากผู้เล่นเต็ม 4 คน จะถูกส่งไปยังโหมดผู้ชม'}
            </p>
          </div>

          {players.length < 2 && (
            <p className="text-center text-slate-500 text-sm mt-4">
              Waiting for other players to join... {isHost && '(or start now to play solo)'}
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
            disabled={starting || leaving || players.length < MIN_PLAYERS}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            {starting ? 'Starting...' : '▶ Start Game'}
          </button>
        )}

        {!isHost && (
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm">
              {isSpectator ? '👁 Watching: the board opens when the host starts' : 'Waiting for host to start...'}
            </span>
          </div>
        )}

        {/* Back to home */}
        <button
          onClick={handleLeave}
          disabled={leaving || starting}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors disabled:opacity-40"
        >
          {leaving ? 'Leaving...' : isSpectator ? '← Stop watching' : '← Leave lobby'}
        </button>
      </div>
    </div>
  );
}
