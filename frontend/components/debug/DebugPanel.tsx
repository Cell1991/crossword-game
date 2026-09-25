'use client';

import React, { useRef, useState } from 'react';
import { Player, GameState, CARD_TYPES } from '@/lib/types';
import { debugSetHp, debugSetRackTile, debugGrantCard, StoredSession } from '@/lib/api';

interface DebugPanelProps {
  gameId: string;
  players: Player[];
  sessions: StoredSession[];
  activePlayerId: string | null;
  onSwitchPlayer: (session: StoredSession) => void;
  onGameState: (state: GameState) => void;
}

/**
 * God-mode overlay for /debug games: reveals every player's rack (the backend already sends
 * them all when `?debug=1`, see GameService.get_game_state reveal_all), and lets the tester
 * switch who they're "acting as" plus freely edit HP, rack letters, and hand contents.
 *
 * Inline inputs only, deliberately: window.prompt()/alert() throw inside embedded/automated
 * browser contexts (confirmed while testing this panel), so this avoids them entirely.
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({
  gameId, players, sessions, activePlayerId, onSwitchPlayer, onGameState,
}) => {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cardPicks, setCardPicks] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const hpInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const run = async (fn: () => Promise<GameState>) => {
    if (busy) return;
    setBusy(true);
    try {
      onGameState(await fn());
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

  const handleEditTile = (playerId: string, slot: number, nextLetter: string, currentLetter: string) => {
    const letter = nextLetter.trim().toUpperCase();
    if (!letter || letter === currentLetter || !/^[A-Z]$/.test(letter)) return;
    void run(() => debugSetRackTile(gameId, playerId, slot, letter));
  };

  const handleGrantCard = (playerId: string) => {
    const card = cardPicks[playerId] ?? CARD_TYPES[0];
    void run(() => debugGrantCard(gameId, playerId, card));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 z-[200] rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-xl"
      >
        🐞 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-[200] w-[20rem] max-h-[80vh] overflow-y-auto rounded-2xl border border-rose-500/50 bg-slate-950/95 backdrop-blur-md shadow-2xl text-slate-200 text-xs">
      <div className="sticky top-0 flex items-center justify-between border-b border-rose-500/30 bg-rose-950/60 px-3 py-2">
        <span className="font-bold text-rose-300">🐞 Debug Panel</span>
        <button onClick={() => setOpen(false)} className="text-rose-300 hover:text-white">✕</button>
      </div>

      {errorMsg && <div className="border-b border-red-500/30 bg-red-950/50 px-3 py-1.5 text-red-300">{errorMsg}</div>}

      <div className="flex flex-col gap-3 p-3">
        {players.map(player => {
          const session = sessions.find(s => s.playerId === player.id);
          const isActing = player.id === activePlayerId;
          return (
            <div key={player.id} className={`rounded-xl border p-2 ${isActing ? 'border-amber-400/60 bg-amber-950/20' : 'border-slate-700 bg-slate-900/50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white truncate">{player.display_name}</span>
                {session && (
                  <button
                    onClick={() => onSwitchPlayer(session)}
                    disabled={isActing}
                    className="shrink-0 rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 disabled:opacity-40"
                  >
                    {isActing ? 'Acting as' : 'Act as'}
                  </button>
                )}
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-slate-400">HP</span>
                <input
                  key={`${player.id}:${player.hp}`}
                  ref={el => { hpInputRefs.current[player.id] = el; }}
                  type="number"
                  defaultValue={player.hp}
                  disabled={busy}
                  onKeyDown={e => { if (e.key === 'Enter') handleSetHp(player.id); }}
                  className="w-14 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] text-white"
                />
                <button
                  onClick={() => handleSetHp(player.id)}
                  disabled={busy}
                  className="rounded-full border border-rose-400/40 px-2 py-0.5 text-[10px] font-bold text-rose-300 hover:bg-rose-900/40 disabled:opacity-40"
                >
                  Set
                </button>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {(player.rack ?? []).length === 0 && <span className="text-slate-500">no tiles</span>}
                {(player.rack ?? []).map((tile, slot) => (
                  <input
                    key={`${tile.id}:${tile.letter}`}
                    defaultValue={tile.letter}
                    maxLength={1}
                    disabled={busy}
                    title="Edit letter"
                    onFocus={e => e.target.select()}
                    onBlur={e => handleEditTile(player.id, slot, e.target.value, tile.letter)}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="h-6 w-6 rounded bg-amber-100 text-center text-[11px] font-black uppercase text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-40"
                  />
                ))}
              </div>

              <div className="mt-1.5 flex items-center gap-1">
                <select
                  value={cardPicks[player.id] ?? CARD_TYPES[0]}
                  onChange={e => setCardPicks(prev => ({ ...prev, [player.id]: e.target.value }))}
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] text-white"
                >
                  {CARD_TYPES.map(card => <option key={card} value={card}>{card}</option>)}
                </select>
                <button
                  onClick={() => handleGrantCard(player.id)}
                  disabled={busy}
                  className="shrink-0 rounded-full border border-indigo-400/40 px-2 py-0.5 text-[10px] font-bold text-indigo-300 hover:bg-indigo-900/40 disabled:opacity-40"
                >
                  Grant
                </button>
              </div>
              {(player.cards ?? []).length > 0 && (
                <div className="mt-1 text-[10px] text-slate-400 truncate">Hand: {(player.cards ?? []).join(', ')}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
