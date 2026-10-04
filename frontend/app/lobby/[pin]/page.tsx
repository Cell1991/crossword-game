'use client';

import React, { startTransition, useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getRoom, leaveRoom, startGame, sessionStore } from '@/lib/api';
import { PinDisplay } from '@/components/lobby/PinDisplay';
import { PlayerList } from '@/components/lobby/PlayerList';
import ParticleField from '@/components/effects/ParticleField';
import FullscreenButton from '@/components/ui/FullscreenButton';
import { GameMode, Player } from '@/lib/types';
import { Clock, Play, LogOut, Swords, Users, Timer, Sparkles, ShieldAlert } from 'lucide-react';

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
    <div className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-col items-center justify-between overflow-hidden bg-[#030712] p-3 sm:p-5 text-slate-100 select-none selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Layer 0: Dark Cosmic Void & Dynamic Ambient Nebulas */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-gradient-to-b from-indigo-600/20 via-amber-500/10 to-transparent blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-20 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      {/* Layer 1: Sleek Uniform Small Golden Grid */}
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(245, 158, 11, 0.16) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(245, 158, 11, 0.16) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
            backgroundPosition: 'center center',
            maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 45%, transparent 95%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 45%, transparent 95%)',
          }}
        />
      </div>

      {/* Layer 2: Subtle Ambient Rising Beams & Particle Matrix */}
      <ParticleField className="pointer-events-none fixed inset-0 z-[2] h-full w-full" accent="245, 158, 11" />
      <FullscreenButton className="fixed top-3.5 right-3.5 z-40" />

      {/* CENTER STAGE (Zero Scroll 100dvh) */}
      <main className="relative z-20 flex w-full max-w-[550px] flex-1 flex-col items-center justify-center my-auto gap-3.5 sm:gap-4">
        
        {/* Game PIN Display Box */}
        <PinDisplay pin={pin} />

        {/* Match Rules & Room Status Bar */}
        <div className={`w-full rounded-2xl border p-2.5 sm:p-3 shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
          timeLeft <= 120
            ? 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.25)]'
            : 'bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 border-amber-400/30 shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(251,191,36,0.12)] ring-1 ring-amber-400/20'
        }`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 text-center">
            {/* Mode */}
            <div className="flex flex-col items-center justify-center py-2 px-1.5 rounded-xl bg-slate-900/80 border border-amber-400/15">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-200/70 flex items-center gap-1">
                <Swords className="w-3 h-3 text-amber-400" /> Mode
              </span>
              <span className="mt-0.5 text-xs sm:text-sm font-black text-amber-300 truncate max-w-full drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                {gameMode === 'HP' ? `HP Battle (${startingHp ?? 100})` : `${maxTurns} Rounds`}
              </span>
            </div>

            {/* Players */}
            <div className="flex flex-col items-center justify-center py-2 px-1.5 rounded-xl bg-slate-900/80 border border-amber-400/15">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-200/70 flex items-center gap-1">
                <Users className="w-3 h-3 text-amber-400" /> Capacity
              </span>
              <span className="mt-0.5 text-xs sm:text-sm font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                {players.length}/{maxPlayers ? `${maxPlayers}P` : '4P'}
              </span>
            </div>

            {/* Turn Time */}
            <div className="flex flex-col items-center justify-center py-2 px-1.5 rounded-xl bg-slate-900/80 border border-amber-400/15">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-200/70 flex items-center gap-1">
                <Timer className="w-3 h-3 text-amber-400" /> Turn Time
              </span>
              <span className="mt-0.5 text-xs sm:text-sm font-black text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                {turnTimeLimit === null ? 'Unlimited' : `${turnTimeLimit}s`}
              </span>
            </div>

            {/* Auto-close */}
            <div className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border ${
              timeLeft <= 120
                ? 'bg-rose-900/30 border-rose-500/50'
                : 'bg-slate-900/80 border-amber-400/15'
            }`}>
              <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                timeLeft <= 120 ? 'text-rose-300' : 'text-amber-200/70'
              }`}>
                <Clock className={`w-3 h-3 ${timeLeft <= 120 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                {timeLeft <= 120 ? 'Closing' : 'Auto-close'}
              </span>
              <span className={`mt-0.5 font-mono text-xs sm:text-sm font-black ${
                timeLeft <= 120 ? 'text-rose-400 animate-pulse' : 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]'
              }`}>
                {formatCountdown(timeLeft)}
              </span>
            </div>
          </div>
          {isDebugRoom && (
            <div className="mt-2 text-center text-xs font-bold text-rose-300 flex items-center justify-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Debug room enabled</span>
            </div>
          )}
        </div>

        {/* Player List Roster Card */}
        <div className="w-full rounded-3xl border border-amber-400/30 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 p-4 sm:p-5 shadow-[0_16px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(251,191,36,0.12)] ring-1 ring-amber-400/20 backdrop-blur-2xl relative overflow-hidden">
          {/* Top Gold Accent Line */}
          <span className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-300 to-transparent shadow-[0_0_12px_rgba(251,191,36,0.8)]" />

          <PlayerList players={players} myPlayerId={myPlayerId} maxPlayers={maxPlayers} />

          {isHost && players.length < 2 && (
            <div className="flex items-center justify-center gap-2 mt-3.5 select-none bg-amber-400/5 py-1.5 px-3 rounded-xl border border-amber-400/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 slow-twinkle" />
              <p className="text-center font-black text-[11px] sm:text-xs tracking-wide gold-shimmer-text">
                Waiting for other players to join...
              </p>
              <Sparkles className="w-3.5 h-3.5 text-amber-300 slow-twinkle-delayed" />
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="w-full text-center text-rose-300 text-xs font-bold bg-rose-950/50 border border-rose-500/40 rounded-xl px-4 py-2 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
            {error}
          </div>
        )}

        {/* Action Controls */}
        <div className="w-full flex flex-col items-center gap-2.5">
          {/* Start Button (host only) */}
          {isHost && (
            <button
              onClick={handleStart}
              disabled={starting || leaving || players.length < MIN_PLAYERS}
              className="tactile-button group relative w-full py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 hover:from-amber-200 hover:via-yellow-300 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider shadow-[0_0_30px_rgba(251,191,36,0.5),0_10px_25px_rgba(0,0,0,0.6)] hover:shadow-[0_0_40px_rgba(251,191,36,0.7),0_12px_30px_rgba(0,0,0,0.7)] cursor-pointer flex items-center justify-center gap-2.5 border-2 border-yellow-200/80 transition-all hover:scale-[1.01] active:scale-98"
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
                  <Play className="w-5 h-5 fill-slate-950 text-slate-950 group-hover:scale-110 transition-transform" />
                  <span>START MATCH</span>
                </>
              )}
            </button>
          )}

          {/* Guest / Spectator Waiting Badge */}
          {!isHost && (
            <div className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-900/80 border border-amber-400/30 shadow-[0_0_20px_rgba(251,191,36,0.15)] select-none">
              <Sparkles className="w-4 h-4 text-amber-300 slow-twinkle" />
              <p className="text-center font-black text-xs sm:text-sm tracking-wide gold-shimmer-text">
                {isSpectator ? '👁 Spectator Mode: Match starts when host begins' : 'Waiting for host to start match...'}
              </p>
              <Sparkles className="w-4 h-4 text-amber-300 slow-twinkle-delayed" />
            </div>
          )}

          {/* Leave / Exit Lobby Pill */}
          <button
            onClick={handleLeave}
            disabled={leaving || starting}
            className="tactile-button py-2 px-5 rounded-xl text-amber-200/70 hover:text-white bg-slate-900/60 hover:bg-amber-400/10 border border-amber-400/20 hover:border-amber-400/40 text-xs sm:text-sm transition-all disabled:opacity-40 cursor-pointer font-bold flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{leaving ? 'Leaving...' : isSpectator ? 'Stop Watching' : 'Leave Lobby'}</span>
          </button>
        </div>
      </main>
    </div>
  );
}

