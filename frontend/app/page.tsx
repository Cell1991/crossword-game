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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4">
      <ParticleField className="absolute inset-0 h-full w-full" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center gap-8">
        {/* Logo / Title */}
        <div className="text-center">
          <Image
            src="/wordx-icon.png"
            alt="WordX logo"
            width={112}
            height={112}
            priority
            className="mx-auto mb-3 h-28 w-28 object-contain drop-shadow-2xl"
          />
          <h1 className="text-5xl font-black tracking-tight">
            <MouseGradientText>WordX</MouseGradientText>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Multiplayer Crossword Game</p>
        </div>

        {/* Card */}
        <div className="w-full bg-slate-900/80 border border-slate-700/50 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">

          {mode === 'home' && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setMode('create'); setError(''); }}
                className="group flex w-full items-center justify-between rounded-2xl border border-amber-300/40 bg-amber-400 px-5 py-4 text-left text-slate-950 shadow-[0_12px_30px_rgba(245,158,11,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_16px_36px_rgba(245,158,11,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0"
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
                className="group flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4 text-left text-white shadow-[0_12px_30px_rgba(2,6,23,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0"
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
            <div className="flex flex-col gap-5">
              <div>
                <button onClick={() => { setMode('home'); setError(''); }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-4 transition-colors">
                  ← Back
                </button>
                <h2 className="text-xl font-bold text-white mb-1">Create a Room</h2>
                <p className="text-slate-400 text-sm">You&apos;ll be the host and receive a Game PIN to share</p>
              </div>
              <div>
                <label htmlFor="turn-time" className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Turn Time</label>
                <select
                  id="turn-time"
                  value={turnTimeLimit ?? ''}
                  onChange={event => setTurnTimeLimit(event.target.value === '' ? null : Number(event.target.value) as TurnTimeLimit)}
                  className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400 rounded-xl px-4 py-3 text-white outline-none transition-colors"
                >
                  <option value="">Unlimited</option>
                  <option value="30">30 sec</option>
                  <option value="60">60 sec</option>
                  <option value="90">90 sec</option>
                  <option value="120">120 sec</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Enter your name..."
                  maxLength={24}
                  className="w-full bg-slate-800 border border-slate-600 focus:border-amber-400 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors text-lg"
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
            <div className="flex flex-col gap-5">
              <div>
                <button onClick={() => { setMode('home'); setError(''); }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-4 transition-colors">
                  ← Back
                </button>
                <h2 className="text-xl font-bold text-white mb-1">Join a Game</h2>
                <p className="text-slate-400 text-sm">Enter the Game PIN given by the host</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={24}
                  className="w-full bg-slate-800 border border-slate-600 focus:border-indigo-400 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors text-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Game PIN</label>
                <input
                  type="text"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="6-digit PIN"
                  maxLength={6}
                  className="w-full bg-slate-800 border border-slate-600 focus:border-indigo-400 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-colors text-2xl font-mono tracking-widest text-center"
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

        <p className="text-slate-600 text-xs">
          Place words, score points, beat your friends!
        </p>
      </div>
    </div>
  );
}
