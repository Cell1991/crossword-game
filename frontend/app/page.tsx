'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
          <div className="text-6xl mb-3">🔤</div>
          <h1 className="text-5xl font-black tracking-tight">
            <MouseGradientText>WordBattle</MouseGradientText>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Multiplayer Crossword Game</p>
        </div>

        {/* Card */}
        <div className="w-full bg-slate-900/80 border border-slate-700/50 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">

          {mode === 'home' && (
            <div className="flex flex-col gap-4">
              <button
                onClick={() => { setMode('create'); setError(''); }}
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg transition-all shadow-lg shadow-amber-500/20 active:scale-95"
              >
                🎮 Create Game
              </button>
              <button
                onClick={() => { setMode('join'); setError(''); }}
                className="w-full py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg transition-all border border-slate-600 active:scale-95"
              >
                🚀 Join Game
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
                className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-lg transition-all active:scale-95"
              >
                {loading ? 'Creating...' : '✨ Create Room'}
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
                className="w-full py-4 rounded-2xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg transition-all active:scale-95"
              >
                {loading ? 'Joining...' : '🚀 Join Game'}
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
