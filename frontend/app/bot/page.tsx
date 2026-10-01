'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Bot, Minus, Plus, User } from 'lucide-react';
import { createRoom, joinRoom, sessionStore } from '@/lib/api';
import { GameMode, TurnTimeLimit } from '@/lib/types';
import ParticleField from '@/components/effects/ParticleField';
import FullscreenButton from '@/components/ui/FullscreenButton';
import CustomSelect from '@/components/ui/CustomSelect';

type BotDifficulty = 'easy' | 'medium' | 'hard';

const BOT_PROFILES: Record<BotDifficulty, { name: string; title: string; desc: string; badge: string }> = {
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

export default function BotRoomCreationPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(null);
  const [gameMode, setGameMode] = useState<GameMode>('HP');
  const [turnCountOption, setTurnCountOption] = useState('7');
  const [customTurnCount, setCustomTurnCount] = useState('28');
  const [hpOption, setHpOption] = useState('100');
  const [customHp, setCustomHp] = useState('100');

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create bot room');
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
        <div className="relative text-center flex flex-col items-center">
          <div className="relative mb-2 sm:mb-3 flex items-center justify-center">
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-gradient-to-tr from-indigo-500/35 via-amber-400/25 to-amber-500/40 blur-2xl hero-glow-breathe" />
            <div className="pointer-events-none absolute h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-amber-400/25 blur-xl" />
            <div
              onClick={() => router.push('/')}
              className="relative hero-logo-float transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer"
            >
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

          <div className="relative select-none">
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
          <div className="flex flex-col gap-3.5 sm:gap-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95 cursor-pointer shrink-0"
                  aria-label="Back to home"
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
                  <label htmlFor="bot-page-starting-hp" className="mb-1.5 block text-xs font-semibold text-slate-300">Starting HP</label>
                  <CustomSelect
                    id="bot-page-starting-hp"
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
                  <label htmlFor="bot-page-max-turns" className="mb-1.5 block text-xs font-semibold text-slate-300">Game Length</label>
                  <CustomSelect
                    id="bot-page-max-turns"
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
                <label htmlFor="bot-page-turn-time" className="mb-1.5 block text-xs font-semibold text-slate-300">Turn Time</label>
                <CustomSelect
                  id="bot-page-turn-time"
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
        </div>
      </div>
    </div>
  );
}
