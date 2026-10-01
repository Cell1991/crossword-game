'use client';

import React, { startTransition, useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { getRoom, leaveRoom, startGame, sessionStore } from '@/lib/api';
import { PinDisplay } from '@/components/lobby/PinDisplay';
import { PlayerList } from '@/components/lobby/PlayerList';
import ParticleField from '@/components/effects/ParticleField';
import FullscreenButton from '@/components/ui/FullscreenButton';
import { GameMode, Player } from '@/lib/types';
import { Clock } from 'lucide-react';

/** Matches MIN_PLAYERS on the backend: a host may start alone and play solo. */
const MIN_PLAYERS = 1;

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const pin = params.pin as string;

  const initialSession = typeof window !== 'undefined' ? sessionStore.getLast() : null;
  const matchesCurrentPin = initialSession?.gamePin === pin;

  const [players, setPlayers] = useState<Player[]>(() => {
    if (matchesCurrentPin && initialSession?.playerId && !initialSession.isSpectator) {
      if (initialSession.isHost) {
        return [{
          id: initialSession.playerId,
          display_name: initialSession.displayName,
          is_host: true,
          score: 0,
          hp: initialSession.startingHp ?? 100,
          turn_order: 0,
          connection_status: 'ONLINE',
          rack_count: 0,
        }];
      }
    }
    return [];
  });
  const [gameId, setGameId] = useState<string | null>(matchesCurrentPin ? (initialSession?.gameId ?? null) : null);
  const [hostPlayerId, setHostPlayerId] = useState<string | null>(
    matchesCurrentPin ? (initialSession?.hostPlayerId || (initialSession?.isHost ? initialSession.playerId : null)) : null
  );
  const [myPlayerId, setMyPlayerId] = useState<string | null>(matchesCurrentPin ? (initialSession?.playerId ?? null) : null);
  const [sessionIsHost, setSessionIsHost] = useState(Boolean(matchesCurrentPin && initialSession?.isHost));
  const [isSpectator, setIsSpectator] = useState(Boolean(matchesCurrentPin && initialSession?.isSpectator));
  const [leaving, setLeaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!matchesCurrentPin);
  const [turnTimeLimit, setTurnTimeLimit] = useState<number | null>(matchesCurrentPin ? (initialSession?.turnTimeLimit ?? null) : null);
  const [gameMode, setGameMode] = useState<GameMode>(matchesCurrentPin && initialSession?.gameMode ? initialSession.gameMode : 'HP');
  const [maxTurns, setMaxTurns] = useState<number | null>(matchesCurrentPin ? (initialSession?.maxTurns ?? null) : null);
  const [startingHp, setStartingHp] = useState<number | null>(matchesCurrentPin ? (initialSession?.startingHp ?? null) : null);
  const [maxPlayers, setMaxPlayers] = useState<number | null>(matchesCurrentPin && initialSession?.maxPlayers ? initialSession.maxPlayers : 4);
  const [isDebugRoom, setIsDebugRoom] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(matchesCurrentPin ? (initialSession?.createdAt ?? null) : null);
  const [timeLeft, setTimeLeft] = useState<number>(600);

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
      setSessionIsHost(session.isHost);
      setIsSpectator(Boolean(session.isSpectator));
      if (session.createdAt) {
        setCreatedAt(session.createdAt);
      }
      if (session.maxPlayers) {
        setMaxPlayers(session.maxPlayers);
      }
      if (!session.isSpectator && session.playerId) {
        setPlayers(prev => {
          if (prev.some(p => p.id === session.playerId)) return prev;
          return [{
            id: session.playerId,
            display_name: session.displayName,
            is_host: session.isHost,
            score: 0,
            hp: session.startingHp ?? 100,
            turn_order: 0,
            connection_status: 'ONLINE',
            rack_count: 0,
          }, ...prev];
        });
      }
    });
  }, [router]);

  const isHost = Boolean(
    myPlayerId && !isSpectator && (sessionIsHost || hostPlayerId === myPlayerId)
  );

  const fetchRoom = useCallback(async () => {
    try {
      const room = await getRoom(pin);
      if (room.status === 'EXPIRED') {
        const session = sessionStore.getLast();
        if (session?.gameId) sessionStore.remove(session.gameId);
        router.replace('/?kicked=expired');
        return;
      }
      setPlayers(room.players);
      setHostPlayerId(room.host_player_id);
      setTurnTimeLimit(room.turn_time_limit);
      setGameMode(room.game_mode);
      setMaxTurns(room.max_turns);
      setStartingHp(room.starting_hp ?? null);
      const effectiveMax = room.max_players || initialSession?.maxPlayers || 4;
      setMaxPlayers(effectiveMax);
      setIsDebugRoom(room.is_debug);
      if (room.created_at) {
        setCreatedAt(room.created_at);
      }
      setLoading(false);
      // If game already started, redirect to game
      if (room.status === 'PLAYING' || room.status === 'ACTIVE') {
        const session = sessionStore.getLast();
        if (session) router.replace(`/game/${session.gameId}${room.is_debug ? '?debug=1' : ''}`);
      }
    } catch (error: unknown) {
      setLoading(false);
      const msg = error instanceof Error ? error.message : 'Failed to fetch room';
      if (
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('dissolved') ||
        msg.toLowerCase().includes('not found') ||
        msg.includes('410') ||
        msg.includes('404')
      ) {
        const session = sessionStore.getLast();
        if (session?.gameId) sessionStore.remove(session.gameId);
        router.replace('/?kicked=expired');
        return;
      }
      setError(msg);
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

  // Room auto-dissolution countdown (10 minutes)
  useEffect(() => {
    if (!createdAt) return;

    const parseCreatedAt = (raw: string) => {
      const normalized = raw.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`;
      const time = new Date(normalized).getTime();
      return isNaN(time) ? Date.now() : time;
    };

    const createdMs = parseCreatedAt(createdAt);
    const expiryMs = createdMs + 10 * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiryMs - now) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        // Countdown reached 0: kick all players from lobby to home page immediately
        const session = sessionStore.getLast();
        if (session?.gameId) sessionStore.remove(session.gameId);
        router.replace('/?kicked=expired');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [createdAt, router]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStart = async () => {
    if (!gameId || !myPlayerId) return;
    setStarting(true);
    setError('');
    try {
      await startGame(pin, myPlayerId);
      router.push(`/game/${gameId}${isDebugRoom ? '?debug=1' : ''}`);
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

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 gap-6 overflow-hidden">
      <ParticleField className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-80" />
      <FullscreenButton className="fixed top-3.5 right-3.5 z-40" />
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-6">
        {/* Header */}
        <div className="relative text-center flex flex-col items-center">
          {/* 3D Cube Logo with glowing halo */}
          <div className="relative mb-2 flex items-center justify-center">
            <div className="pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-tr from-indigo-500/30 via-amber-400/20 to-amber-500/35 blur-xl hero-glow-breathe" />
            <div className="relative hero-logo-float transition-transform duration-300 hover:scale-105">
              <Image
                src="/wordx-icon-256.png?v=20260915"
                alt="WordX logo"
                width={76}
                height={76}
                priority
                className="h-[72px] w-[72px] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)] drop-shadow-[0_0_20px_rgba(245,158,11,0.35)]"
              />
            </div>
          </div>
          <h1 className="relative text-3xl sm:text-4xl font-black tracking-[-0.03em] leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]">
            <span className="bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent [text-shadow:0_2px_12px_rgba(255,255,255,0.25)]">
              Word
            </span>
            <span className="relative inline-block bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(245,158,11,0.85)] ml-0.5">
              X
            </span>
          </h1>
        </div>

        {/* PIN Display */}
        <PinDisplay pin={pin} />

        <div className={`w-full rounded-2xl border p-2 sm:p-2.5 shadow-lg backdrop-blur-md transition-all duration-300 ${
          timeLeft <= 120
            ? 'bg-rose-950/30 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
            : 'bg-slate-900/80 border-slate-700/50'
        }`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-center">
            {/* Mode */}
            <div className="flex flex-col items-center justify-center py-2 px-1.5 rounded-xl bg-slate-800/40 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mode</span>
              <span className="mt-0.5 text-xs sm:text-sm font-bold text-amber-300 truncate max-w-full">
                {gameMode === 'HP' ? `HP Battle (${startingHp ?? 100})` : `${maxTurns} Turns`}
              </span>
            </div>

            {/* Players */}
            <div className="flex flex-col items-center justify-center py-2 px-1.5 rounded-xl bg-slate-800/40 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Players</span>
              <span className="mt-0.5 text-xs sm:text-sm font-bold text-amber-300">
                {maxPlayers ? `${maxPlayers} Players` : '4 Players'}
              </span>
            </div>

            {/* Turn Time */}
            <div className="flex flex-col items-center justify-center py-2 px-1.5 rounded-xl bg-slate-800/40 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Turn Time</span>
              <span className="mt-0.5 text-xs sm:text-sm font-bold text-amber-300">
                {turnTimeLimit === null ? 'Unlimited' : `${turnTimeLimit}s`}
              </span>
            </div>

            {/* Auto-close */}
            <div className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border ${
              timeLeft <= 120
                ? 'bg-rose-900/30 border-rose-500/40'
                : 'bg-slate-800/40 border-white/5'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                timeLeft <= 120 ? 'text-rose-300' : 'text-slate-400'
              }`}>
                <Clock className={`w-3 h-3 ${timeLeft <= 120 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                {timeLeft <= 120 ? 'Closing' : 'Auto-close'}
              </span>
              <span className={`mt-0.5 font-mono text-xs sm:text-sm font-bold ${
                timeLeft <= 120 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
              }`}>
                {formatCountdown(timeLeft)}
              </span>
            </div>
          </div>
          {isDebugRoom && (
            <div className="mt-1.5 text-center text-xs font-semibold text-rose-300">
              🐞 Debug room
            </div>
          )}
        </div>

        {/* Player List */}
        <div className="w-full bg-slate-900/80 border border-slate-700/50 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
          <PlayerList players={players} myPlayerId={myPlayerId} maxPlayers={maxPlayers} />

          {isHost && players.length < 2 && (
            <div className="flex items-center justify-center gap-2 mt-4 select-none">
              <span className="text-amber-300 text-xs sm:text-sm slow-twinkle">✨</span>
              <p className="text-center font-bold text-xs sm:text-sm tracking-wide gold-shimmer-text">
                Waiting for other players to join...
              </p>
              <span className="text-amber-300 text-xs sm:text-sm slow-twinkle-delayed">✨</span>
            </div>
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
          <div className="flex items-center justify-center gap-2 py-2 select-none">
            <span className="text-amber-300 text-xs sm:text-sm slow-twinkle">✨</span>
            <p className="text-center font-bold text-xs sm:text-sm tracking-wide gold-shimmer-text">
              {isSpectator ? '👁 Watching: the board opens when the host starts' : 'Waiting for host to start...'}
            </p>
            <span className="text-amber-300 text-xs sm:text-sm slow-twinkle-delayed">✨</span>
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
