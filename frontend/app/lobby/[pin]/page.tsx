'use client';

import React, { startTransition, useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { getRoom, leaveRoom, startGame, sessionStore } from '../../../lib/api';
import { PinDisplay } from '../../../components/lobby/PinDisplay';
import { PlayerList } from '../../../components/lobby/PlayerList';
import ParticleField from '../../../components/effects/ParticleField';
import { Player } from '../../../lib/types';
import { useGameSocket } from '../../../hooks/useGameSocket';

/** Matches MIN_PLAYERS on the backend: a host may start alone and play solo. */
const MIN_PLAYERS = 1;

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const pin = params.pin as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  // The room says who hosts: the host can leave and hand the room to someone else.
  const [hostPlayerId, setHostPlayerId] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const playerSlots = Array.from({ length: 4 }, (_, index) => players[index] ?? null);
  const spectatorSlots = Array.from({ length: 2 }, (_, index) => (index < spectatorCount ? { name: `ผู้ชม ${index + 1}` } : null));
  const [leaving, setLeaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [turnTimeLimit, setTurnTimeLimit] = useState<number | null>(null);

  const { isConnected: spectatorConnected, connectionError: spectatorConnectionError } = useGameSocket({
    gameId: isSpectator ? (gameId ?? '') : '',
    spectate: isSpectator,
  });

  // Load session
  useEffect(() => {
    const session = sessionStore.getLast();
    if (!session) {
      router.replace('/');
      return;
    }
    startTransition(() => {
      setMyPlayerId(session.playerId);
      setGameId(session.gameId);
      setIsSpectator(Boolean(session.isSpectator));
    });
  }, [router]);

  const isHost = Boolean(myPlayerId && hostPlayerId === myPlayerId);

  const fetchRoom = useCallback(async () => {
    try {
      const room = await getRoom(pin);
      setPlayers(room.players);
      setHostPlayerId(room.host_player_id);
      setSpectatorCount(room.spectator_count ?? 0);
      setTurnTimeLimit(room.turn_time_limit);
      setLoading(false);
      // If game already started, redirect to game
      if (room.status === 'PLAYING' || room.status === 'ACTIVE') {
        const session = sessionStore.getLast();
        if (session) router.replace(`/game/${session.gameId}`);
      }
    } catch {
      setLoading(false);
    }
  }, [pin, router]);

  // Poll room state every 2 seconds
  useEffect(() => {
    const initialFetch = setTimeout(() => { void fetchRoom(); }, 0);
    const interval = setInterval(fetchRoom, 2000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchRoom]);

  const handleStart = async () => {
    if (!gameId || !myPlayerId) return;
    setStarting(true);
    setError('');
    try {
      await startGame(pin, myPlayerId);
      router.push(`/game/${gameId}`);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to start game');
      setStarting(false);
    }
  };

  /** Gives the seat back so the game does not deal this player in and wait for their turns. */
  const handleLeave = async () => {
    setLeaving(true);
    if (myPlayerId) await leaveRoom(pin, myPlayerId).catch(() => undefined);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading lobby...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 gap-6 overflow-hidden">
      <ParticleField className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80" />
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <Image
            src="/wordx-icon.png?v=20260915"
            alt="WordX logo"
            width={72}
            height={72}
            priority
            className="mx-auto mb-2 h-[72px] w-[72px] object-contain drop-shadow-2xl"
          />
          <h1 className="text-3xl font-black text-white tracking-tight">
            Word<span className="text-amber-400">X</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isHost ? 'Share the PIN and start when ready!' : 'Waiting for host to start the game...'}
          </p>
        </div>

        {/* PIN Display */}
        <PinDisplay pin={pin} />

        <div className="text-sm text-slate-300 bg-slate-900/70 border border-slate-700/50 rounded-xl px-4 py-2">
          Turn Time: <span className="font-semibold text-amber-300">{turnTimeLimit === null ? 'Unlimited' : `${turnTimeLimit} sec`}</span>
        </div>

        {/* Player List */}
        <div className="w-full bg-slate-900/80 border border-slate-700/50 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
          <div className="mb-4 rounded-2xl border border-slate-700/60 bg-slate-950/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">ผู้เล่น</span>
              <span className="text-[10px] text-slate-300">{players.length}/4</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {playerSlots.map((player, index) => (
                <div
                  key={`player-slot-${index}`}
                  className={`flex min-h-[48px] items-center justify-center rounded-xl border px-2 text-center text-xs ${
                    player
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                      : 'border-dashed border-slate-600/80 bg-slate-800/30 text-slate-500'
                  }`}
                >
                  {player ? player.display_name : 'ผู้เล่นว่าง'}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-700/60 bg-slate-950/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">ผู้ชม</span>
              <span className="text-[10px] text-slate-300">{spectatorCount}/2</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {spectatorSlots.map((slot, index) => (
                <div
                  key={`spectator-slot-${index}`}
                  className={`flex min-h-[48px] items-center justify-center rounded-xl border px-2 text-center text-xs ${
                    slot
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-100'
                      : 'border-dashed border-slate-600/80 bg-slate-800/30 text-slate-500'
                  }`}
                >
                  {slot ? slot.name : 'ผู้ชมว่าง'}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-sky-500/20 bg-sky-950/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">โหมดผู้ชม</p>
                <p className="mt-1 text-xs text-slate-400">รับชมเกมได้สูงสุด 2 คน</p>
              </div>
              <span className="whitespace-nowrap text-sm font-semibold text-sky-100">
                {spectatorCount}/2 คน
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              ว่างอีก <span className="font-bold text-sky-200">{Math.max(0, 2 - spectatorCount)} ที่</span>
              {isSpectator && (
                <span className={spectatorConnected ? 'text-emerald-300' : 'text-amber-300'}>
                  {' '}· {spectatorConnected ? 'กำลังรับชมอยู่' : 'กำลังเชื่อมต่อ...'}
                </span>
              )}
            </p>
            {isSpectator && spectatorConnectionError && (
              <p className="mt-2 text-xs text-red-300">เชื่อมต่อโหมดผู้ชมไม่สำเร็จ กรุณารีเฟรชหน้า</p>
            )}
          </div>

          <PlayerList players={players} myPlayerId={myPlayerId} />

          <p className="mt-4 text-xs text-slate-300">
            {isSpectator
              ? 'คุณกำลังเข้าร่วมในโหมดผู้ชม'
              : players.length >= 4
                ? 'ผู้เล่นเต็มแล้ว สามารถเข้าเป็นผู้ชมได้เท่านั้น'
                : 'คนที่เข้ามาหลังจากผู้เล่นเต็ม 4 คน จะถูกส่งไปยังโหมดผู้ชม'}
          </p>

          {players.length < 2 && (
            <p className="text-center text-slate-500 text-sm mt-4">
              Waiting for other players to join... {isHost && '(or start now to play solo)'}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {/* Start Button (host only) */}
        {isHost && (
          <button
            onClick={handleStart}
            disabled={starting || leaving || players.length < MIN_PLAYERS}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            {starting ? 'Starting...' : '▶ Start Game'}
          </button>
        )}

        {!isHost && (
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm">
              {isSpectator ? '👁 Watching: the board opens when the host starts' : 'Waiting for host to start...'}
            </span>
          </div>
        )}

        {/* Back to home */}
        <button
          onClick={handleLeave}
          disabled={leaving || starting}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors disabled:opacity-40"
        >
          {leaving ? 'Leaving...' : isSpectator ? '← Stop watching' : '← Leave lobby'}
        </button>
      </div>
    </div>
  );
}
