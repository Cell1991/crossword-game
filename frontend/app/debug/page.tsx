'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bug, Minus, Plus, RefreshCw, UserPlus, Play } from 'lucide-react';
import { createRoom, getRoom, joinRoom, startGame, sessionStore, debugSessionStore, StoredSession } from '@/lib/api';
import { PinDisplay } from '@/components/lobby/PinDisplay';
import { PlayerList } from '@/components/lobby/PlayerList';
import { GameMode, Player, TurnTimeLimit } from '@/lib/types';
import CustomSelect from '@/components/ui/CustomSelect';
import ParticleField from '@/components/effects/ParticleField';

export default function DebugSetupPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [gamePin, setGamePin] = useState<string | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<Player[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Config options for debug game
  const [hostName, setHostName] = useState('Debug Player 1');
  const [gameMode, setGameMode] = useState<GameMode>('HP');
  const [hpOption, setHpOption] = useState('100');
  const [customHp, setCustomHp] = useState('100');
  const [turnCountOption, setTurnCountOption] = useState('7');
  const [customTurnCount, setCustomTurnCount] = useState('28');
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(null);

  useEffect(() => {
    if (!gamePin) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const room = await getRoom(gamePin);
        if (!cancelled) setRoomPlayers(room.players);
      } catch {
        // Transient poll failure
      }
    };
    void poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [gamePin]);

  const handleCreateRoom = async () => {
    const trimmedName = hostName.trim() || 'Debug Player 1';
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

    setBusy(true);
    setError('');
    try {
      const res = await createRoom(
        trimmedName,
        turnTimeLimit,
        gameMode,
        gameMode === 'TURNS' ? maxTurns : null,
        true,
        gameMode === 'HP' ? startingHp : null,
      );
      const hostSession: StoredSession = {
        gameId: res.game_id,
        playerId: res.host_player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: true,
        gamePin: res.game_pin,
      };
      sessionStore.save(hostSession);
      debugSessionStore.save(res.game_id, [hostSession]);
      setSessions([hostSession]);
      setGamePin(res.game_pin);
      setRoomPlayers([{
        id: res.host_player_id,
        display_name: res.display_name,
        is_host: true,
        score: 0,
        hp: startingHp,
        max_hp: startingHp,
        rack_count: 0,
        turn_order: 0,
        connection_status: 'ONLINE',
      }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create debug room');
    } finally {
      setBusy(false);
    }
  };

  const handleAddClone = async () => {
    if (!gamePin) return;
    setBusy(true);
    setError('');
    try {
      const cloneName = `Debug Player ${sessions.length + 1}`;
      const res = await joinRoom(gamePin, cloneName);
      const cloneSession: StoredSession = {
        gameId: res.game_id,
        playerId: res.player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: res.is_host,
        gamePin,
      };
      const nextSessions = [...sessions, cloneSession];
      setSessions(nextSessions);
      debugSessionStore.save(res.game_id, nextSessions);

      // Re-fetch room immediately
      try {
        const room = await getRoom(gamePin);
        setRoomPlayers(room.players);
      } catch {
        // Fallback optimistic player item
        setRoomPlayers(prev => [...prev, {
          id: res.player_id,
          display_name: res.display_name,
          is_host: res.is_host,
          score: 0,
          hp: 100,
          max_hp: 100,
          rack_count: 0,
          turn_order: sessions.length,
          connection_status: 'ONLINE',
        }]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add clone player');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    const host = sessions.find(s => s.isHost);
    if (!host) return;
    setBusy(true);
    setError('');
    try {
      await startGame(host.gamePin!, host.playerId);
      debugSessionStore.save(host.gameId, sessions);
      sessionStore.save(host);
      router.push(`/game/${host.gameId}?debug=1`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start debug game');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(244,63,94,0.16),transparent_30%),linear-gradient(135deg,#020617_0%,#111827_58%,#1f1424_100%)] px-4 py-6 sm:py-12">
      <ParticleField className="pointer-events-none fixed inset-0 h-full w-full" />

      <div className="relative z-10 my-auto flex w-full max-w-[30rem] flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
            <Bug className="h-7 w-7" />
          </div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.25em] text-rose-400">Developer Testing Sandbox</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">Debug Mode</h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-sm">
            Solo testing with god-mode powers: add clone players you control in 1 tab, inspect all racks, edit HP & tiles, and grant cards.
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl sm:rounded-[1.75rem] border border-rose-500/30 bg-slate-900/90 sm:bg-slate-900/75 sm:backdrop-blur-md p-5 sm:p-6 shadow-[0_28px_90px_rgba(2,6,23,0.4)] flex flex-col gap-5">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3.5 py-2.5 text-xs sm:text-sm text-red-300">
              {error}
            </div>
          )}

          {!gamePin ? (
            <div className="flex flex-col gap-4">
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
                      className={`rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                        gameMode === value
                          ? 'border-rose-400/80 bg-rose-500/15 text-white shadow-sm'
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
                  <label htmlFor="debug-starting-hp" className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Starting Health</label>
                  <CustomSelect
                    id="debug-starting-hp"
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
                  {hpOption === 'custom' && (
                    <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCustomHp(prev => String(Math.max(10, (Number(prev) || 100) - 10)))}
                        className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-rose-300 active:scale-95 transition-all"
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
                          className="w-full text-center font-mono font-bold text-white text-base bg-transparent outline-none"
                        />
                        <span className="text-xs font-bold text-rose-400/80 uppercase tracking-wider select-none">HP</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomHp(prev => String(Math.min(1000, (Number(prev) || 100) + 10)))}
                        className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-rose-300 active:scale-95 transition-all"
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
                  <label htmlFor="debug-max-turns" className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Game Length</label>
                  <CustomSelect
                    id="debug-max-turns"
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
                    <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-slate-800/90 shadow-inner overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCustomTurnCount(prev => String(Math.max(1, (Number(prev) || 28) - 1)))}
                        className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-rose-300 active:scale-95 transition-all"
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
                          className="w-full text-center font-mono font-bold text-white text-base bg-transparent outline-none"
                        />
                        <span className="text-xs font-bold text-rose-400/80 uppercase tracking-wider select-none">Turns</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomTurnCount(prev => String(Math.min(500, (Number(prev) || 28) + 1)))}
                        className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-rose-300 active:scale-95 transition-all"
                        aria-label="Increase turns"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="debug-turn-time" className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Turn Time</label>
                <CustomSelect
                  id="debug-turn-time"
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
                <label className="mb-1.5 block text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-400">Host Player Name</label>
                <input
                  type="text"
                  value={hostName}
                  onChange={e => setHostName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                  placeholder="Debug Player 1"
                  maxLength={24}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-2.5 text-sm sm:text-base text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/20 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                />
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={busy}
                className="w-full rounded-xl sm:rounded-2xl border border-rose-400/40 bg-gradient-to-r from-rose-500 to-rose-600 py-3.5 text-base sm:text-lg font-bold text-white shadow-[0_12px_30px_rgba(244,63,94,0.25)] transition-all hover:from-rose-400 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" /> Creating Debug Room...
                  </span>
                ) : (
                  'Create Debug Game'
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <PinDisplay pin={gamePin} />
              <PlayerList players={roomPlayers} myPlayerId={sessions.find(s => s.isHost)?.playerId} />

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={handleAddClone}
                  disabled={busy || roomPlayers.length >= 4}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 py-3 font-semibold text-sm sm:text-base text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  <UserPlus className="h-4 w-4 text-amber-300" />
                  {busy ? 'Adding Clone...' : `+ Add Clone Player (${roomPlayers.length}/4)`}
                </button>

                <button
                  onClick={handleStart}
                  disabled={busy || roomPlayers.length === 0}
                  className="flex items-center justify-center gap-2 w-full rounded-xl sm:rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 text-base sm:text-lg font-bold text-slate-950 shadow-[0_12px_30px_rgba(16,185,129,0.2)] transition-all hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px"
                >
                  <Play className="h-5 w-5 fill-slate-950" />
                  {busy ? 'Starting...' : `Start Debug Game (${roomPlayers.length} player${roomPlayers.length === 1 ? '' : 's'})`}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => router.push('/')}
            className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400 hover:text-white transition-colors pt-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
