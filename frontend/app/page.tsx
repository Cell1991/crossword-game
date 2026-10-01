'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, BookOpen, Bot, Clock, Eye, LogIn, Minus, Plus, RefreshCw, Users, User, X } from 'lucide-react';
import { createRoom, getRoom, getRooms, joinRoom, sessionStore } from '@/lib/api';
import { GameMode, RoomSummary, TurnTimeLimit } from '@/lib/types';
import ParticleField from '@/components/effects/ParticleField';
import FullscreenButton from '@/components/ui/FullscreenButton';
import CustomSelect from '@/components/ui/CustomSelect';
import { GameGuideModal } from '@/components/game/GameGuideModal';

type Mode = 'home' | 'create' | 'join' | 'bot';
type BotDifficulty = 'easy' | 'medium' | 'hard';

export const BOT_PROFILES: Record<BotDifficulty, { name: string; title: string; desc: string; badge: string }> = {
  easy: {
    name: 'SparkBot',
    title: 'Easy',
    desc: 'Novice AI • Relaxed word strategy',
    badge: 'Novice',
  },
  medium: {
    name: 'Nexus AI',
    title: 'Medium',
    desc: 'Tactical AI • Balanced & strategic',
    badge: 'Tactical',
  },
  hard: {
    name: 'Titan AI',
    title: 'Hard',
    desc: 'Master AI • Aggressive & high scoring',
    badge: 'Master',
  },
};

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('home');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(null);
  const [gameMode, setGameMode] = useState<GameMode>('HP');
  const [turnCountOption, setTurnCountOption] = useState('7');
  const [customTurnCount, setCustomTurnCount] = useState('28');
  const [hpOption, setHpOption] = useState('100');
  const [customHp, setCustomHp] = useState('100');
  const [playerLimitOption, setPlayerLimitOption] = useState<'4' | '6' | '8' | '10' | 'custom'>('4');
  const [customMaxPlayers, setCustomMaxPlayers] = useState('10');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const fetchRooms = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingRooms(true);
    try {
      const data = await getRooms();
      setRooms(Array.isArray(data) ? data : []);
      setRoomsError(null);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      const rawMsg = err instanceof Error ? err.message : 'Unable to load rooms';
      const friendlyMsg = rawMsg.includes('405') || rawMsg.toLowerCase().includes('method not allowed')
        ? 'Connecting to rooms...'
        : rawMsg;
      setRoomsError(friendlyMsg);
    } finally {
      if (showLoading) setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'bot') {
        setMode('bot');
      }
      if (params.get('kicked') === 'expired') {
        setError('This room has been dissolved due to 10 minutes of inactivity.');
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  useEffect(() => {
    if (mode === 'join') {
      fetchRooms(true);
      const timer = setInterval(() => {
        fetchRooms(false);
      }, 6000);
      return () => clearInterval(timer);
    }
  }, [mode, fetchRooms]);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    const maxTurns = turnCountOption === 'custom' ? Number(customTurnCount) : Number(turnCountOption);
    if (gameMode === 'TURNS' && (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 500)) {
      setError('Turn count must be between 1 and 500');
      return;
    }
    const startingHp = hpOption === 'custom' ? Number(customHp) : Number(hpOption);
    if (gameMode === 'HP' && (!Number.isInteger(startingHp) || startingHp < 10 || startingHp > 1000)) {
      setError('Starting HP must be between 10 and 1000');
      return;
    }
    const parsedCustomPlayers = Number(customMaxPlayers);
    if (playerLimitOption === 'custom' && (!Number.isInteger(parsedCustomPlayers) || parsedCustomPlayers < 2 || parsedCustomPlayers > 50)) {
      setError('Player limit must be between 2 and 50');
      return;
    }
    const maxPlayers = playerLimitOption === 'custom' ? parsedCustomPlayers : (Number(playerLimitOption) || 4);

    setLoading(true);
    setError('');
    try {
      const res = await createRoom(
        name.trim(),
        turnTimeLimit,
        gameMode,
        gameMode === 'TURNS' ? maxTurns : null,
        false,
        gameMode === 'HP' ? startingHp : null,
        maxPlayers,
      );
      sessionStore.save({
        gameId: res.game_id,
        playerId: res.host_player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: true,
        gamePin: res.game_pin,
        turnTimeLimit: res.turn_time_limit,
        gameMode: res.game_mode,
        maxTurns: res.max_turns,
        startingHp: res.starting_hp,
        maxPlayers: maxPlayers ?? res.max_players ?? 4,
        createdAt: res.created_at,
      });
      router.push(`/lobby/${res.game_pin}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBot = async () => {
    const maxTurns = turnCountOption === 'custom' ? Number(customTurnCount) : Number(turnCountOption);
    if (gameMode === 'TURNS' && (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 500)) {
      setError('Turn count must be between 1 and 500');
      return;
    }
    const startingHp = hpOption === 'custom' ? Number(customHp) : Number(hpOption);
    if (gameMode === 'HP' && (!Number.isInteger(startingHp) || startingHp < 10 || startingHp > 1000)) {
      setError('Starting HP must be between 10 and 1000');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const selectedBot = BOT_PROFILES[botDifficulty];
      const botDisplayName = `${selectedBot.name} [Bot]`;
      const hostDisplayName = name.trim() || 'Player';

      const res = await createRoom(
        hostDisplayName,
        turnTimeLimit,
        gameMode,
        gameMode === 'TURNS' ? maxTurns : null,
        false,
        gameMode === 'HP' ? startingHp : null,
        2,
      );

      sessionStore.save({
        gameId: res.game_id,
        playerId: res.host_player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: true,
        gamePin: res.game_pin,
        turnTimeLimit: res.turn_time_limit,
        gameMode: res.game_mode,
        maxTurns: res.max_turns,
        startingHp: res.starting_hp,
        maxPlayers: 2,
        createdAt: res.created_at,
      });

      try {
        await joinRoom(res.game_pin, botDisplayName);
      } catch (botErr) {
        console.warn('Bot auto-join notice:', botErr);
      }

      router.push(`/lobby/${res.game_pin}?bot=${botDifficulty}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to create bot room');
    } finally {
      setLoading(false);
    }
  };

  const executeJoin = async (pinToJoin: string, playerName: string) => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      nameInputRef.current?.focus();
      return;
    }
    if (!pinToJoin.trim()) {
      setError('Please enter the game PIN');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await joinRoom(pinToJoin.trim(), playerName.trim());
      sessionStore.save({
        gameId: res.game_id,
        playerId: res.player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: res.is_host,
        gamePin: pinToJoin.trim(),
        hostPlayerId: res.host_player_id,
        turnTimeLimit: res.turn_time_limit,
        gameMode: res.game_mode,
        maxTurns: res.max_turns,
        startingHp: res.starting_hp,
        maxPlayers: (res.max_players !== undefined && res.max_players !== null) ? res.max_players : 4,
        createdAt: res.created_at,
      });
      router.push(`/lobby/${pinToJoin.trim()}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    await executeJoin(pin, name);
  };

  /** Spectators need only the PIN: they take no seat, so they can come in before or during a game. */
  const executeWatch = async (pinToWatch: string) => {
    if (!pinToWatch.trim()) { setError('Please enter the game PIN'); return; }
    setLoading(true);
    setError('');
    try {
      const room = await getRoom(pinToWatch.trim());
      const spectatorLimit = 2;
      const seatsAreFull = room.players.length >= 6;
      const spectatorGalleryIsFull = room.spectator_count >= spectatorLimit;
      if (seatsAreFull && spectatorGalleryIsFull) {
        setError('This room is full for both players and spectators. Please choose another room.');
        return;
      }
      if (!seatsAreFull && spectatorGalleryIsFull) {
        setError('Spectator gallery is full, but player seats are still available in this room.');
        return;
      }
      sessionStore.save({
        gameId: room.id,
        playerId: '',
        token: '',
        displayName: name.trim() || 'Spectator',
        isHost: false,
        gamePin: room.game_pin,
        isSpectator: true,
      });
      const debugParam = room.is_debug ? '?debug=1' : '';
      router.push(room.status === 'WAITING' ? `/lobby/${room.game_pin}` : `/game/${room.id}${debugParam}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to find room');
    } finally {
      setLoading(false);
    }
  };

  const handleWatch = async () => {
    await executeWatch(pin);
  };

  const handleSelectRoom = (room: RoomSummary) => {
    setPin(room.game_pin);
    setError('');
    if (room.status === 'WAITING' && !name.trim()) {
      nameInputRef.current?.focus();
    }
  };

  const selectedRoom = rooms.find(r => r.game_pin === pin.trim());
  const isSelectedRoomPlaying = selectedRoom?.status === 'PLAYING';


  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(99,102,241,0.16),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_58%,#171942_100%)] px-4 py-6 sm:py-12">
      <ParticleField className="pointer-events-none fixed inset-0 h-full w-full" />
      <FullscreenButton className="fixed top-3.5 right-3.5 z-40" />

      <div className="relative z-10 my-auto flex w-full max-w-[28rem] flex-col items-center gap-6 sm:gap-8">
        {/* Logo / Title */}
        <div className="relative text-center flex flex-col items-center">
          {/* 3D Cube Logo with layered glowing aura */}
          <div className="relative mb-2 sm:mb-3 flex items-center justify-center">
            {/* Multi-layered dynamic neon ambient halos */}
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-gradient-to-tr from-indigo-500/35 via-amber-400/25 to-amber-500/40 blur-2xl hero-glow-breathe" />
            <div className="pointer-events-none absolute h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-amber-400/25 blur-xl" />

            {/* Floating 3D Logo */}
            <div className="relative hero-logo-float transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer">
              <Image
                src="/wordx-icon-256.png?v=20260915"
                alt="WordX logo"
                width={140}
                height={140}
                priority
                className="h-24 w-24 sm:h-32 sm:w-32 object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.65)] drop-shadow-[0_0_30px_rgba(245,158,11,0.45)]"
              />
            </div>
          </div>

          {/* Prominent, Majestic WordX Title */}
          <div className="relative select-none">
            {/* Subtle glow behind title */}
            <div className="pointer-events-none absolute -inset-x-8 -inset-y-4 rounded-full bg-gradient-to-r from-indigo-500/20 via-amber-400/30 to-orange-500/25 blur-2xl opacity-80" />

            <h1 className="relative text-5xl sm:text-6xl sm:text-[4.25rem] font-black tracking-[-0.03em] leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)]">
              <span className="bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent [text-shadow:0_2px_16px_rgba(255,255,255,0.35)]">
                Word
              </span>
              <span className="relative inline-block bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(245,158,11,0.9)] drop-shadow-[0_4px_16px_rgba(217,119,6,0.7)] ml-0.5">
                X
              </span>
            </h1>
          </div>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl sm:rounded-[1.75rem] border border-white/[0.1] bg-slate-900/90 sm:bg-slate-900/65 sm:backdrop-blur-md p-4 sm:p-5 shadow-[0_28px_90px_rgba(2,6,23,0.38)]">

          {mode === 'home' && (
            <div className="flex flex-col gap-3">
              {error && (
                error.toLowerCase().includes('dissolved') ? (
                  <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-slate-800/90 to-amber-500/10 p-3.5 sm:p-4 shadow-[0_6px_25px_rgba(245,158,11,0.15)] backdrop-blur-md">
                    {/* Glowing gold ambient accent line */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500" />
                    
                    <div className="flex items-start justify-between gap-3 pl-1">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                          <Clock className="h-4.5 w-4.5" strokeWidth={2.2} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                              Room Dissolved
                            </h4>
                            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-400/25">
                              10m Timeout
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-300">
                            Closed after 10 minutes of inactivity.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setError('')}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        aria-label="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300 font-medium">
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="ml-2 text-rose-400 hover:text-white text-xs font-bold cursor-pointer"
                      aria-label="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              )}
              <div className="flex items-center justify-between px-1 pb-1">
                <div>
                  <p className="text-sm font-semibold text-white">Start playing</p>
                  <p className="mt-0.5 text-xs text-slate-400">Choose how you want to enter</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" aria-label="Online" />
              </div>
              <button
                onClick={() => { setMode('create'); setError(''); }}
                className="group flex w-full items-center justify-between rounded-xl sm:rounded-2xl border border-amber-200/50 bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-3.5 sm:px-5 sm:py-4 text-left text-slate-950 shadow-[0_14px_34px_rgba(245,158,11,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:from-amber-200 hover:to-amber-300 hover:shadow-[0_18px_42px_rgba(245,158,11,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950/10">
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                  <span>
                    <span className="block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-800/70">New session</span>
                    <span className="block text-lg font-bold tracking-tight">Create Game</span>
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <div className="flex items-stretch gap-2 sm:gap-2.5 w-full">
                <button
                  onClick={() => { setMode('join'); setError(''); }}
                  className="group flex flex-1 items-center justify-between rounded-xl sm:rounded-2xl border border-white/[0.12] bg-gradient-to-r from-white/[0.09] to-white/[0.05] px-3.5 py-3 sm:px-5 sm:py-4 text-left text-white shadow-[0_12px_30px_rgba(2,6,23,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200/30 hover:from-indigo-300/[0.14] hover:to-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0 min-w-0"
                >
                  <span className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-300/15 text-indigo-200">
                      <LogIn className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.62rem] sm:text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Have a PIN?</span>
                      <span className="block text-base sm:text-lg font-bold tracking-tight truncate">Join Game</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 sm:h-5 w-4 sm:w-5 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white ml-1" />
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('bot'); setError(''); }}
                  title="Play vs Bot"
                  aria-label="Play with Bot"
                  className="group relative flex flex-col items-center justify-center shrink-0 w-20 sm:w-24 rounded-xl sm:rounded-2xl border border-white/[0.12] bg-gradient-to-r from-white/[0.09] to-white/[0.05] px-2 py-2.5 sm:py-3 text-center text-white shadow-[0_12px_30px_rgba(2,6,23,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/35 hover:from-white/[0.14] hover:to-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0 cursor-pointer"
                >
                  <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 group-hover:scale-105 group-hover:bg-amber-400/20 group-hover:text-amber-200 transition-all shadow-[0_2px_10px_rgba(245,158,11,0.15)]">
                    <Bot className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </span>
                  <span className="mt-1.5 block">
                    <span className="block text-[0.58rem] sm:text-[0.62rem] font-bold uppercase tracking-[0.16em] text-slate-400 group-hover:text-amber-300/80 transition-colors leading-none">
                      Solo
                    </span>
                    <span className="mt-0.5 block text-xs sm:text-sm font-bold tracking-tight text-slate-200 group-hover:text-white transition-colors leading-tight">
                      VS Bot
                    </span>
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="group flex w-full items-center justify-between rounded-xl sm:rounded-2xl border border-white/[0.1] bg-gradient-to-r from-slate-800/40 via-slate-800/25 to-slate-900/40 px-4 py-3 sm:px-5 sm:py-3.5 text-left text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/30 hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 active:translate-y-0 cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300/90 border border-amber-400/20">
                    <BookOpen className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <span>
                    <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Rules & Cards</span>
                    <span className="block text-base sm:text-lg font-bold tracking-tight text-slate-200 group-hover:text-white transition-colors">Game Guide</span>
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 group-hover:text-amber-200 transition-colors">
                  <span>View Guide</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="flex flex-col gap-3.5 sm:gap-4">
              {/* Header */}
              <div className="flex items-center gap-3 pb-2 border-b border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => { setMode('home'); setError(''); }}
                  className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95 cursor-pointer shrink-0"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Create Room</h2>
                </div>
              </div>

              {/* Game Mode */}
              <fieldset>
                <legend className="mb-1.5 block text-xs font-semibold text-slate-300">Game Mode</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['HP', 'HP Battle', 'Score drains health'],
                    ['TURNS', 'Turn Count', 'Highest score wins'],
                  ] as const).map(([value, title, description]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={gameMode === value}
                      onClick={() => setGameMode(value)}
                      className={`rounded-xl border p-2.5 sm:p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 cursor-pointer ${
                        gameMode === value
                          ? 'border-amber-400/80 bg-amber-400/15 text-white shadow-[0_0_15px_rgba(251,191,36,0.12)]'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:border-white/20 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className={`block text-xs sm:text-sm font-bold ${gameMode === value ? 'text-amber-200' : 'text-slate-200'}`}>
                        {title}
                      </span>
                      <span className={`mt-0.5 block text-[0.68rem] leading-snug ${gameMode === value ? 'text-amber-300/80' : 'text-slate-400'}`}>
                        {description}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Settings 2-Column: (Starting HP / Turn Count) + Turn Time */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {gameMode === 'HP' ? (
                  <div>
                    <label htmlFor="starting-hp" className="mb-1.5 block text-xs font-semibold text-slate-300">Starting HP</label>
                    <CustomSelect
                      id="starting-hp"
                      value={hpOption}
                      onChange={setHpOption}
                      options={[
                        { value: '50', label: '50 HP' },
                        { value: '100', label: '100 HP' },
                        { value: '150', label: '150 HP' },
                        { value: '200', label: '200 HP' },
                        { value: 'custom', label: 'Custom' },
                      ]}
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="max-turns" className="mb-1.5 block text-xs font-semibold text-slate-300">Game Length</label>
                    <CustomSelect
                      id="max-turns"
                      value={turnCountOption}
                      onChange={setTurnCountOption}
                      options={[
                        { value: '7', label: '7 Turns' },
                        { value: '14', label: '14 Turns' },
                        { value: '21', label: '21 Turns' },
                        { value: 'custom', label: 'Custom' },
                      ]}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="turn-time" className="mb-1.5 block text-xs font-semibold text-slate-300">Turn Time</label>
                  <CustomSelect
                    id="turn-time"
                    value={turnTimeLimit === null ? '' : String(turnTimeLimit)}
                    onChange={val => setTurnTimeLimit(val === '' ? null : Number(val) as TurnTimeLimit)}
                    options={[
                      { value: '', label: 'Unlimited' },
                      { value: '30', label: '30 sec' },
                      { value: '60', label: '60 sec' },
                      { value: '90', label: '90 sec' },
                      { value: '120', label: '120 sec' },
                    ]}
                  />
                </div>
              </div>

              {/* Custom HP Stepper */}
              {gameMode === 'HP' && hpOption === 'custom' && (
                <div className="flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-300/20 transition-all overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.max(10, (Number(prev) || 100) - 10)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Decrease HP"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={customHp}
                      onChange={event => setCustomHp(event.target.value)}
                      aria-label="Custom starting HP"
                      placeholder="100"
                      className="w-full text-center font-mono font-bold text-white text-base sm:text-lg bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider select-none shrink-0">HP</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.min(1000, (Number(prev) || 100) + 10)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Increase HP"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Custom Turns Stepper */}
              {gameMode === 'TURNS' && turnCountOption === 'custom' && (
                <div className="flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-300/20 transition-all overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.max(1, (Number(prev) || 28) - 1)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Decrease turns"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={customTurnCount}
                      onChange={event => setCustomTurnCount(event.target.value)}
                      aria-label="Custom turn count"
                      placeholder="28"
                      className="w-full text-center font-mono font-bold text-white text-base sm:text-lg bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider select-none shrink-0">Turns</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.min(500, (Number(prev) || 28) + 1)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Increase turns"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Player Limit */}
              <fieldset>
                <legend className="mb-1.5 block text-xs font-semibold text-slate-300">Player Limit</legend>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {([
                    ['4', '4P'],
                    ['6', '6P'],
                    ['8', '8P'],
                    ['10', '10P'],
                    ['custom', 'Custom'],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={playerLimitOption === val}
                      onClick={() => setPlayerLimitOption(val)}
                      className={`rounded-xl border py-2.5 text-center font-bold text-xs sm:text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 cursor-pointer ${
                        playerLimitOption === val
                          ? 'border-amber-400/80 bg-amber-400/15 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)]'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:border-white/20 hover:bg-slate-800/60'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Custom Player Limit Stepper */}
              {playerLimitOption === 'custom' && (
                <div className="flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-300/20 transition-all overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCustomMaxPlayers(prev => String(Math.max(2, (Number(prev) || 10) - 1)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Decrease player limit"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={customMaxPlayers}
                      onChange={event => setCustomMaxPlayers(event.target.value)}
                      aria-label="Custom player limit"
                      placeholder="10"
                      className="w-full text-center font-mono font-bold text-white text-base sm:text-lg bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider select-none shrink-0">Players</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomMaxPlayers(prev => String(Math.min(50, (Number(prev) || 10) + 1)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Increase player limit"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Your Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Enter your name..."
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 sm:py-3 text-sm sm:text-base text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                />
              </div>

              {error && <p className="text-red-400 text-xs sm:text-sm">{error}</p>}

              {/* Action Button */}
              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full rounded-xl sm:rounded-2xl border border-amber-300/40 bg-amber-400 py-3 sm:py-3.5 text-base sm:text-lg font-bold text-slate-950 shadow-[0_10px_25px_rgba(245,158,11,0.2)] transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-px cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Room...
                  </span>
                ) : 'Create Room'}
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div className="flex flex-col gap-3.5 sm:gap-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setMode('home'); setError(''); }}
                    className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95 cursor-pointer shrink-0"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Join Game</h2>
                </div>
                <button
                  type="button"
                  onClick={() => fetchRooms(true)}
                  disabled={loadingRooms}
                  aria-label="Refresh rooms"
                  title="Refresh active rooms"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-amber-300 hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingRooms ? 'animate-spin text-amber-400' : ''}`} />
                </button>
              </div>

              {/* Your Name Input */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs font-bold tracking-wide text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-amber-400" />
                    Your Name
                  </span>
                  {name.trim() && (
                    <span className="text-[10px] font-semibold text-emerald-400">Ready</span>
                  )}
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 sm:py-3 text-sm sm:text-base text-white outline-none transition-all placeholder:text-slate-500 hover:border-white/20 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>

              {/* Active Rooms */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <label className="text-xs font-bold tracking-wide text-slate-200">
                      Active Rooms {rooms.length > 0 && `(${rooms.length})`}
                    </label>
                  </div>
                  {loadingRooms && (
                    <span className="text-[10px] font-medium text-amber-300 animate-pulse">Refreshing...</span>
                  )}
                </div>

                {roomsError ? (
                  <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    <span className="truncate max-w-[210px]">{roomsError}</span>
                    <button
                      type="button"
                      onClick={() => fetchRooms(true)}
                      className="font-semibold text-amber-300 hover:text-amber-200 underline cursor-pointer shrink-0 ml-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : rooms.length > 0 ? (
                  <div className="max-h-52 overflow-y-auto grid grid-cols-2 gap-2 pr-1 custom-scrollbar">
                    {rooms.map(room => {
                      const isFull = Boolean(room.max_players && room.player_count >= room.max_players);
                      const isPlaying = room.status === 'PLAYING';
                      const isSelected = pin === room.game_pin;
                      const isSingle = rooms.length === 1;
                      return (
                        <div
                          key={room.id}
                          onClick={() => handleSelectRoom(room)}
                          className={`group relative flex items-center gap-2 sm:gap-2.5 p-2 sm:p-2.5 rounded-xl border transition-all duration-200 cursor-pointer select-none active:scale-[0.98] ${
                            isSingle ? 'col-span-2' : ''
                          } ${
                            isSelected
                              ? 'border-amber-400 bg-slate-800/90 shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/50'
                              : 'border-white/10 bg-slate-800/50 hover:bg-slate-800/80 hover:border-white/20'
                          }`}
                        >
                          {/* Host Avatar Badge - Clean, balanced, no protruding dots */}
                          <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-slate-950 font-black text-xs sm:text-sm shadow-[0_2px_10px_rgba(245,158,11,0.25)]">
                            {(room.host_name || 'H').charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-white group-hover:text-amber-200 transition-colors truncate" title={room.host_name}>
                                {room.host_name}
                              </span>
                              {isPlaying ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 text-[9px] font-bold text-rose-400 shrink-0">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  LIVE
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 shrink-0">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  Open
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] mt-0.5">
                              <span className="font-mono font-bold text-amber-300 shrink-0">
                                #{room.game_pin}
                              </span>
                              <span className="text-slate-500 shrink-0">•</span>
                              <span className={`truncate font-medium ${isPlaying ? 'text-slate-300' : isFull ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {room.player_count}{room.max_players ? `/${room.max_players}` : ''} Players
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-slate-800/20 py-3 text-center">
                    <p className="text-xs text-slate-400">No active rooms</p>
                  </div>
                )}
              </div>

              {/* Clean Divider */}
              <div className="my-0.5 border-t border-white/[0.08]" />

              {/* Integrated Game PIN Row */}
              <div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (isSelectedRoomPlaying) {
                          handleWatch();
                        } else {
                          handleJoin();
                        }
                      }
                    }}
                    placeholder="6-digit PIN..."
                    maxLength={6}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/80 pl-3.5 pr-24 py-2.5 sm:py-3 font-mono text-sm sm:text-base tracking-[0.2em] text-amber-300 outline-none transition-all placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-sans hover:border-white/20 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                  <button
                    type="button"
                    onClick={isSelectedRoomPlaying ? handleWatch : handleJoin}
                    disabled={loading || !pin.trim()}
                    className="group absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:via-amber-400 hover:to-orange-400 px-4 text-xs sm:text-sm font-black text-slate-950 shadow-[0_2px_14px_rgba(245,158,11,0.35)] hover:shadow-[0_2px_20px_rgba(245,158,11,0.5)] transition-all duration-200 disabled:opacity-35 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:from-amber-400 disabled:hover:via-amber-500 disabled:hover:to-orange-500 active:scale-95 cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>{isSelectedRoomPlaying ? 'Watching' : 'Joining'}</span>
                      </span>
                    ) : isSelectedRoomPlaying ? (
                      <>
                        <Eye className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Watch</span>
                      </>
                    ) : (
                      <>
                        <span>Join</span>
                        <ArrowRight className="h-3.5 w-3.5 stroke-[2.8] transition-transform duration-200 group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 font-medium">
                  {error}
                </div>
              )}

              {/* Spectator Option */}
              <button
                type="button"
                onClick={handleWatch}
                disabled={loading || !pin.trim()}
                className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer ${
                  isSelectedRoomPlaying
                    ? 'text-sky-300 hover:text-sky-200'
                    : 'text-slate-400 hover:text-amber-300 disabled:hover:text-slate-400'
                }`}
                title="Watch game without playing (requires PIN)"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>
                  {isSelectedRoomPlaying
                    ? `Watch live match #${pin.trim()}`
                    : `Watch as spectator ${pin.trim() ? `(#${pin.trim()})` : ''}`}
                </span>
              </button>
            </div>
          )}

          {mode === 'bot' && (
            <div className="flex flex-col gap-3.5 sm:gap-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setMode('home'); setError(''); }}
                    className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95 cursor-pointer shrink-0"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                      <span>Play vs Bot</span>
                      <span className="flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                        <Bot className="w-3 h-3" /> Solo Match
                      </span>
                    </h2>
                  </div>
                </div>
              </div>

              {/* Bot Difficulty Selection */}
              <fieldset>
                <legend className="mb-1.5 block text-xs font-semibold text-slate-300">Bot Difficulty</legend>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['easy', 'Easy', 'SparkBot', 'Novice'],
                    ['medium', 'Medium', 'Nexus AI', 'Tactical'],
                    ['hard', 'Hard', 'Titan AI', 'Master'],
                  ] as const).map(([val, title, botName, level]) => (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={botDifficulty === val}
                      onClick={() => setBotDifficulty(val)}
                      className={`rounded-xl border p-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 cursor-pointer ${
                        botDifficulty === val
                          ? 'border-amber-400/80 bg-amber-400/15 text-white shadow-[0_0_15px_rgba(251,191,36,0.12)]'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:border-white/20 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className={`block text-xs sm:text-sm font-bold ${botDifficulty === val ? 'text-amber-200' : 'text-slate-200'}`}>
                        {title}
                      </span>
                      <span className={`mt-0.5 block text-[0.65rem] truncate font-medium ${botDifficulty === val ? 'text-amber-300/90' : 'text-slate-400'}`}>
                        {botName}
                      </span>
                      <span className={`mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                        botDifficulty === val ? 'bg-amber-400/25 text-amber-200' : 'bg-slate-700/50 text-slate-400'
                      }`}>
                        {level}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Game Mode */}
              <fieldset>
                <legend className="mb-1.5 block text-xs font-semibold text-slate-300">Game Mode</legend>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['HP', 'HP Battle', 'Score drains health'],
                    ['TURNS', 'Turn Count', 'Highest score wins'],
                  ] as const).map(([value, title, description]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={gameMode === value}
                      onClick={() => setGameMode(value)}
                      className={`rounded-xl border p-2.5 sm:p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 cursor-pointer ${
                        gameMode === value
                          ? 'border-amber-400/80 bg-amber-400/15 text-white shadow-[0_0_15px_rgba(251,191,36,0.12)]'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:border-white/20 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className={`block text-xs sm:text-sm font-bold ${gameMode === value ? 'text-amber-200' : 'text-slate-200'}`}>
                        {title}
                      </span>
                      <span className={`mt-0.5 block text-[0.68rem] leading-snug ${gameMode === value ? 'text-amber-300/80' : 'text-slate-400'}`}>
                        {description}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Settings 2-Column: (Starting HP / Turn Count) + Turn Time */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {gameMode === 'HP' ? (
                  <div>
                    <label htmlFor="bot-starting-hp" className="mb-1.5 block text-xs font-semibold text-slate-300">Starting HP</label>
                    <CustomSelect
                      id="bot-starting-hp"
                      value={hpOption}
                      onChange={setHpOption}
                      options={[
                        { value: '50', label: '50 HP' },
                        { value: '100', label: '100 HP' },
                        { value: '150', label: '150 HP' },
                        { value: '200', label: '200 HP' },
                        { value: 'custom', label: 'Custom' },
                      ]}
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="bot-max-turns" className="mb-1.5 block text-xs font-semibold text-slate-300">Game Length</label>
                    <CustomSelect
                      id="bot-max-turns"
                      value={turnCountOption}
                      onChange={setTurnCountOption}
                      options={[
                        { value: '7', label: '7 Turns' },
                        { value: '14', label: '14 Turns' },
                        { value: '21', label: '21 Turns' },
                        { value: 'custom', label: 'Custom' },
                      ]}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="bot-turn-time" className="mb-1.5 block text-xs font-semibold text-slate-300">Turn Time</label>
                  <CustomSelect
                    id="bot-turn-time"
                    value={turnTimeLimit === null ? '' : String(turnTimeLimit)}
                    onChange={val => setTurnTimeLimit(val === '' ? null : Number(val) as TurnTimeLimit)}
                    options={[
                      { value: '', label: 'Unlimited' },
                      { value: '30', label: '30 sec' },
                      { value: '60', label: '60 sec' },
                      { value: '90', label: '90 sec' },
                      { value: '120', label: '120 sec' },
                    ]}
                  />
                </div>
              </div>

              {/* Custom HP / Turn Stepper if selected */}
              {gameMode === 'HP' && hpOption === 'custom' && (
                <div className="flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-300/20 transition-all overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.max(10, (Number(prev) || 100) - 10)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Decrease HP"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={customHp}
                      onChange={event => setCustomHp(event.target.value)}
                      aria-label="Custom starting HP"
                      placeholder="100"
                      className="w-full text-center font-mono font-bold text-white text-base sm:text-lg bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider select-none shrink-0">HP</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.min(1000, (Number(prev) || 100) + 10)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Increase HP"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {gameMode === 'TURNS' && turnCountOption === 'custom' && (
                <div className="flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-300/20 transition-all overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.max(1, (Number(prev) || 28) - 1)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Decrease turns"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center justify-center gap-1.5 px-2">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={customTurnCount}
                      onChange={event => setCustomTurnCount(event.target.value)}
                      aria-label="Custom turn count"
                      placeholder="28"
                      className="w-full text-center font-mono font-bold text-white text-base sm:text-lg bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider select-none shrink-0">Turns</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.min(500, (Number(prev) || 28) + 1)))}
                    className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                    aria-label="Increase turns"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Opponent Preview Banner */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-800/60 px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="text-slate-400 font-medium">Matchup:</span>
                  <span className="font-bold text-white">You</span>
                  <span className="text-amber-400 font-bold">vs</span>
                  <span className="font-bold text-amber-300">{BOT_PROFILES[botDifficulty].name}</span>
                </div>
                <span className="text-[10px] font-bold text-amber-300/90 uppercase tracking-wider bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  1v1 Match
                </span>
              </div>

              {error && <p className="text-red-400 text-xs sm:text-sm">{error}</p>}

              {/* Action Button */}
              <button
                onClick={handleCreateBot}
                disabled={loading}
                className="w-full rounded-xl sm:rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-400 to-amber-500 py-3 sm:py-3.5 text-base sm:text-lg font-bold text-slate-950 shadow-[0_10px_25px_rgba(245,158,11,0.2)] transition-all hover:from-amber-300 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-px cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Setting up Bot Room...
                  </span>
                ) : (
                  <>
                    <Bot className="h-5 w-5" strokeWidth={2.2} />
                    <span>Start Bot Match</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <GameGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
