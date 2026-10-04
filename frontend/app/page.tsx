'use client';

import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Clock,
  Crown,
  Eye,
  Heart,
  History,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Swords,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { createRoom, getApiBase, getRoom, getRooms, joinRoom, startGame, sessionStore } from '@/lib/api';
import { GameMode, RoomSummary, TurnTimeLimit } from '@/lib/types';
import ParticleField from '@/components/effects/ParticleField';
import FullscreenButton from '@/components/ui/FullscreenButton';
import CustomSelect from '@/components/ui/CustomSelect';
import { RockerSwitch } from '@/components/ui/RockerSwitch';
import { GameGuideModal } from '@/components/game/GameGuideModal';
import { MatchHistoryModal } from '@/components/history/MatchHistoryModal';
import { getRandomPlayerName } from '@/lib/names';

type Mode = 'home' | 'create' | 'join' | 'bot';
type BotDifficulty = 'easy' | 'medium' | 'hard';

const subscribeToLocation = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
};
const getLocationSearch = () => window.location.search;
const getServerLocationSearch = () => '';

export const BOT_PROFILES: Record<BotDifficulty, { name: string; title: string; desc: string; badge: string; color: string }> = {
  easy: {
    name: 'SparkBot',
    title: 'Easy',
    desc: 'Novice AI • Relaxed word strategy',
    badge: 'Novice',
    color: 'from-emerald-500/20 to-teal-500/10 border-emerald-400/40 text-emerald-300',
  },
  medium: {
    name: 'Nexus AI',
    title: 'Medium',
    desc: 'Tactical AI • Balanced & strategic spells',
    badge: 'Tactical',
    color: 'from-amber-500/20 to-orange-500/10 border-amber-400/40 text-amber-300',
  },
  hard: {
    name: 'Titan AI',
    title: 'Hard',
    desc: 'Master AI • High-scoring word combos',
    badge: 'Master',
    color: 'from-rose-500/20 to-purple-500/10 border-rose-400/40 text-rose-300',
  },
};

