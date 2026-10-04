'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Bot, Minus, Plus, User } from 'lucide-react';
import { createRoom, joinRoom, startGame, sessionStore } from '@/lib/api';
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
      setError('Round count must be between 1 and 500');
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
        await joinRoom(res.game_pin, botDisplayName, { difficulty: botDifficulty });
        await startGame(res.game_pin, res.host_player_id);
        router.push(`/game/${res.game_id}`);
      } catch (startErr) {
        console.warn('Bot direct start notice, falling back to lobby:', startErr);
        router.push(`/lobby/${res.game_pin}?bot=${botDifficulty}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create bot room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-[#070913] px-4 py-6 sm:py-12">
      <ParticleField className="pointer-events-none fixed inset-0 h-full w-full opacity-80" />
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
                src="/wordx-icon-256.png"
                alt="WordX logo"
                width={140}
                height={140}
                priority
                unoptimized
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
        <div className="relative w-full rounded-3xl border border-white/10 bg-[#0c101d]/95 backdrop-blur-2xl p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)] ring-1 ring-white/5 overflow-hidden">
          {/* Soft Purple Accent Line */}
          <span className="absolute inset-x-12 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />

          <div className="flex flex-col gap-3.5 sm:gap-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:border-purple-400/50 hover:bg-purple-400/10 hover:text-purple-200 transition-all cursor-pointer active:scale-95 shrink-0 shadow-inner"
                  aria-label="Back to home"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                    <span>Solo vs AI Bot</span>
                    <span className="flex items-center gap-1 rounded-full bg-purple-400/15 border border-purple-400/30 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                      <Bot className="w-3 h-3 text-purple-300" /> AI Practice
                    </span>
                  </h2>
                </div>
              </div>
            </div>

            {/* Bot Difficulty Selection */}
            <fieldset>
              <legend className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Bot Difficulty</legend>
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
                    className={`rounded-2xl border p-2.5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 cursor-pointer ${
                      botDifficulty === val
                        ? 'border-2 border-purple-400/80 bg-purple-400/10 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/30'
                        : 'border border-white/10 bg-slate-900/60 text-slate-400 hover:border-purple-400/30 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <span className={`block text-xs sm:text-sm font-black ${botDifficulty === val ? 'text-white' : 'text-slate-200'}`}>
                      {title}
                    </span>
                    <span className={`mt-0.5 block text-[0.65rem] truncate font-bold ${botDifficulty === val ? 'text-purple-300' : 'text-slate-400'}`}>
                      {botName}
                    </span>
                    <span className={`mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                      botDifficulty === val ? 'bg-purple-400/20 text-purple-200 border border-purple-400/30' : 'bg-white/5 text-slate-400'
                    }`}>
                      {level}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Game Mode */}
            <fieldset>
              <legend className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Game Mode</legend>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  ['HP', 'HP Battle', 'Score drains health'],
                  ['TURNS', 'Round Match', 'Highest score wins'],
                ] as const).map(([value, title, description]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={gameMode === value}
                    onClick={() => setGameMode(value)}
                    className={`rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 cursor-pointer ${
                      gameMode === value
                        ? 'border-2 border-purple-400/80 bg-purple-400/10 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] ring-1 ring-purple-400/30'
                        : 'border border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <span className={`block text-xs sm:text-sm font-black ${gameMode === value ? 'text-white' : 'text-slate-200'}`}>
                      {title}
                    </span>
                    <span className={`mt-0.5 block text-[0.68rem] leading-snug font-medium ${gameMode === value ? 'text-purple-200/80' : 'text-slate-400'}`}>
                      {description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Settings 2-Column: (Starting HP / Round Count) + Turn Time */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {gameMode === 'HP' ? (
                <div>
                  <label htmlFor="bot-page-starting-hp" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Starting HP</label>
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
                  <label htmlFor="bot-page-max-turns" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Game Length</label>
                  <CustomSelect
                    id="bot-page-max-turns"
                    value={turnCountOption}
                    onChange={setTurnCountOption}
                    options={[
                      { value: '5', label: '5 Rounds' },
                      { value: '7', label: '7 Rounds' },
                      { value: '10', label: '10 Rounds' },
                      { value: '15', label: '15 Rounds' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                  />
                </div>
              )}

              <div>
                <label htmlFor="bot-page-turn-time" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Turn Time</label>
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

            {/* Custom HP / Round Stepper if selected */}
            {gameMode === 'HP' && hpOption === 'custom' && (
              <div className="flex items-center rounded-xl border border-white/10 bg-slate-900/90 shadow-inner p-1 focus-within:border-purple-400/80 focus-within:ring-2 focus-within:ring-purple-400/20 transition-all overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCustomHp(prev => String(Math.max(10, (Number(prev) || 100) - 10)))}
                  className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer select-none"
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
                    className="w-full text-center font-bold text-white text-base bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[11px] font-bold text-purple-300/80 uppercase tracking-wider select-none shrink-0">HP</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomHp(prev => String(Math.min(1000, (Number(prev) || 100) + 10)))}
                  className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer select-none"
                  aria-label="Increase HP"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            {gameMode === 'TURNS' && turnCountOption === 'custom' && (
              <div className="flex items-center rounded-xl border border-white/10 bg-slate-900/90 shadow-inner p-1 focus-within:border-purple-400/80 focus-within:ring-2 focus-within:ring-purple-400/20 transition-all overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCustomTurnCount(prev => String(Math.max(1, (Number(prev) || 7) - 1)))}
                  className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer select-none"
                  aria-label="Decrease rounds"
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
                    aria-label="Custom round count"
                    placeholder="7"
                    className="w-full text-center font-bold text-white text-base bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[11px] font-bold text-purple-300/80 uppercase tracking-wider select-none shrink-0">Rounds</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomTurnCount(prev => String(Math.min(500, (Number(prev) || 7) + 1)))}
                  className="flex items-center justify-center w-11 sm:w-12 h-10 sm:h-11 text-slate-300 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer select-none"
                  aria-label="Increase rounds"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Opponent Preview Banner */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-purple-400/25 bg-purple-950/25 shadow-inner">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-slate-400 font-semibold">Matchup:</span>
                <span className="font-bold text-white">You</span>
                <span className="text-purple-400 font-black">VS</span>
                <span className="font-bold text-purple-300">{BOT_PROFILES[botDifficulty].name}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-[9px] font-black text-purple-200 uppercase tracking-wider">
                1v1 Match
              </span>
            </div>

            {error && <p className="text-red-400 text-xs sm:text-sm font-semibold p-2.5 rounded-xl bg-red-950/30 border border-red-500/30">{error}</p>}

            {/* Action Button */}
            <button
              onClick={handleCreateBot}
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-black text-base uppercase tracking-wider shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_28px_rgba(168,85,247,0.5)] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 border border-purple-300/40"
            >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Setting up Bot Room...
                  </span>
                ) : (
                  <>
                    <Bot className="h-5 w-5 text-white" strokeWidth={2.2} />
                    <span>START BOT MATCH</span>
                  </>
                )}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
}
