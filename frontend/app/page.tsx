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
  Flame,
  Gamepad2,
  Heart,
  History,
  Info,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  Shield,
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
import FloatingTilesBackground from '@/components/effects/FloatingTilesBackground';
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

const PRO_TIPS = [
  '⚡ Place tiles on Lightning blocks to draw game-changing Secret Power cards!',
  '⚔️ In HP Battle, your word score deals direct damage to drain opponent HP.',
  '🛡️ Shield card protects you from Freeze, Destroy, and Spy attacks.',
  '❄️ Freeze card locks opponent tiles on premium multipliers.',
  '🔥 Destroy card clears blocked paths on the board for comeback moves.',
  '✨ Scoring a 7+ letter Bingo awards a massive +50 bonus score!',
];

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
  const [tipIndex, setTipIndex] = useState(0);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Cycling Game Tips
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex(prev => (prev + 1) % PRO_TIPS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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
      // Background pre-fetch rooms count for the lobby badge
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
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-between overflow-x-hidden bg-[#030712] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Ambience Layers */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Dynamic Glowing Radial Nebulas */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-gradient-to-b from-indigo-600/25 via-amber-500/15 to-transparent blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[120px]" />
        <div className="absolute top-1/2 -right-20 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-purple-600/15 blur-[120px]" />

        {/* Ambient Subtle Cyber Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Floating 3D Scrabble Crossword Tiles */}
      <FloatingTilesBackground />

      {/* Particle Atmosphere Matrix */}
      <ParticleField className="pointer-events-none fixed inset-0 z-0 h-full w-full" accent="245, 158, 11" />

      {/* Top Header Bar */}
      <header className="relative z-30 w-full max-w-5xl px-4 pt-4 sm:pt-6 flex items-center justify-between">
        {/* Left: Server Status & Version Capsule */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 backdrop-blur-md shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold tracking-wide text-emerald-300 uppercase">
              Online
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] font-medium text-slate-300 backdrop-blur-md">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Tactical Spell Edition</span>
          </div>
        </div>

        {/* Right: Quick Action Modals & Fullscreen */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-cyan-500/15 hover:border-cyan-400/40 text-xs font-semibold text-slate-300 hover:text-cyan-200 transition-all cursor-pointer backdrop-blur-md shadow-sm active:scale-95"
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Match Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-amber-500/15 hover:border-amber-400/40 text-xs font-semibold text-slate-300 hover:text-amber-200 transition-all cursor-pointer backdrop-blur-md shadow-sm active:scale-95"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Spellbook & Rules</span>
          </button>

          <FullscreenButton className="static z-10" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-20 flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-6 sm:py-8">
        
        {/* HERO TITLE & 3D ICON */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          {/* Floating 3D WordX Cube with multi-tiered glow */}
          <div className="relative mb-3 flex items-center justify-center">
            <div className="pointer-events-none absolute -inset-8 rounded-full bg-gradient-to-tr from-indigo-500/40 via-amber-400/30 to-orange-500/40 blur-3xl opacity-80" />
            <div className="relative transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              <Image
                src="/wordx-icon-256.png?v=20260915"
                alt="WordX Game Logo"
                width={150}
                height={150}
                priority
                className="h-24 w-24 sm:h-32 sm:w-32 object-contain drop-shadow-[0_0_35px_rgba(245,158,11,0.55)]"
              />
            </div>
          </div>

          {/* Majestic Game Logo Heading */}
          <h1 className="relative text-5xl sm:text-6xl md:text-7xl font-black tracking-tight select-none">
            <span className="bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent [text-shadow:0_2px_20px_rgba(255,255,255,0.4)]">
              Word
            </span>
            <span className="relative inline-block bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(245,158,11,0.9)] ml-1">
              X
            </span>
          </h1>

          {/* Subtitle Badge & Features Pills */}
          <div className="mt-2.5 flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-amber-400/30 bg-amber-500/10 text-xs sm:text-sm font-bold tracking-widest uppercase text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Tactical Spellcasting Crossword Duels
            </span>

            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] font-semibold text-slate-400 mt-1">
              <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">⚡ 12 Spell Cards</span>
              <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">⚔️ HP & Turn Battles</span>
              <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">🤖 Smart AI Bots</span>
              <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">🌐 2-4 Players Live</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MAIN MENU HUB (MODE === 'home') */}
        {/* ======================================================== */}
        {mode === 'home' && (
          <div className="w-full max-w-3xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Dissolved Room Notice / General Error */}
            {visibleError && (
              visibleError.toLowerCase().includes('dissolved') ? (
                <div className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-slate-900/90 to-amber-500/15 p-4 shadow-[0_6px_30px_rgba(245,158,11,0.2)] backdrop-blur-md">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500" />
                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        <Clock className="h-5 w-5" strokeWidth={2.2} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white tracking-wide">Room Dissolved</h4>
                          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-400/25">
                            10m Timeout
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-300">
                          The room was closed automatically after 10 minutes of inactivity.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-xs sm:text-sm text-rose-300 font-semibold shadow-md">
                  <span>{visibleError}</span>
                  <button type="button" onClick={() => setError('')} className="p-1 text-rose-400 hover:text-white cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )
            )}

            {/* HERO CARD 1: CREATE MATCH (HOST LOBBY) */}
            <div
              onClick={() => { clearError(); setMode('create'); }}
              className="group relative overflow-hidden rounded-3xl border-2 border-amber-400/40 bg-gradient-to-r from-amber-950/60 via-slate-900/90 to-amber-950/40 p-5 sm:p-7 shadow-[0_12px_40px_rgba(245,158,11,0.2)] hover:border-amber-400 hover:shadow-[0_16px_50px_rgba(245,158,11,0.35)] hover:-translate-y-1 transition-all duration-300 cursor-pointer backdrop-blur-xl"
            >
              {/* Animated Light Sweep Background */}
              <div className="pointer-events-none absolute -inset-full bg-gradient-to-r from-transparent via-amber-400/10 to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-out" />
              
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  {/* Glowing Icon Shield */}
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 text-slate-950 font-black shadow-[0_0_25px_rgba(245,158,11,0.6)] group-hover:scale-105 transition-transform">
                    <Crown className="w-8 h-8 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider text-amber-300">
                        MULTIPLAYER
                      </span>
                      <span className="text-xs text-amber-200/70 font-medium">Custom Rules & Host Controls</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white group-hover:text-amber-200 transition-colors mt-0.5">
                      Create Match
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-md">
                      Host a live game lobby for 2-4 players with custom HP or Round rules and spell cards.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-sm sm:text-base shadow-[0_4px_20px_rgba(245,158,11,0.4)] group-hover:from-amber-300 group-hover:to-amber-400 group-hover:shadow-[0_6px_25px_rgba(245,158,11,0.6)] transition-all shrink-0">
                    <span>HOST LOBBY</span>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2X2 ACTION GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              
              {/* ACTION CARD 2: JOIN GAME */}
              <div
                onClick={handleOpenJoin}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-cyan-400/30 bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-950/95 p-5 sm:p-6 shadow-[0_8px_30px_rgba(6,182,212,0.15)] hover:border-cyan-400/70 hover:shadow-[0_12px_35px_rgba(6,182,212,0.28)] hover:-translate-y-1 transition-all duration-300 cursor-pointer backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-transform">
                    <Radio className="w-6 h-6" />
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>{rooms.length} Active {rooms.length === 1 ? 'Room' : 'Rooms'}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-cyan-200 transition-colors">
                    Join Game
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Enter a 6-digit PIN to join friends or browse open rooms.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/[0.08] text-cyan-300 font-bold text-xs sm:text-sm group-hover:text-cyan-200">
                  <span>Enter PIN / Browse</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* ACTION CARD 3: SOLO VS BOT */}
              <div
                onClick={() => { clearError(); setMode('bot'); }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-purple-400/30 bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-slate-950/95 p-5 sm:p-6 shadow-[0_8px_30px_rgba(168,85,247,0.15)] hover:border-purple-400/70 hover:shadow-[0_12px_35px_rgba(168,85,247,0.28)] hover:-translate-y-1 transition-all duration-300 cursor-pointer backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-400/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)] group-hover:scale-105 transition-transform">
                    <Bot className="w-6 h-6" />
                  </div>

                  <span className="px-2.5 py-1 rounded-full border border-purple-400/30 bg-purple-500/10 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                    Instant Play
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-purple-200 transition-colors">
                    Play vs AI Bot
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Solo match with SparkBot, Nexus AI, or Titan Master.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/[0.08] text-purple-300 font-bold text-xs sm:text-sm group-hover:text-purple-200">
                  <span>3 AI Difficulties</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* ACTION CARD 4: MATCH HISTORY */}
              <div
                onClick={() => setIsHistoryOpen(true)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950/95 p-5 sm:p-6 shadow-[0_8px_30px_rgba(16,185,129,0.15)] hover:border-emerald-400/70 hover:shadow-[0_12px_35px_rgba(16,185,129,0.28)] hover:-translate-y-1 transition-all duration-300 cursor-pointer backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-transform">
                    <History className="w-6 h-6" />
                  </div>

                  <span className="px-2.5 py-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                    Replays
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-emerald-200 transition-colors">
                    Match History
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Review completed games, scores, and turn-by-turn move replays.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/[0.08] text-emerald-300 font-bold text-xs sm:text-sm group-hover:text-emerald-200">
                  <span>View Match Logs</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* ACTION CARD 5: GAME GUIDE & SPELLBOOK */}
              <div
                onClick={() => setIsGuideOpen(true)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-950/95 p-5 sm:p-6 shadow-[0_8px_30px_rgba(245,158,11,0.15)] hover:border-amber-400/70 hover:shadow-[0_12px_35px_rgba(245,158,11,0.28)] hover:-translate-y-1 transition-all duration-300 cursor-pointer backdrop-blur-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] group-hover:scale-105 transition-transform">
                    <BookOpen className="w-6 h-6" />
                  </div>

                  <span className="px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-500/10 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                    Spell Cards
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-amber-200 transition-colors">
                    Game Guide
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Master the 12 elemental cards, lightning powers, and bingo bonuses.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/[0.08] text-amber-300 font-bold text-xs sm:text-sm group-hover:text-amber-200">
                  <span>Read Rules & Cards</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBMENU: CREATE ROOM (MODE === 'create') */}
        {/* ======================================================== */}
        {mode === 'create' && (
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/90 p-5 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('home'); clearError(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-all cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">Create Multiplayer Match</h2>
                  <p className="text-xs text-slate-400">Configure game mode, player limit and rules</p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Game Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Game Mode</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameMode('HP')}
                    className={`flex flex-col p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      gameMode === 'HP'
                        ? 'border-rose-500/80 bg-rose-500/15 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                        : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm sm:text-base font-bold ${gameMode === 'HP' ? 'text-rose-200' : 'text-white'}`}>
                        HP Battle
                      </span>
                      <Heart className={`w-4 h-4 ${gameMode === 'HP' ? 'text-rose-400 fill-rose-500/30' : 'text-slate-500'}`} />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">Word scores drain opponent HP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameMode('TURNS')}
                    className={`flex flex-col p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      gameMode === 'TURNS'
                        ? 'border-cyan-500/80 bg-cyan-500/15 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                        : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm sm:text-base font-bold ${gameMode === 'TURNS' ? 'text-cyan-200' : 'text-white'}`}>
                        Round Count
                      </span>
                      <Clock className={`w-4 h-4 ${gameMode === 'TURNS' ? 'text-cyan-400' : 'text-slate-500'}`} />
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1">Highest total score wins</span>
                  </button>
                </div>
              </div>

              {/* Settings 2-Column: Starting HP / Rounds + Turn Time */}
              <div className="grid grid-cols-2 gap-3">
                {gameMode === 'HP' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Starting HP</label>
                    <CustomSelect
                      value={hpOption}
                      onChange={setHpOption}
                      options={[
                        { value: '50', label: '50 HP' },
                        { value: '100', label: '100 HP' },
                        { value: '150', label: '150 HP' },
                        { value: '200', label: '200 HP' },
                        { value: 'custom', label: 'Custom HP' },
                      ]}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Round Count</label>
                    <CustomSelect
                      value={turnCountOption}
                      onChange={setTurnCountOption}
                      options={[
                        { value: '5', label: '5 Rounds' },
                        { value: '7', label: '7 Rounds' },
                        { value: '10', label: '10 Rounds' },
                        { value: '15', label: '15 Rounds' },
                        { value: 'custom', label: 'Custom Rounds' },
                      ]}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Turn Timer</label>
                  <CustomSelect
                    value={turnTimeLimit === null ? '' : String(turnTimeLimit)}
                    onChange={val => setTurnTimeLimit(val === '' ? null : Number(val) as TurnTimeLimit)}
                    options={[
                      { value: '', label: 'Unlimited' },
                      { value: '30', label: '30 Seconds' },
                      { value: '60', label: '60 Seconds' },
                      { value: '90', label: '90 Seconds' },
                      { value: '120', label: '120 Seconds' },
                    ]}
                  />
                </div>
              </div>

              {/* Custom HP Stepper */}
              {gameMode === 'HP' && hpOption === 'custom' && (
                <div className="flex items-center rounded-2xl border border-white/10 bg-slate-800/90 p-1 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.max(10, (Number(prev) || 100) - 10)))}
                    className="flex h-10 w-12 items-center justify-center rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={customHp}
                    onChange={e => setCustomHp(e.target.value)}
                    className="flex-1 bg-transparent text-center font-bold text-lg text-white outline-none"
                  />
                  <span className="text-xs font-bold text-rose-400 mr-2">HP</span>
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.min(1000, (Number(prev) || 100) + 10)))}
                    className="flex h-10 w-12 items-center justify-center rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Custom Rounds Stepper */}
              {gameMode === 'TURNS' && turnCountOption === 'custom' && (
                <div className="flex items-center rounded-2xl border border-white/10 bg-slate-800/90 p-1 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.max(1, (Number(prev) || 7) - 1)))}
                    className="flex h-10 w-12 items-center justify-center rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={customTurnCount}
                    onChange={e => setCustomTurnCount(e.target.value)}
                    className="flex-1 bg-transparent text-center font-bold text-lg text-white outline-none"
                  />
                  <span className="text-xs font-bold text-cyan-400 mr-2">Rounds</span>
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.min(500, (Number(prev) || 7) + 1)))}
                    className="flex h-10 w-12 items-center justify-center rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Player Limit & Grimoire Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Player Limit</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPlayerLimitOption('4')}
                      className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        playerLimitOption === '4'
                          ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                      }`}
                    >
                      4 Players
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayerLimitOption('custom')}
                      className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
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
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Grimoire Deck</label>
                  <RockerSwitch checked={enableGrimoire} onChange={setEnableGrimoire} />
                </div>
              </div>

              {/* Your Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Host Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="Enter your player name..."
                    maxLength={24}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/90 pl-4 pr-12 py-3 text-sm sm:text-base text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = getRandomPlayerName();
                      setName(rand);
                      clearError();
                    }}
                    title="Random Name"
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 hover:bg-amber-400/30 transition-all cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {visibleError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-semibold">
                  {visibleError}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:via-amber-400 hover:to-orange-400 text-slate-950 font-black text-base sm:text-lg shadow-[0_8px_30px_rgba(245,158,11,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Creating Lobby...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5" />
                    <span>CREATE ROOM</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBMENU: JOIN ROOM (MODE === 'join') */}
        {/* ======================================================== */}
        {mode === 'join' && (
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/90 p-5 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('home'); clearError(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-all cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">Join Match</h2>
                  <p className="text-xs text-slate-400">Enter room PIN or select from active lobbies</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fetchRooms(true)}
                disabled={loadingRooms}
                className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-all cursor-pointer"
                title="Refresh Room List"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRooms ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Your Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Your Name</label>
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your player name..."
                    maxLength={24}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/90 pl-4 pr-12 py-3 text-sm sm:text-base text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = getRandomPlayerName();
                      setName(rand);
                      clearError();
                    }}
                    title="Random Name"
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/30 transition-all cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Active Room Browser */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Open Lobbies ({rooms.length})
                  </span>
                  {loadingRooms && <span className="text-[10px] text-cyan-300 animate-pulse">Refreshing...</span>}
                </div>

                {rooms.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 custom-scrollbar">
                    {rooms.map(room => {
                      const isFull = Boolean(room.max_players && room.player_count >= room.max_players);
                      const isPlaying = room.status === 'PLAYING';
                      const isSelected = pin === room.game_pin;

                      return (
                        <div
                          key={room.id}
                          onClick={() => handleSelectRoom(room)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                              : 'border-white/10 bg-slate-800/50 hover:bg-slate-800/80 hover:border-white/20'
                          }`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 font-black text-sm shadow-md">
                            {(room.host_name || 'H').charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-white truncate">{room.host_name}</span>
                              {isPlaying ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold">LIVE</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">OPEN</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                              <span className="font-mono font-bold text-cyan-300">#{room.game_pin}</span>
                              <span>•</span>
                              <span>{room.player_count}{room.max_players ? `/${room.max_players}` : ''}P</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center rounded-2xl border border-dashed border-white/10 bg-slate-800/30 text-xs text-slate-400">
                    No active rooms found. Host a new game to get started!
                  </div>
                )}
              </div>

              {/* Enter PIN & Join Button */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Game PIN</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && (isSelectedRoomPlaying ? handleWatch() : handleJoin())}
                    placeholder="Enter 6-digit PIN..."
                    maxLength={6}
                    className="w-full rounded-2xl border border-white/10 bg-slate-800/90 pl-4 pr-28 py-3.5 font-mono text-base tracking-[0.2em] text-cyan-300 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-sans"
                  />
                  <button
                    type="button"
                    onClick={isSelectedRoomPlaying ? handleWatch : handleJoin}
                    disabled={loading || !pin.trim()}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer disabled:opacity-40"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : isSelectedRoomPlaying ? (
                      'WATCH'
                    ) : (
                      'JOIN'
                    )}
                  </button>
                </div>
              </div>

              {visibleError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-semibold">
                  {visibleError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBMENU: SOLO VS BOT (MODE === 'bot') */}
        {/* ======================================================== */}
        {mode === 'bot' && (
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/90 p-5 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('home'); clearError(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white transition-all cursor-pointer active:scale-95"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">Play vs AI Bot</h2>
                  <p className="text-xs text-slate-400">Solo practice match with tactical AI opponents</p>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Bot Difficulty Selector Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Select Opponent</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const profile = BOT_PROFILES[diff];
                    const isSelected = botDifficulty === diff;
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setBotDifficulty(diff)}
                        className={`flex flex-col items-center text-center p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? `border-purple-400 bg-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]`
                            : 'border-white/10 bg-slate-800/40 hover:bg-slate-800/70 text-slate-400'
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs mb-1.5 border ${
                          isSelected ? 'bg-purple-400/20 text-purple-300 border-purple-400/50' : 'bg-slate-700/50 text-slate-400 border-white/10'
                        }`}>
                          <Bot className="w-5 h-5" />
                        </div>
                        <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {profile.title}
                        </span>
                        <span className="text-[10px] text-purple-300 font-semibold">{profile.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Game Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Game Mode</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameMode('HP')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      gameMode === 'HP'
                        ? 'border-rose-500 bg-rose-500/15 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                        : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                    }`}
                  >
                    <span className={`block font-bold text-sm ${gameMode === 'HP' ? 'text-rose-200' : 'text-white'}`}>HP Battle</span>
                    <span className="text-[11px] text-slate-400">Score drains bot HP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameMode('TURNS')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      gameMode === 'TURNS'
                        ? 'border-cyan-500 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                        : 'border-white/10 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70'
                    }`}
                  >
                    <span className={`block font-bold text-sm ${gameMode === 'TURNS' ? 'text-cyan-200' : 'text-white'}`}>Round Count</span>
                    <span className="text-[11px] text-slate-400">High score wins</span>
                  </button>
                </div>
              </div>

              {/* Matchup Summary Capsule */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-purple-500/30 bg-purple-950/30">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="text-slate-400 font-medium">Matchup:</span>
                  <span className="font-bold text-white">{name.trim() || 'Player'}</span>
                  <span className="text-purple-400 font-black">VS</span>
                  <span className="font-bold text-purple-300">{BOT_PROFILES[botDifficulty].name}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-[10px] font-bold text-purple-300 uppercase">
                  1v1 Solo
                </span>
              </div>

              {visibleError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-semibold">
                  {visibleError}
                </div>
              )}

              {/* Start Bot Game Button */}
              <button
                type="button"
                onClick={handleCreateBot}
                disabled={loading}
                className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-base sm:text-lg shadow-[0_8px_30px_rgba(168,85,247,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Starting AI Match...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-5 h-5" />
                    <span>START BOT MATCH</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer Game Tip Ticker */}
      <footer className="relative z-20 w-full max-w-5xl px-4 py-3 pb-4 sm:pb-6 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/[0.06] text-xs text-slate-400">
        <div className="flex items-center gap-2 animate-in fade-in duration-300">
          <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 text-[10px] font-bold text-amber-300 uppercase shrink-0">
            PRO TIP
          </span>
          <span className="text-slate-300 font-medium truncate max-w-md sm:max-w-xl">
            {PRO_TIPS[tipIndex]}
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          WordX © 2026 • Crafted with DeepMind Speed Engine
        </div>
      </footer>

      {/* Global Modals */}
      {isGuideOpen && (
        <GameGuideModal isOpen onClose={() => setIsGuideOpen(false)} />
      )}

      <MatchHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}