export default function HomePage() {
  const router = useRouter();
  const search = useSyncExternalStore(subscribeToLocation, getLocationSearch, getServerLocationSearch);
  const query = new URLSearchParams(search);
  const requestedMode: Mode | null = query.get('mode') === 'bot' ? 'bot' : null;
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);
  const mode = modeOverride ?? requestedMode ?? 'home';
  const setMode = useCallback((next: Mode) => setModeOverride(next), []);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [createTakingLong, setCreateTakingLong] = useState(false);
  const [error, setError] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(null);
  const [gameMode, setGameMode] = useState<GameMode>('HP');
  const [turnCountOption, setTurnCountOption] = useState('7');
  const [customTurnCount, setCustomTurnCount] = useState('28');
  const [hpOption, setHpOption] = useState('100');
  const [customHp, setCustomHp] = useState('100');
  const [playerLimitOption, setPlayerLimitOption] = useState<'4' | 'custom'>('4');
  const [customMaxPlayers, setCustomMaxPlayers] = useState('10');
  const [enableGrimoire, setEnableGrimoire] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Pre-warm backend
  useEffect(() => {
    const apiBase = getApiBase();
    if (!/^https?:\/\//.test(apiBase)) return;
    const serverBase = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
    void fetch(`${serverBase}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading || (mode !== 'create' && mode !== 'bot')) return;
    const timer = window.setTimeout(() => setCreateTakingLong(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [loading, mode]);

  const clearError = useCallback(() => {
    setError('');
    if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('kicked')) return;
    const params = new URLSearchParams(window.location.search);
    params.delete('kicked');
    const nextSearch = params.size > 0 ? `?${params.toString()}` : '';
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}${window.location.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [setError]);

  const visibleError = error || (query.get('kicked') === 'expired'
    ? 'This room has been dissolved due to 10 minutes of inactivity.'
    : '');

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
  }, [setLoadingRooms, setRooms, setRoomsError]);

  useEffect(() => {
    if (mode === 'join') {
      const timer = setInterval(() => {
        fetchRooms(false);
      }, 6000);
      return () => clearInterval(timer);
    } else {
      fetchRooms(false);
    }
  }, [mode, fetchRooms]);

  const handleOpenJoin = useCallback(() => {
    clearError();
    setMode('join');
    void fetchRooms(true);
  }, [clearError, fetchRooms, setMode]);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
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
    const parsedCustomPlayers = Number(customMaxPlayers);
    if (playerLimitOption === 'custom' && (!Number.isInteger(parsedCustomPlayers) || parsedCustomPlayers < 2 || parsedCustomPlayers > 50)) {
      setError('Player limit must be between 2 and 50');
      return;
    }
    const maxPlayers = playerLimitOption === 'custom' ? parsedCustomPlayers : (Number(playerLimitOption) || 4);

    setCreateTakingLong(false);
    setLoading(true);
    clearError();
    try {
      const res = await createRoom(
        name.trim(),
        turnTimeLimit,
        gameMode,
        gameMode === 'TURNS' ? maxTurns : null,
        false,
        gameMode === 'HP' ? startingHp : null,
        maxPlayers,
        enableGrimoire,
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
      setCreateTakingLong(false);
    }
  };

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
    clearError();
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
        enableGrimoire,
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
    clearError();
    try {
      const res = await joinRoom(pinToJoin.trim(), playerName.trim());
      const matchedRoom = rooms.find(r => r.game_pin === pinToJoin.trim());
      const effectiveMaxPlayers = (res.max_players !== undefined && res.max_players !== null)
        ? res.max_players
        : (matchedRoom?.max_players || 4);
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
        maxPlayers: effectiveMaxPlayers,
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

  const executeWatch = async (pinToWatch: string) => {
    if (!pinToWatch.trim()) { setError('Please enter the game PIN'); return; }
    setLoading(true);
    clearError();
    try {
      const room = await getRoom(pinToWatch.trim());
      const spectatorLimit = 2;
      const seatsAreFull = room.players.length >= 6;
      const spectatorGalleryIsFull = room.spectator_count >= spectatorLimit;
      if (seatsAreFull && spectatorGalleryIsFull) {
        setError('This room is full for both players and spectators.');
        return;
      }
      if (!seatsAreFull && spectatorGalleryIsFull) {
        setError('Spectator gallery is full, but player seats are available.');
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
    clearError();
    if (room.status === 'WAITING' && !name.trim()) {
      nameInputRef.current?.focus();
    }
  };

  const selectedRoom = rooms.find(r => r.game_pin === pin.trim());
  const isSelectedRoomPlaying = selectedRoom?.status === 'PLAYING';

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-col items-center justify-between overflow-hidden bg-[#030712] p-3 sm:p-5 text-slate-100 select-none selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Dynamic Ambient Background Nebulas */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-gradient-to-b from-indigo-600/20 via-amber-500/10 to-transparent blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-20 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      {/* Subtle Background Particle Matrix */}
      <ParticleField className="pointer-events-none fixed inset-0 z-0 h-full w-full" accent="245, 158, 11" />

      {/* 1. TOP HEADER BAR (SYMMETRICALLY ALIGNED WITH MENU DECK) */}
      <header className="relative z-30 w-full max-w-[550px] flex items-center justify-end gap-2.5 sm:gap-3 shrink-0 pt-2 sm:pt-4">
        {/* Prominent Match Logs Button */}
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="group flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-r from-cyan-500/20 via-cyan-950/50 to-blue-500/20 hover:from-cyan-500/35 hover:to-blue-500/35 hover:border-cyan-300 text-xs sm:text-sm font-black text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.55)] hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl"
        >
          <History className="w-4 h-4 text-cyan-300 group-hover:rotate-[-20deg] transition-transform drop-shadow-[0_0_8px_rgba(6,182,212,0.9)]" strokeWidth={2.5} />
          <span className="tracking-wide">Match Logs</span>
        </button>

        {/* Prominent Rules & Guide Button */}
        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="group flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-amber-950/50 to-orange-500/20 hover:from-amber-500/35 hover:to-orange-500/35 hover:border-amber-300 text-xs sm:text-sm font-black text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.55)] hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl"
        >
          <BookOpen className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" strokeWidth={2.5} />
          <span className="tracking-wide">Rules & Guide</span>
        </button>

        <FullscreenButton className="static z-10" />
      </header>

      {/* 2. CENTER STAGE (NO SCROLLING) */}
      <main className="relative z-20 flex w-full max-w-[550px] flex-1 flex-col items-center justify-center my-auto">
        
        {/* HERO BRANDING HEADER */}
        <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
          {/* Floating 3D WordX Cube Logo */}
          <div className="relative mb-2 flex items-center justify-center">
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="relative transform hover:scale-105 transition-transform duration-200 cursor-pointer drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]">
              <Image
                src="/wordx-icon-256.png?v=20260915"
                alt="WordX Logo"
                width={90}
                height={90}
                priority
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]"
              />
            </div>
          </div>

          {/* Heading */}
          <h1 className="relative text-4xl sm:text-5xl font-black tracking-tight leading-none select-none">
            <span className="bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent drop-shadow">
              Word
            </span>
            <span className="relative inline-block bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(245,158,11,0.8)] ml-0.5">
              X
            </span>
          </h1>
        </div>

        {/* ======================================================== */}
        {/* MAIN MENU DECK (HOST MATCH TOP, JOIN & BOT BELOW) */}
        {/* ======================================================== */}
        {mode === 'home' && (
          <div className="w-full max-w-[550px] flex flex-col gap-3.5 sm:gap-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Dissolved Room Notice / General Error */}
            {visibleError && (
              <div className="p-3 rounded-2xl border border-rose-500/40 bg-rose-500/15 text-xs text-rose-300 font-semibold flex items-center justify-between shadow-md">
                <span>{visibleError}</span>
                <button type="button" onClick={() => setError('')} className="p-1 text-rose-400 hover:text-white cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* 1. TOP FULL-WIDTH HERO: HOST MATCH (TALL & BOLD) */}
            <div
              onClick={() => { clearError(); setMode('create'); }}
              className="group relative flex items-center justify-between min-h-[84px] sm:min-h-[96px] rounded-3xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-950/60 via-slate-900/90 to-amber-950/40 p-4 sm:p-5 shadow-[0_12px_40px_rgba(245,158,11,0.25)] hover:border-amber-400 hover:shadow-[0_16px_50px_rgba(245,158,11,0.4)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer backdrop-blur-xl"
            >
              <div className="flex items-center gap-3.5 sm:gap-4">
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black shadow-[0_0_22px_rgba(245,158,11,0.55)] group-hover:scale-105 transition-transform">
                  <Crown className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-amber-200 transition-colors tracking-tight">
                    Host Match
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs sm:text-sm tracking-wider shadow-md group-hover:from-amber-300 group-hover:to-amber-400 transition-all shrink-0">
                <span>CREATE ROOM</span>
                <ArrowRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 2. BOTTOM ROW: JOIN MATCH (WIDER 7-COL) & VS BOT (COMPACT 5-COL) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-3.5">
              {/* JOIN MATCH (7 COLS - TALL & WIDER) */}
              <div
                onClick={handleOpenJoin}
                className="sm:col-span-7 group relative flex items-center justify-between min-h-[76px] sm:min-h-[84px] rounded-3xl border-2 border-cyan-400/40 bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-950/95 p-3.5 sm:p-4.5 shadow-[0_8px_30px_rgba(6,182,212,0.18)] hover:border-cyan-400 hover:shadow-[0_14px_40px_rgba(6,182,212,0.35)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 font-black shadow-[0_0_18px_rgba(6,182,212,0.45)] group-hover:scale-105 transition-transform">
                    <Radio className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white group-hover:text-cyan-200 transition-colors truncate">
                      Join Match
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                      <span className="text-[11px] sm:text-xs font-bold text-cyan-300 truncate">
                        {rooms.length} Active {rooms.length === 1 ? 'Room' : 'Rooms'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 group-hover:bg-cyan-500/30 group-hover:translate-x-0.5 transition-all shrink-0 ml-1.5">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* PLAY VS AI BOT (5 COLS - TALL & COMPACT) */}
              <div
                onClick={() => { clearError(); setMode('bot'); }}
                className="sm:col-span-5 group relative flex items-center justify-between min-h-[76px] sm:min-h-[84px] rounded-3xl border-2 border-purple-400/40 bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-slate-950/95 p-3.5 sm:p-4.5 shadow-[0_8px_30px_rgba(168,85,247,0.18)] hover:border-purple-400 hover:shadow-[0_14px_40px_rgba(168,85,247,0.35)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer backdrop-blur-xl"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-600 text-slate-950 font-black shadow-[0_0_18px_rgba(168,85,247,0.45)] group-hover:scale-105 transition-transform">
                    <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white group-hover:text-purple-200 transition-colors truncate">
                      VS Bot
                    </h3>
                  </div>
                </div>

                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-400/30 text-purple-300 group-hover:bg-purple-500/30 group-hover:translate-x-0.5 transition-all shrink-0 ml-1.5">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBMENU: CREATE ROOM (COMPACT MODAL) */}
        {/* ======================================================== */}
        {mode === 'create' && (
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
              <button
                type="button"
                onClick={() => { setMode('home'); clearError(); }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">Create Match Lobby</h2>
                <p className="text-[11px] text-slate-400">Configure game rules & host settings</p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGameMode('HP')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    gameMode === 'HP'
                      ? 'border-rose-500 bg-rose-500/15 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                  }`}
                >
                  <div>
                    <span className={`block text-xs font-bold ${gameMode === 'HP' ? 'text-rose-200' : 'text-white'}`}>HP Battle</span>
                    <span className="text-[10px] text-slate-400">Drains opponent health</span>
                  </div>
                  <Heart className={`w-4 h-4 ${gameMode === 'HP' ? 'text-rose-400 fill-rose-500/30' : 'text-slate-500'}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setGameMode('TURNS')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    gameMode === 'TURNS'
                      ? 'border-cyan-500 bg-cyan-500/15 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                  }`}
                >
                  <div>
                    <span className={`block text-xs font-bold ${gameMode === 'TURNS' ? 'text-cyan-200' : 'text-white'}`}>Round Match</span>
                    <span className="text-[10px] text-slate-400">Highest score wins</span>
                  </div>
                  <Clock className={`w-4 h-4 ${gameMode === 'TURNS' ? 'text-cyan-400' : 'text-slate-500'}`} />
                </button>
              </div>

              {/* 2-Column: HP/Rounds + Timer */}
              <div className="grid grid-cols-2 gap-2.5">
                {gameMode === 'HP' ? (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Starting HP</label>
                    <CustomSelect
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
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Round Count</label>
                    <CustomSelect
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
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Turn Timer</label>
                  <CustomSelect
                    value={turnTimeLimit === null ? '' : String(turnTimeLimit)}
                    onChange={val => setTurnTimeLimit(val === '' ? null : Number(val) as TurnTimeLimit)}
                    options={[
                      { value: '', label: 'Unlimited' },
                      { value: '30', label: '30s' },
                      { value: '60', label: '60s' },
                      { value: '90', label: '90s' },
                      { value: '120', label: '120s' },
                    ]}
                  />
                </div>
              </div>

              {/* Steppers if custom */}
              {gameMode === 'HP' && hpOption === 'custom' && (
                <div className="flex items-center rounded-xl border border-white/10 bg-slate-800/90 p-1">
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.max(10, (Number(prev) || 100) - 10)))}
                    className="flex h-8 w-10 items-center justify-center rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={customHp}
                    onChange={e => setCustomHp(e.target.value)}
                    className="flex-1 bg-transparent text-center font-bold text-sm text-white outline-none"
                  />
                  <span className="text-[10px] font-bold text-rose-400 mr-2">HP</span>
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.min(1000, (Number(prev) || 100) + 10)))}
                    className="flex h-8 w-10 items-center justify-center rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {gameMode === 'TURNS' && turnCountOption === 'custom' && (
                <div className="flex items-center rounded-xl border border-white/10 bg-slate-800/90 p-1">
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.max(1, (Number(prev) || 7) - 1)))}
                    className="flex h-8 w-10 items-center justify-center rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={customTurnCount}
                    onChange={e => setCustomTurnCount(e.target.value)}
                    className="flex-1 bg-transparent text-center font-bold text-sm text-white outline-none"
                  />
                  <span className="text-[10px] font-bold text-cyan-400 mr-2">Rounds</span>
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.min(500, (Number(prev) || 7) + 1)))}
                    className="flex h-8 w-10 items-center justify-center rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Player Limit & Grimoire */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Players</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPlayerLimitOption('4')}
                      className={`py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        playerLimitOption === '4'
                          ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                      }`}
                    >
                      4P
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayerLimitOption('custom')}
                      className={`py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        playerLimitOption === 'custom'
                          ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Grimoire Deck</label>
                  <RockerSwitch checked={enableGrimoire} onChange={setEnableGrimoire} />
                </div>
              </div>

              {/* Host Name Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Your Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="Enter your name..."
                    maxLength={24}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/90 pl-3.5 pr-10 py-2.5 text-sm text-white outline-none focus:border-amber-400 transition-all placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = getRandomPlayerName();
                      setName(rand);
                      clearError();
                    }}
                    title="Random Name"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 hover:bg-amber-400/30 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {visibleError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-semibold">
                  {visibleError}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="w-full mt-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:via-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating Lobby...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    <span>HOST ROOM</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBMENU: JOIN ROOM (COMPACT MODAL) */}
        {/* ======================================================== */}
        {mode === 'join' && (
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('home'); clearError(); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">Join Match</h2>
                  <p className="text-[11px] text-slate-400">Enter room PIN or select an open room</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fetchRooms(true)}
                disabled={loadingRooms}
                className="p-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-all cursor-pointer"
                title="Refresh Room List"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {/* Your Name Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Your Name</label>
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name..."
                    maxLength={24}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/90 pl-3.5 pr-10 py-2.5 text-sm text-white outline-none focus:border-cyan-400 transition-all placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = getRandomPlayerName();
                      setName(rand);
                      clearError();
                    }}
                    title="Random Name"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/30 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Rooms */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-300 uppercase">
                    Active Lobbies ({rooms.length})
                  </span>
                  {loadingRooms && <span className="text-[9px] text-cyan-300 animate-pulse">Refreshing...</span>}
                </div>

                {rooms.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5 pr-1 custom-scrollbar">
                    {rooms.map(room => {
                      const isPlaying = room.status === 'PLAYING';
                      const isSelected = pin === room.game_pin;

                      return (
                        <div
                          key={room.id}
                          onClick={() => handleSelectRoom(room)}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-950/40 shadow-sm'
                              : 'border-white/10 bg-slate-800/50 hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 font-black text-xs">
                            {(room.host_name || 'H').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-white truncate">{room.host_name}</span>
                              {isPlaying ? (
                                <span className="px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[8px] font-bold">LIVE</span>
                              ) : (
                                <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-bold">OPEN</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-slate-400">
                              <span className="font-mono font-bold text-cyan-300">#{room.game_pin}</span>
                              <span>•</span>
                              <span>{room.player_count}P</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center rounded-xl border border-dashed border-white/10 bg-slate-800/30 text-xs text-slate-400">
                    No active rooms found. Host a game to start!
                  </div>
                )}
              </div>

              {/* PIN & Submit */}
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Game PIN</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && (isSelectedRoomPlaying ? handleWatch() : handleJoin())}
                    placeholder="6-digit PIN..."
                    maxLength={6}
                    className="w-full rounded-xl border border-white/10 bg-slate-800/90 pl-3.5 pr-24 py-2.5 font-mono text-sm tracking-[0.2em] text-cyan-300 outline-none focus:border-cyan-400 transition-all placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-sans"
                  />
                  <button
                    type="button"
                    onClick={isSelectedRoomPlaying ? handleWatch : handleJoin}
                    disabled={loading || !pin.trim()}
                    className="absolute right-1 top-1 bottom-1 px-4 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs shadow transition-all cursor-pointer disabled:opacity-40"
                  >
                    {loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isSelectedRoomPlaying ? (
                      'WATCH'
                    ) : (
                      'JOIN'
                    )}
                  </button>
                </div>
              </div>

              {visibleError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-semibold">
                  {visibleError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBMENU: SOLO VS BOT (COMPACT MODAL) */}
        {/* ======================================================== */}
        {mode === 'bot' && (
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('home'); clearError(); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">Solo vs AI Bot</h2>
                  <p className="text-[11px] text-slate-400">Select bot difficulty and battle rules</p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {/* Bot Difficulty */}
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Select Opponent</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const profile = BOT_PROFILES[diff];
                    const isSelected = botDifficulty === diff;
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setBotDifficulty(diff)}
                        className={`flex flex-col items-center p-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-purple-400 bg-purple-500/20 shadow-sm'
                            : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                        }`}
                      >
                        <Bot className="w-4 h-4 mb-0.5" />
                        <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {profile.title}
                        </span>
                        <span className="text-[9px] text-purple-300 font-semibold">{profile.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Game Mode */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGameMode('HP')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    gameMode === 'HP'
                      ? 'border-rose-500 bg-rose-500/15'
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                  }`}
                >
                  <span className={`block font-bold text-xs ${gameMode === 'HP' ? 'text-rose-200' : 'text-white'}`}>HP Battle</span>
                  <span className="text-[9px] text-slate-400">Score deals direct HP damage</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGameMode('TURNS')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    gameMode === 'TURNS'
                      ? 'border-cyan-500 bg-cyan-500/15'
                      : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                  }`}
                >
                  <span className={`block font-bold text-xs ${gameMode === 'TURNS' ? 'text-cyan-200' : 'text-white'}`}>Round Match</span>
                  <span className="text-[9px] text-slate-400">Highest total score wins</span>
                </button>
              </div>

              {/* Matchup Summary */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-purple-500/30 bg-purple-950/30">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Matchup:</span>
                  <span className="font-bold text-white">{name.trim() || 'Player'}</span>
                  <span className="text-purple-400 font-black">VS</span>
                  <span className="font-bold text-purple-300">{BOT_PROFILES[botDifficulty].name}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-[9px] font-bold text-purple-300 uppercase">
                  Solo
                </span>
              </div>

              {visibleError && (
                <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-semibold">
                  {visibleError}
                </div>
              )}

              {/* Start CTA */}
              <button
                type="button"
                onClick={handleCreateBot}
                disabled={loading}
                className="w-full mt-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Starting AI Match...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>START BOT MATCH</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Global Modals */}
      {isGuideOpen && (
        <GameGuideModal isOpen onClose={() => setIsGuideOpen(false)} />
      )}

      <MatchHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}
