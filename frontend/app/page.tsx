'use client';

import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Crown,
  History,
  Minus,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  X,
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
      
      {/* Layer 0: Dark Cosmic Void & Dynamic Ambient Nebulas */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-gradient-to-b from-indigo-600/20 via-amber-500/10 to-transparent blur-[120px]" />
        <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-cyan-600/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-20 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      {/* Layer 1: Sleek Uniform Small Golden Grid (Only Small Grid, No Major Lines) */}
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(245, 158, 11, 0.16) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(245, 158, 11, 0.16) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
            backgroundPosition: 'center center',
            maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 45%, transparent 95%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 45%, transparent 95%)',
          }}
        />
      </div>

      {/* Layer 2: Subtle Ambient Rising Beams & Particle Matrix */}
      <ParticleField className="pointer-events-none fixed inset-0 z-[2] h-full w-full" accent="245, 158, 11" />

      {/* CENTER STAGE (NO SCROLLING) */}
      <main className="relative z-20 flex w-full max-w-[550px] flex-1 flex-col items-center justify-center my-auto">
        
        {/* HERO BRANDING HEADER */}
        <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
          {/* Floating 3D WordX Cube Logo */}
          <div className="relative mb-2 flex items-center justify-center">
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="relative transform hover:scale-105 transition-transform duration-200 cursor-pointer drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]">
              <Image
                src="/wordx-icon-256.png"
                alt="WordX Logo"
                width={90}
                height={90}
                priority
                unoptimized
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
                  <div className="flex items-center gap-1.5 mt-1 opacity-70">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400/40" />
                  </div>
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
                  <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 font-black shadow-[0_0_18px_rgba(6,182,212,0.45)] group-hover:scale-105 transition-transform">
                    <Radio className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
                    <div className="absolute -inset-1 rounded-2xl bg-cyan-400/20 animate-ping opacity-30 pointer-events-none" />
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
                  <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-600 text-slate-950 font-black shadow-[0_0_18px_rgba(168,85,247,0.45)] group-hover:scale-105 transition-transform">
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
        {/* ======================================================== */}
        {/* SUBMENU: CREATE ROOM (COMPACT MODAL) */}
        {/* ======================================================== */}
        {/* SUBMENU: CREATE ROOM (COSMIC GLASS IDENTITY) */}
        {/* ======================================================== */}
        {mode === 'create' && (
          <div className="relative w-full max-w-lg rounded-[28px] sm:rounded-[32px] border border-white/15 bg-gradient-to-b from-slate-900/90 via-[#0a0f24]/95 to-[#050814]/98 p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(245,158,11,0.12)] backdrop-blur-2xl ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Soft Warm Champagne Accent Line */}
            <span className="absolute inset-x-12 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

            {/* Header */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-white/[0.08]">
              <button
                type="button"
                onClick={() => { setMode('home'); clearError(); }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:border-amber-400/50 hover:bg-amber-400/15 hover:text-amber-200 transition-all cursor-pointer active:scale-95 shrink-0 shadow-inner"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                  <span>Create Match Lobby</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/20 to-orange-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-300 uppercase tracking-wider shadow-sm">
                    <Crown className="w-3 h-3 text-amber-300" /> Host
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Configure match rules & lobby settings</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Mode Selector - Luxury Glass Cards without heart/clock icons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setGameMode('HP')}
                  className={`relative p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    gameMode === 'HP'
                      ? 'border-amber-400/70 bg-gradient-to-b from-amber-500/20 via-amber-950/30 to-slate-900/80 text-white shadow-[0_0_20px_rgba(245,158,11,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-amber-400/40'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`block text-xs sm:text-sm font-black ${gameMode === 'HP' ? 'text-white' : 'text-slate-300'}`}>
                      HP Battle
                    </span>
                    {gameMode === 'HP' && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,1)] animate-pulse" />
                    )}
                  </div>
                  <span className={`mt-0.5 block text-[11px] font-medium ${gameMode === 'HP' ? 'text-amber-200/80' : 'text-slate-500'}`}>
                    Score drains health
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setGameMode('TURNS')}
                  className={`relative p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    gameMode === 'TURNS'
                      ? 'border-amber-400/70 bg-gradient-to-b from-amber-500/20 via-amber-950/30 to-slate-900/80 text-white shadow-[0_0_20px_rgba(245,158,11,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-amber-400/40'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`block text-xs sm:text-sm font-black ${gameMode === 'TURNS' ? 'text-white' : 'text-slate-300'}`}>
                      Round Match
                    </span>
                    {gameMode === 'TURNS' && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,1)] animate-pulse" />
                    )}
                  </div>
                  <span className={`mt-0.5 block text-[11px] font-medium ${gameMode === 'TURNS' ? 'text-amber-200/80' : 'text-slate-500'}`}>
                    Highest score wins
                  </span>
                </button>
              </div>

              {/* 2-Column: HP/Rounds + Timer */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {gameMode === 'HP' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Starting HP</label>
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
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Round Count</label>
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
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Turn Timer</label>
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
                <div className="flex items-center rounded-xl border border-white/15 bg-slate-950/80 p-1 shadow-inner focus-within:border-amber-400/80 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.max(10, (Number(prev) || 100) - 10)))}
                    className="flex h-9 w-10 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
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
                  <span className="text-[11px] font-bold text-amber-300 mr-2.5 uppercase tracking-wider">HP</span>
                  <button
                    type="button"
                    onClick={() => setCustomHp(prev => String(Math.min(1000, (Number(prev) || 100) + 10)))}
                    className="flex h-9 w-10 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {gameMode === 'TURNS' && turnCountOption === 'custom' && (
                <div className="flex items-center rounded-xl border border-white/15 bg-slate-950/80 p-1 shadow-inner focus-within:border-amber-400/80 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.max(1, (Number(prev) || 7) - 1)))}
                    className="flex h-9 w-10 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
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
                  <span className="text-[11px] font-bold text-amber-300 mr-2.5 uppercase tracking-wider">Rounds</span>
                  <button
                    type="button"
                    onClick={() => setCustomTurnCount(prev => String(Math.min(500, (Number(prev) || 7) + 1)))}
                    className="flex h-9 w-10 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Player Limit & Grimoire */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Players</label>
                  <div className="flex rounded-xl bg-black/40 border border-white/10 p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setPlayerLimitOption('4')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black cursor-pointer transition-all ${
                        playerLimitOption === '4'
                          ? 'bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/60 text-amber-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      4P
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlayerLimitOption('custom')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black cursor-pointer transition-all ${
                        playerLimitOption === 'custom'
                          ? 'bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/60 text-amber-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Grimoire Deck</label>
                  <RockerSwitch checked={enableGrimoire} onChange={setEnableGrimoire} />
                </div>
              </div>

              {/* Host Name Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Your Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="Enter your name..."
                    maxLength={24}
                    className="w-full rounded-xl border border-white/15 bg-slate-950/80 pl-3.5 pr-10 py-2.5 text-sm font-semibold text-white outline-none focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/20 transition-all placeholder:text-slate-500 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = getRandomPlayerName();
                      setName(rand);
                      clearError();
                    }}
                    title="Random Name"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-amber-400/20 to-orange-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-400/30 transition-all cursor-pointer"
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

              {/* Submit CTA - Matches Home Screen Celestial Gold Button */}
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:via-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm sm:text-base tracking-wider uppercase shadow-[0_10px_35px_rgba(245,158,11,0.4)] hover:shadow-[0_14px_45px_rgba(245,158,11,0.55)] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2.5 border border-amber-300/60"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Creating Lobby...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 text-slate-950 fill-slate-950/20" />
                    <span>HOST ROOM</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBMENU: JOIN ROOM (COSMIC GLASS IDENTITY) */}
        {/* ======================================================== */}
        {mode === 'join' && (
          <div className="relative w-full max-w-lg rounded-[28px] sm:rounded-[32px] border border-white/15 bg-gradient-to-b from-slate-900/90 via-[#0a0f24]/95 to-[#050814]/98 p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(6,182,212,0.12)] backdrop-blur-2xl ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Soft Cyan Accent Line */}
            <span className="absolute inset-x-12 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('home'); clearError(); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-400/15 hover:text-cyan-200 transition-all cursor-pointer active:scale-95 shrink-0 shadow-inner"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <span>Join Match</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-500/20 border border-cyan-400/40 px-2 py-0.5 text-[10px] font-black text-cyan-300 uppercase tracking-wider shadow-sm">
                      <Radio className="w-3 h-3 text-cyan-300" /> Signal
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">Enter room PIN or select an open room</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fetchRooms(true)}
                disabled={loadingRooms}
                className="p-2 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-400/40 hover:bg-cyan-400/15 text-slate-300 transition-all cursor-pointer active:scale-95 shadow-inner"
                title="Refresh Room List"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Your Name Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Your Name</label>
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name..."
                    maxLength={24}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/90 pl-3.5 pr-10 py-2.5 text-sm text-white outline-none focus:border-cyan-400/80 focus:ring-2 focus:ring-cyan-400/20 transition-all placeholder:text-slate-500 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = getRandomPlayerName();
                      setName(rand);
                      clearError();
                    }}
                    title="Random Name"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/25 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Rooms */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Active Lobbies ({rooms.length})
                  </span>
                  {loadingRooms && <span className="text-[9px] text-cyan-300 animate-pulse font-semibold">Refreshing...</span>}
                </div>

                {rooms.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-2 pr-1 custom-scrollbar">
                    {rooms.map(room => {
                      const isPlaying = room.status === 'PLAYING';
                      const isSelected = pin === room.game_pin;

                      return (
                        <div
                          key={room.id}
                          onClick={() => handleSelectRoom(room)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-2 border-cyan-400/80 bg-cyan-400/10 shadow-[0_0_15px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/30'
                              : 'border border-white/10 bg-slate-900/60 hover:border-cyan-400/30 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 font-black text-xs shadow-md">
                            {(room.host_name || 'H').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-white truncate">{room.host_name}</span>
                              {isPlaying ? (
                                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[8px] font-black tracking-wider">LIVE</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[8px] font-black tracking-wider">OPEN</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-0.5 font-medium">
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
                  <div className="py-4 text-center rounded-2xl border border-dashed border-white/10 bg-slate-900/40 text-xs text-slate-400 font-medium">
                    No active rooms found. Host a game to start!
                  </div>
                )}
              </div>

              {/* PIN & Submit */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Game PIN</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => e.key === 'Enter' && (isSelectedRoomPlaying ? handleWatch() : handleJoin())}
                    placeholder="6-digit PIN..."
                    maxLength={6}
                    className="w-full rounded-xl border border-white/10 bg-slate-900/90 pl-3.5 pr-28 py-3 font-mono text-base tracking-[0.25em] text-cyan-300 outline-none focus:border-cyan-400/80 focus:ring-2 focus:ring-cyan-400/20 transition-all placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-sans shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={isSelectedRoomPlaying ? handleWatch : handleJoin}
                    disabled={loading || !pin.trim()}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-5 rounded-lg bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 hover:from-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(6,182,212,0.35)] hover:shadow-[0_0_22px_rgba(6,182,212,0.55)] transition-all cursor-pointer disabled:opacity-40"
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
        {/* SUBMENU: SOLO VS BOT (COSMIC GLASS IDENTITY) */}
        {/* ======================================================== */}
        {mode === 'bot' && (
          <div className="relative w-full max-w-lg rounded-[28px] sm:rounded-[32px] border border-white/15 bg-gradient-to-b from-slate-900/90 via-[#0a0f24]/95 to-[#050814]/98 p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(168,85,247,0.12)] backdrop-blur-2xl ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Soft Purple Accent Line */}
            <span className="absolute inset-x-12 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setMode('home'); clearError(); }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:border-purple-400/50 hover:bg-purple-400/15 hover:text-purple-200 transition-all cursor-pointer active:scale-95 shrink-0 shadow-inner"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    <span>Solo vs AI Bot</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-400/20 to-indigo-500/20 border border-purple-400/40 px-2 py-0.5 text-[10px] font-black text-purple-300 uppercase tracking-wider shadow-sm">
                      <Bot className="w-3 h-3 text-purple-300" /> AI Practice
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">Select bot difficulty and battle rules</p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* Bot Difficulty */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Opponent</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const profile = BOT_PROFILES[diff];
                    const isSelected = botDifficulty === diff;
                    return (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setBotDifficulty(diff)}
                        className={`flex flex-col items-center p-2.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-2 border-purple-400/80 bg-purple-400/10 shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/30'
                            : 'border border-white/10 bg-slate-900/60 text-slate-400 hover:border-purple-400/30 hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                      >
                        <Bot className={`w-5 h-5 mb-1 ${isSelected ? 'text-purple-300' : 'text-slate-400'}`} />
                        <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {profile.title}
                        </span>
                        <span className="text-[9px] text-purple-300 font-bold mt-0.5">{profile.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Game Mode - No icons, unified purple palette */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setGameMode('HP')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    gameMode === 'HP'
                      ? 'border-2 border-purple-400/80 bg-purple-400/10 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] ring-1 ring-purple-400/30'
                      : 'border border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20 hover:bg-slate-800/60'
                  }`}
                >
                  <span className={`block font-black text-xs sm:text-sm ${gameMode === 'HP' ? 'text-white' : 'text-slate-300'}`}>
                    HP Battle
                  </span>
                  <span className={`text-[10px] font-medium ${gameMode === 'HP' ? 'text-purple-200/80' : 'text-slate-400'}`}>
                    Score deals HP damage
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setGameMode('TURNS')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    gameMode === 'TURNS'
                      ? 'border-2 border-purple-400/80 bg-purple-400/10 text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] ring-1 ring-purple-400/30'
                      : 'border border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20 hover:bg-slate-800/60'
                  }`}
                >
                  <span className={`block font-black text-xs sm:text-sm ${gameMode === 'TURNS' ? 'text-white' : 'text-slate-300'}`}>
                    Round Match
                  </span>
                  <span className={`text-[10px] font-medium ${gameMode === 'TURNS' ? 'text-purple-200/80' : 'text-slate-400'}`}>
                    Highest total score wins
                  </span>
                </button>
              </div>

              {/* Matchup Summary */}
              <div className="flex items-center justify-between p-3 rounded-2xl border border-purple-400/25 bg-purple-950/25 shadow-inner">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="text-slate-400 font-semibold">Matchup:</span>
                  <span className="font-bold text-white">{name.trim() || 'Player'}</span>
                  <span className="text-purple-400 font-black">VS</span>
                  <span className="font-bold text-purple-300">{BOT_PROFILES[botDifficulty].name}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-[9px] font-black text-purple-200 uppercase tracking-wider">
                  1v1 Match
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
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-black text-sm sm:text-base tracking-wider uppercase shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_28px_rgba(168,85,247,0.5)] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 border border-purple-300/40"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Starting AI Match...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 text-white" />
                    <span>START BOT MATCH</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </main>

      {/* BOTTOM ACTION BAR */}
      <footer className="relative z-30 w-full max-w-[550px] flex items-center justify-center gap-2.5 sm:gap-3 shrink-0 pt-2 pb-1 sm:pb-2">
        {/* Match Logs Button */}
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="group flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-r from-cyan-500/20 via-cyan-950/50 to-blue-500/20 hover:from-cyan-500/35 hover:to-blue-500/35 hover:border-cyan-300 text-xs sm:text-sm font-black text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.55)] hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl"
        >
          <History className="w-4 h-4 text-cyan-300 group-hover:rotate-[-20deg] transition-transform drop-shadow-[0_0_8px_rgba(6,182,212,0.9)]" strokeWidth={2.5} />
          <span className="tracking-wide">Match Logs</span>
        </button>

        {/* Rules & Guide Button */}
        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="group flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-amber-950/50 to-orange-500/20 hover:from-amber-500/35 hover:to-orange-500/35 hover:border-amber-300 text-xs sm:text-sm font-black text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.55)] hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl"
        >
          <BookOpen className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" strokeWidth={2.5} />
          <span className="tracking-wide">Rules & Guide</span>
        </button>

        <FullscreenButton className="static z-10" />
      </footer>

      {/* Global Modals */}
      {isGuideOpen && (
        <GameGuideModal isOpen onClose={() => setIsGuideOpen(false)} />
      )}

      <MatchHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}
