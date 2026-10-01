'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, BookOpen, Eye, LogIn, Minus, Plus, RefreshCw, Users } from 'lucide-react';
import { createRoom, getRoom, getRooms, joinRoom, sessionStore } from '@/lib/api';
import { GameMode, RoomSummary, TurnTimeLimit } from '@/lib/types';
import ParticleField from '@/components/effects/ParticleField';
import FullscreenButton from '@/components/ui/FullscreenButton';
import CustomSelect from '@/components/ui/CustomSelect';
import { GameGuideModal } from '@/components/game/GameGuideModal';

type Mode = 'home' | 'create' | 'join';

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
        createdAt: res.created_at,
      });
      router.push(`/lobby/${res.game_pin}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to create room');
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
    if (!name.trim()) {
      nameInputRef.current?.focus();
    }
  };

  const handleQuickAction = async (room: RoomSummary) => {
    setPin(room.game_pin);
    if (room.status === 'PLAYING' || room.player_count >= room.max_players) {
      await executeWatch(room.game_pin);
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name first');
      nameInputRef.current?.focus();
      return;
    }
    await executeJoin(room.game_pin, name.trim());
  };

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
                <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError('')}
                    className="ml-2 text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
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
              <button
                onClick={() => { setMode('join'); setError(''); }}
                className="group flex w-full items-center justify-between rounded-xl sm:rounded-2xl border border-white/[0.12] bg-gradient-to-r from-white/[0.09] to-white/[0.05] px-4 py-3.5 sm:px-5 sm:py-4 text-left text-white shadow-[0_12px_30px_rgba(2,6,23,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200/30 hover:from-indigo-300/[0.14] hover:to-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-300/15 text-indigo-200">
                    <LogIn className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <span>
                    <span className="block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Have a PIN?</span>
                    <span className="block text-lg font-bold tracking-tight">Join Game</span>
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white" />
              </button>

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
                  aria-label="Refresh"
                  title="Refresh rooms"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingRooms ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
              </div>

              {/* Your Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Your Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 sm:py-3 text-sm sm:text-base text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/20"
                />
              </div>

              {/* Open Rooms */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Open Rooms {rooms.length > 0 && `(${rooms.length})`}
                  </label>
                  {loadingRooms && (
                    <span className="text-[10px] text-indigo-300 animate-pulse">Checking...</span>
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
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {rooms.map(room => {
                      const isFull = room.player_count >= room.max_players;
                      const isWaiting = room.status === 'WAITING';
                      const isSelected = pin === room.game_pin;
                      return (
                        <div
                          key={room.id}
                          onClick={() => handleSelectRoom(room)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-indigo-400/80 bg-indigo-500/15'
                              : 'border-white/10 bg-slate-800/40 hover:bg-slate-800/70 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-xs sm:text-sm text-white truncate max-w-[120px]">
                              {room.host_name}
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-1.5 py-0.5 rounded">
                              #{room.game_pin}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {room.game_mode === 'HP' ? `${room.starting_hp ?? 100} HP` : `${room.max_turns ?? 7}T`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAction(room);
                            }}
                            disabled={loading}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white transition-all cursor-pointer active:scale-95"
                          >
                            {!isWaiting || isFull ? 'Watch' : 'Join'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/5 bg-slate-800/30 px-3 py-2 text-center text-xs text-slate-400">
                    No active rooms right now
                  </div>
                )}
              </div>

              {/* Game PIN */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Game PIN</label>
                <input
                  type="text"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="6-digit PIN"
                  maxLength={6}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 sm:py-3 text-center font-mono text-xl sm:text-2xl tracking-[0.25em] text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/20"
                />
              </div>

              {error && <p className="text-red-400 text-xs sm:text-sm">{error}</p>}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleJoin}
                  disabled={loading}
                  className="w-full rounded-xl sm:rounded-2xl border border-indigo-400/40 bg-indigo-500 py-3 sm:py-3.5 text-base sm:text-lg font-bold text-white shadow-[0_10px_25px_rgba(99,102,241,0.25)] transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-px cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Joining Room...
                    </span>
                  ) : 'Join Game'}
                </button>

                <button
                  onClick={handleWatch}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 py-2.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 cursor-pointer"
                  title="Watch the game without playing (only the PIN is needed)"
                >
                  <Eye className="h-4 w-4" />
                  Watch as spectator
                </button>
              </div>
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
