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
      const effectiveMax = (room.max_players !== undefined && room.max_players !== null)
        ? room.max_players
        : (initialSession?.maxPlayers ?? 4);
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

        <div className={`w-full rounded-3xl border p-2.5 sm:p-3 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
          timeLeft <= 120
            ? 'bg-rose-950/40 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
            : 'bg-gradient-to-br from-[#13153c]/90 via-slate-900/95 to-slate-950/98 border-indigo-400/30 shadow-[0_12px_40px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.12)]'
        }`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-center">
            {/* Mode */}
            <div className="flex flex-col items-center justify-center py-2.5 px-1.5 rounded-2xl bg-slate-800/40 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mode</span>
              <span className="mt-0.5 text-xs sm:text-sm font-bold text-amber-300 truncate max-w-full">
                {gameMode === 'HP' ? `HP Battle (${startingHp ?? 100})` : `${maxTurns} Rounds`}
              </span>
            </div>

            {/* Players */}
            <div className="flex flex-col items-center justify-center py-2.5 px-1.5 rounded-2xl bg-slate-800/40 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Players</span>
              <span className="mt-0.5 text-xs sm:text-sm font-bold text-amber-300">
                {maxPlayers ? `${maxPlayers} Players` : '4 Players'}
              </span>
            </div>

            {/* Turn Time */}
            <div className="flex flex-col items-center justify-center py-2.5 px-1.5 rounded-2xl bg-slate-800/40 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Turn Time</span>
              <span className="mt-0.5 text-xs sm:text-sm font-bold text-amber-300">
                {turnTimeLimit === null ? 'Unlimited' : `${turnTimeLimit}s`}
              </span>
            </div>

            {/* Auto-close */}
            <div className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-2xl border ${
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
            <div className="mt-2 text-center text-xs font-semibold text-rose-300">
              🐞 Debug room
            </div>
          )}
        </div>

        {/* Player List */}
        <div className="w-full rounded-3xl border border-indigo-400/25 bg-gradient-to-b from-[#111335]/90 via-[#0c0e29]/95 to-slate-950/98 p-5 sm:p-6 shadow-[0_16px_50px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-xl">
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
            className="tactile-button group relative w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:via-teal-300 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-lg sm:text-xl uppercase tracking-wider shadow-[0_10px_35px_rgba(16,185,129,0.4)] hover:shadow-[0_14px_45px_rgba(16,185,129,0.55)] cursor-pointer flex items-center justify-center gap-2.5 border border-emerald-300/50 transition-all hover:scale-[1.01] active:scale-98"
          >
            {starting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Launching match...</span>
              </span>
            ) : (
              <>
                <span className="group-hover:scale-110 transition-transform duration-150">▶</span>
                <span>Start Game</span>
              </>
            )}
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
          className="tactile-button py-2 px-4 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 text-xs sm:text-sm transition-all disabled:opacity-40 cursor-pointer font-medium"
        >
          {leaving ? 'Leaving...' : isSpectator ? '← Stop watching' : '← Leave lobby'}
        </button>
      </div>
    </div>
  );
}
