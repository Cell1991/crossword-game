'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Eye, LogIn, Minus, Plus } from 'lucide-react';
import { createRoom, getRoom, joinRoom, sessionStore } from '@/lib/api';
import { GameMode, TurnTimeLimit } from '@/lib/types';
import ParticleField from '@/components/effects/ParticleField';
import MouseGradientText from '@/components/effects/MouseGradientText';
import FullscreenButton from '@/components/ui/FullscreenButton';
import CustomSelect from '@/components/ui/CustomSelect';

type Mode = 'home' | 'create' | 'join';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('home');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(null);
  const [gameMode, setGameMode] = useState<GameMode>('HP');
  const [turnCountOption, setTurnCountOption] = useState('7');
  const [customTurnCount, setCustomTurnCount] = useState('28');
  const [hpOption, setHpOption] = useState('100');
  const [customHp, setCustomHp] = useState('100');

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
      });
      router.push(`/lobby/${res.game_pin}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!pin.trim()) { setError('Please enter the game PIN'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await joinRoom(pin.trim(), name.trim());
      sessionStore.save({
        gameId: res.game_id,
        playerId: res.player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: res.is_host,
        gamePin: pin.trim(),
      });
      router.push(`/lobby/${pin.trim()}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  /** Spectators need only the PIN: they take no seat, so they can come in before or during a game. */
  const handleWatch = async () => {
    if (!pin.trim()) { setError('Please enter the game PIN'); return; }
    setLoading(true);
    setError('');
    try {
      const room = await getRoom(pin.trim());
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

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(99,102,241,0.16),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_58%,#171942_100%)] px-4 py-6 sm:py-12">
      <ParticleField className="pointer-events-none fixed inset-0 h-full w-full" />
      <FullscreenButton className="fixed top-3.5 right-3.5 z-40" />

      <div className="relative z-10 my-auto flex w-full max-w-[28rem] flex-col items-center gap-6 sm:gap-8">
        {/* Logo / Title */}
        <div className="text-center">
          <Image
            src="/wordx-icon-256.png?v=20260915"
            alt="WordX logo"
            width={112}
            height={112}
            priority
            className="mx-auto mb-2 h-20 w-20 sm:h-28 sm:w-28 object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.42)] transition-transform hover:scale-105"
          />
          <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-amber-300/80">Real-time word play</p>
          <h1 className="text-4xl sm:text-5xl sm:text-[3.4rem] font-black tracking-[-0.04em] leading-none">
            <MouseGradientText>WordX</MouseGradientText>
          </h1>
          <p className="mt-2 text-xs sm:text-sm font-medium tracking-wide text-slate-400">Multiplayer Crossword Game</p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl sm:rounded-[1.75rem] border border-white/[0.1] bg-slate-900/90 sm:bg-slate-900/65 sm:backdrop-blur-md p-4 sm:p-5 shadow-[0_28px_90px_rgba(2,6,23,0.38)]">

          {mode === 'home' && (
            <div className="flex flex-col gap-3">
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
            </div>
          )}

          {mode === 'create' && (
            <div className="flex flex-col gap-4 sm:gap-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <button onClick={() => { setMode('home'); setError(''); }} className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70">
                    ← Back
                  </button>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-300/80">Host a session</p>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Create a Room</h2>
                <p className="mt-0.5 text-xs sm:text-sm leading-5 text-slate-400">You&apos;ll be the host and receive a Game PIN to share.</p>
              </div>
              <fieldset>
                <legend className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Game Mode</legend>
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
                      className={`rounded-xl border p-2.5 sm:p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                        gameMode === value
                          ? 'border-amber-300/70 bg-amber-300/10 text-white'
                          : 'border-white/10 bg-slate-800/50 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <span className="block text-xs sm:text-sm font-bold">{title}</span>
                      <span className="mt-0.5 block text-[0.68rem] leading-snug text-slate-400">{description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {gameMode === 'HP' && (
                <div>
                  <label htmlFor="starting-hp" className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Starting Health</label>
                  <CustomSelect
                    id="starting-hp"
                    value={hpOption}
                    onChange={setHpOption}
                    options={[
                      { value: '50', label: '50 HP' },
                      { value: '100', label: '100 HP (Default)' },
                      { value: '150', label: '150 HP' },
                      { value: '200', label: '200 HP' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                  {hpOption === 'custom' && (
                    <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-300/20 transition-all overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCustomHp(prev => String(Math.max(10, (Number(prev) || 100) - 10)))}
                        className="flex items-center justify-center w-11 sm:w-12 h-11 sm:h-12 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
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
                        className="flex items-center justify-center w-11 sm:w-12 h-11 sm:h-12 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                        aria-label="Increase HP"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {gameMode === 'TURNS' && (
                <div>
                  <label htmlFor="max-turns" className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Game Length</label>
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
                  {turnCountOption === 'custom' && (
                    <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-300/20 transition-all overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCustomTurnCount(prev => String(Math.max(1, (Number(prev) || 28) - 1)))}
                        className="flex items-center justify-center w-11 sm:w-12 h-11 sm:h-12 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
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
                        className="flex items-center justify-center w-11 sm:w-12 h-11 sm:h-12 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 active:bg-slate-700 active:scale-95 transition-all cursor-pointer select-none"
                        aria-label="Increase turns"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label htmlFor="turn-time" className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Turn Time</label>
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
              <div>
                <label className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Your Name</label>
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
              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full rounded-xl sm:rounded-2xl border border-amber-300/40 bg-amber-400 py-3 sm:py-3.5 text-base sm:text-lg font-bold text-slate-950 shadow-[0_12px_30px_rgba(245,158,11,0.16)] transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-px"
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
            <div className="flex flex-col gap-4 sm:gap-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <button onClick={() => { setMode('home'); setError(''); }} className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70">
                    ← Back
                  </button>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-indigo-300/80">Enter a session</p>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Join a Game</h2>
                <p className="mt-0.5 text-xs sm:text-sm leading-5 text-slate-400">Enter the Game PIN given by the host.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 sm:py-3 text-sm sm:text-base text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Game PIN</label>
                <input
                  type="text"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="6-digit PIN"
                  maxLength={6}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 sm:py-3 text-center font-mono text-xl sm:text-2xl tracking-[0.28em] text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/20"
                />
              </div>
              {error && <p className="text-red-400 text-xs sm:text-sm">{error}</p>}
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full rounded-xl sm:rounded-2xl border border-indigo-300/30 bg-indigo-500 py-3 sm:py-3.5 text-base sm:text-lg font-bold text-white shadow-[0_12px_30px_rgba(99,102,241,0.18)] transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-px"
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
                className="-mt-1.5 sm:-mt-3 flex w-full items-center justify-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-white/10 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 transition-all hover:border-sky-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                title="Watch the game without playing (only the PIN is needed)"
              >
                <Eye className="h-4 w-4" />
                Watch as spectator
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[0.65rem] sm:text-[0.68rem] font-medium uppercase tracking-[0.2em] text-slate-500">
          Think sharp · play together · score big
        </p>
      </div>
    </div>
  );
}
