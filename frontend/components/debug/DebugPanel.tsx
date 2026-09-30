'use client';

import React, { useRef, useState } from 'react';
import { Player, GameState, CARD_TYPES } from '@/lib/types';
import { debugSetHp, debugSetRackTile, debugGrantCard, StoredSession } from '@/lib/api';
import { Bug, X, Sparkles, Heart, Shield, Zap, Snowflake, RefreshCw, Flame, Lightbulb, Trash2, ArrowLeftRight } from 'lucide-react';

interface DebugPanelProps {
  gameId: string;
  players: Player[];
  sessions: StoredSession[];
  activePlayerId: string | null;
  onSwitchPlayer: (session: StoredSession) => void;
  onGameState: (state: GameState) => void;
}

const CARD_QUICK_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  HINT: { label: 'Hint', icon: <Lightbulb className="w-3 h-3 text-amber-300" />, color: 'border-amber-500/40 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60' },
  SHIELD: { label: 'Shield', icon: <Shield className="w-3 h-3 text-blue-300" />, color: 'border-blue-500/40 bg-blue-950/50 text-blue-200 hover:bg-blue-900/60' },
  HEAL: { label: 'Heal', icon: <Heart className="w-3 h-3 text-rose-300" />, color: 'border-rose-500/40 bg-rose-950/50 text-rose-200 hover:bg-rose-900/60' },
  FREEZE_TILE: { label: 'Freeze', icon: <Snowflake className="w-3 h-3 text-cyan-300" />, color: 'border-cyan-500/40 bg-cyan-950/50 text-cyan-200 hover:bg-cyan-900/60' },
  DOUBLE_DAMAGE: { label: 'Word ×2', icon: <Zap className="w-3 h-3 text-purple-300" />, color: 'border-purple-500/40 bg-purple-950/50 text-purple-200 hover:bg-purple-900/60' },
  SPY_SWAP: { label: 'Swap', icon: <ArrowLeftRight className="w-3 h-3 text-emerald-300" />, color: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/60' },
  DESTROY_TILE: { label: 'Clear', icon: <Trash2 className="w-3 h-3 text-orange-300" />, color: 'border-orange-500/40 bg-orange-950/50 text-orange-200 hover:bg-orange-900/60' },
};

