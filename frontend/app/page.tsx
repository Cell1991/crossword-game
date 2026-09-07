'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, LogIn, Plus } from 'lucide-react';
import { createRoom, joinRoom, sessionStore } from '../lib/api';
import { TurnTimeLimit } from '../lib/types';
import ParticleField from '../components/effects/ParticleField';
import MouseGradientText from '../components/effects/MouseGradientText';

type Mode = 'home' | 'create' | 'join';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('home');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await createRoom(name.trim(), turnTimeLimit);
      sessionStore.save({
        gameId: res.game_id,
        playerId: res.host_player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: true,
        gamePin: res.game_pin,
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(99,102,241,0.16),transparent_30%),linear-gradient(135deg,#020617_0%,#0f172a_58%,#171942_100%)] px-4 py-10 sm:py-12">
      <ParticleField className="absolute inset-0 h-full w-full" />

      <div className="relative z-10 flex w-full max-w-[29rem] flex-col items-center gap-7 sm:gap-8">
        {/* Logo / Title */}
        <div className="text-center">
          <Image
            src="/wordx-icon.png"
            alt="WordX logo"
            width={112}
            height={112}
            priority
            className="mx-auto mb-2 h-24 w-24 object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.42)] sm:h-28 sm:w-28"
          />
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.32em] text-amber-300/75">Real-time word play</p>
          <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-[3.4rem]">
            <MouseGradientText>WordX</MouseGradientText>
          </h1>
          <p className="mt-2 text-sm font-medium tracking-wide text-slate-400">Multiplayer Crossword Game</p>
        </div>

        {/* Card */}
        <div className="w-full rounded-[1.75rem] border border-white/[0.1] bg-slate-900/65 p-4 shadow-[0_28px_90px_rgba(2,6,23,0.38)] backdrop-blur-xl sm:p-5">

          {mode === 'home' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-2 pb-2">
                <div>
                  <p className="text-sm font-semibold text-white">Start playing</p>
                  <p className="mt-0.5 text-xs text-slate-500">Choose how you want to enter</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" aria-label="Online" />
              </div>
              <button
                onClick={() => { setMode('create'); setError(''); }}
                className="group flex w-full items-center justify-between rounded-2xl border border-amber-200/50 bg-gradient-to-r from-amber-300 to-amber-400 px-5 py-4 text-left text-slate-950 shadow-[0_14px_34px_rgba(245,158,11,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:from-amber-200 hover:to-amber-300 hover:shadow-[0_18px_42px_rgba(245,158,11,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950/10">
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                  </span>
                  <span>
                    <span className="block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-800/60">New session</span>
                    <span className="block text-lg font-bold tracking-tight">Create Game</span>
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => { setMode('join'); setError(''); }}
                className="group flex w-full items-center justify-between rounded-2xl border border-white/[0.12] bg-gradient-to-r from-white/[0.09] to-white/[0.05] px-5 py-4 text-left text-white shadow-[0_12px_30px_rgba(2,6,23,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200/30 hover:from-indigo-300/[0.14] hover:to-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-300/15 text-indigo-200">
                    <LogIn className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <span>
                    <span className="block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">Have a PIN?</span>
                    <span className="block text-lg font-bold tracking-tight">Join Game</span>
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white" />
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="flex flex-col gap-6">
              <div>
                <button onClick={() => { setMode('home'); setError(''); }} className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
                  ← Back
                </button>
                <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-amber-300/80">Host a session</p>
                <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">Create a Room</h2>
                <p className="text-sm leading-6 text-slate-400">You&apos;ll be the host and receive a Game PIN to share.</p>
              </div>
              <div>
                <label htmlFor="turn-time" className="mb-2 block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">Turn Time</label>
                <select
                  id="turn-time"
                  value={turnTimeLimit ?? ''}
                  onChange={event => setTurnTimeLimit(event.target.value === '' ? null : Number(event.target.value) as TurnTimeLimit)}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3.5 text-white outline-none transition-colors hover:border-white/20 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                >
                  <option value="">Unlimited</option>
                  <option value="30">30 sec</option>
                  <option value="60">60 sec</option>
                  <option value="90">90 sec</option>
                  <option value="120">120 sec</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Enter your name..."
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3.5 text-lg text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full rounded-2xl border border-amber-300/40 bg-amber-400 py-4 text-lg font-bold text-slate-950 shadow-[0_12px_30px_rgba(245,158,11,0.16)] transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-px"
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div className="flex flex-col gap-6">
              <div>
                <button onClick={() => { setMode('home'); setError(''); }} className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">
                  ← Back
                </button>
                <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-indigo-300/80">Enter a session</p>
                <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">Join a Game</h2>
                <p className="text-sm leading-6 text-slate-400">Enter the Game PIN given by the host.</p>
              </div>
              <div>
                <label className="mb-2 block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3.5 text-lg text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/20"
                />
              </div>
              <div>
                <label className="mb-2 block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-400">Game PIN</label>
                <input
                  type="text"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="6-digit PIN"
                  maxLength={6}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.28em] text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/20"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full rounded-2xl border border-indigo-300/30 bg-indigo-500 py-4 text-lg font-bold text-white shadow-[0_12px_30px_rgba(99,102,241,0.18)] transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-px"
              >
                {loading ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[0.68rem] font-medium uppercase tracking-[0.2em] text-slate-600">
          Think sharp · play together · score big
        </p>
      </div>
    </div>
  );
}