export const DebugPanel: React.FC<DebugPanelProps> = ({
  gameId,
  players,
  sessions,
  activePlayerId,
  onSwitchPlayer,
  onGameState,
}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const hpInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const run = async (fn: () => Promise<GameState>) => {
    if (busy) return;
    setBusy(true);
    try {
      const newState = await fn();
      onGameState(newState);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Debug action failed');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setBusy(false);
    }
  };

  const handleSetHp = (playerId: string) => {
    const raw = hpInputRefs.current[playerId]?.value ?? '';
    const hp = Number(raw);
    if (!Number.isFinite(hp)) return;
    void run(() => debugSetHp(gameId, playerId, Math.round(hp)));
  };

  const handleQuickHpAdjust = (playerId: string, currentHp: number, delta: number) => {
    const targetHp = Math.max(0, currentHp + delta);
    if (hpInputRefs.current[playerId]) {
      hpInputRefs.current[playerId]!.value = String(targetHp);
    }
    void run(() => debugSetHp(gameId, playerId, targetHp));
  };

  const handleEditTile = (playerId: string, slot: number, nextLetter: string, currentLetter: string) => {
    const letter = nextLetter.trim().toUpperCase();
    if (!letter || letter === currentLetter || !/^[A-Z]$/.test(letter)) return;
    void run(() => debugSetRackTile(gameId, playerId, slot, letter));
  };

  const handleGrantCard = (playerId: string, card: string) => {
    void run(() => debugGrantCard(gameId, playerId, card));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-3.5 right-14 sm:right-16 z-[70] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 hover:bg-rose-950/70 border border-rose-500/60 text-rose-300 hover:text-white shadow-[0_0_16px_rgba(244,63,94,0.4)] ring-1 ring-rose-500/30 backdrop-blur-xl text-xs font-black tracking-wider uppercase transition-all duration-200 cursor-pointer active:scale-95"
        title="Open Developer Debug Console"
      >
        <Bug className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
        <span>Debug</span>
      </button>
    );
  }

  return (
    <div className="fixed top-14 right-3 sm:right-4 z-[200] w-[22rem] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4.5rem)] flex flex-col rounded-2xl border border-rose-500/60 bg-slate-950/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(244,63,94,0.25)] text-slate-200 text-xs overflow-hidden select-none animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-rose-500/20">
      {/* Console Top Header */}
      <div className="flex items-center justify-between border-b border-rose-500/30 bg-gradient-to-r from-rose-950/90 via-slate-950/90 to-rose-950/90 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-rose-500/20 border border-rose-400/50 shadow-[0_0_8px_rgba(244,63,94,0.4)]">
            <Bug className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <span className="font-black text-rose-300 uppercase tracking-wider text-xs">Debug Console</span>
            <span className="block text-[9px] font-mono text-slate-400">Sandbox Developer Tools</span>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close Debug Console"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {errorMsg && (
        <div className="border-b border-rose-500/40 bg-rose-950/80 px-3 py-1.5 text-[11px] font-bold text-rose-200 animate-fadeIn">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Roster & Controls Scrollable Area */}
      <div className="flex flex-col gap-3 p-3 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {players.map(player => {
          const session = sessions.find(s => s.playerId === player.id);
          const isActing = player.id === activePlayerId;

          return (
            <div
              key={player.id}
              className={`rounded-2xl border p-3 flex flex-col gap-2.5 transition-all ${
                isActing
                  ? 'border-amber-400/80 bg-gradient-to-b from-amber-950/40 to-slate-900/60 shadow-[0_0_16px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/40'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              {/* Player Header with Act As Switcher */}
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span className="font-extrabold text-white text-xs truncate drop-shadow-sm">{player.display_name}</span>
                </div>
                {session && (
                  <button
                    onClick={() => onSwitchPlayer(session)}
                    disabled={isActing}
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      isActing
                        ? 'bg-amber-400 text-neutral-950 shadow-[0_0_8px_rgba(245,158,11,0.6)] cursor-default'
                        : 'border border-amber-400/50 bg-amber-950/50 text-amber-300 hover:bg-amber-800/60 active:scale-95'
                    }`}
                  >
                    {isActing ? '⭐ Active' : 'Switch To'}
                  </button>
                )}
              </div>

              {/* Health Points Editor */}
              <div className="flex items-center justify-between gap-2 bg-slate-950/50 p-1.5 px-2 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-500/20" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Health</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    key={`${player.id}:${player.hp}`}
                    ref={el => { hpInputRefs.current[player.id] = el; }}
                    type="number"
                    defaultValue={player.hp}
                    disabled={busy}
                    onKeyDown={e => { if (e.key === 'Enter') handleSetHp(player.id); }}
                    className="w-12 h-6 rounded-lg border border-slate-700 bg-slate-900 px-1 text-center text-xs font-black text-white focus:outline-none focus:border-rose-400"
                  />
                  <button
                    onClick={() => handleSetHp(player.id)}
                    disabled={busy}
                    className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white px-2 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-sm active:scale-95 transition-all"
                  >
                    Set
                  </button>
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => handleQuickHpAdjust(player.id, player.hp, -5)}
                      disabled={busy}
                      className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-mono font-bold cursor-pointer"
                    >
                      -5
                    </button>
                    <button
                      onClick={() => handleQuickHpAdjust(player.id, player.hp, 5)}
                      disabled={busy}
                      className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-mono font-bold cursor-pointer"
                    >
                      +5
                    </button>
                  </div>
                </div>
              </div>

              {/* Rack Letter Editor (Interactive Tiles) */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Edit Rack Letters</span>
                <div className="flex flex-wrap gap-1">
                  {(player.rack ?? []).length === 0 && <span className="text-slate-500 italic text-[10px]">Rack is empty</span>}
                  {(player.rack ?? []).map((tile, slot) => (
                    <input
                      key={`${tile.id}:${tile.letter}`}
                      defaultValue={tile.letter}
                      maxLength={1}
                      disabled={busy}
                      title="Edit letter (Type A-Z)"
                      onFocus={e => e.target.select()}
                      onBlur={e => handleEditTile(player.id, slot, e.target.value, tile.letter)}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="h-7 w-7 rounded-lg bg-gradient-to-b from-amber-100 to-amber-200 border border-amber-400/80 text-center text-xs font-black uppercase text-stone-950 focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-sm transition-all"
                    />
                  ))}
                </div>
              </div>

              {/* Instant 1-Click Power Card Spawner */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Instant Card Spawner</span>
                  <span className="text-[9px] font-mono text-cyan-400">1-Click</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {CARD_TYPES.map(card => {
                    const cfg = CARD_QUICK_CONFIG[card] || { label: card, icon: <Sparkles className="w-3 h-3" />, color: 'border-slate-700 bg-slate-800 text-slate-300' };
                    return (
                      <button
                        key={card}
                        type="button"
                        disabled={busy}
                        onClick={() => handleGrantCard(player.id, card)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all duration-100 cursor-pointer shadow-xs active:scale-90 ${cfg.color}`}
                        title={`Instantly spawn ${cfg.label} card`}
                      >
                        {cfg.icon}
                        <span>+{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Hand Cards Tags */}
                {(player.cards ?? []).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5 pt-1 border-t border-slate-800">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Hand:</span>
                    {(player.cards ?? []).map((card, idx) => {
                      const cfg = CARD_QUICK_CONFIG[card];
                      return (
                        <span
                          key={idx}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-700 bg-slate-800/80 text-[9px] font-bold text-slate-300"
                        >
                          {cfg?.icon}
                          <span>{cfg?.label || card}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
