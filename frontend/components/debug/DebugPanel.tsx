'use client';

import React, { useRef, useState } from 'react';
import { Player, GameState, Tile, CARD_TYPES } from '@/lib/types';
import { debugSetHp, debugSetRackTile, debugGrantCard, debugClearCards, StoredSession } from '@/lib/api';
import { isBlankLetter } from '@/lib/tiles';
import { Bug, X, Sparkles, Heart, Shield, Zap, Snowflake, Lightbulb, Trash2, ArrowLeftRight, ChevronDown, Check, Flame, Swords } from 'lucide-react';

interface DebugPanelProps {
  gameId: string;
  players: Player[];
  sessions: StoredSession[];
  activePlayerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSwitchPlayer: (session: StoredSession) => void;
  onGameState: (state: GameState) => void;
}

const CARD_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  HINT: { label: 'Hint', icon: <Lightbulb className="w-3.5 h-3.5 text-amber-300" />, color: 'text-amber-300', desc: 'Reveal top 3 moves' },
  SHIELD: { label: 'Shield', icon: <Shield className="w-3.5 h-3.5 text-blue-300" />, color: 'text-blue-300', desc: 'Block attack/swap' },
  HEAL: { label: 'Heal', icon: <Heart className="w-3.5 h-3.5 text-rose-300" />, color: 'text-rose-300', desc: 'Restore +1 HP' },
  FREEZE_TILE: { label: 'Freeze Word', icon: <Snowflake className="w-3.5 h-3.5 text-cyan-300" />, color: 'text-cyan-300', desc: 'Lock board tile' },
  DOUBLE_DAMAGE: { label: 'Word ×2', icon: <Swords className="w-3.5 h-3.5 text-purple-300" />, color: 'text-purple-300', desc: 'Double damage' },
  SPY_SWAP: { label: 'Swap Word', icon: <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-300" />, color: 'text-emerald-300', desc: 'Swap with rival' },
  DESTROY_TILE: { label: 'Clear Word', icon: <Flame className="w-3.5 h-3.5 text-orange-300" />, color: 'text-orange-300', desc: 'Destroy tile' },
};

const DebugTileInput: React.FC<{
  tile: Tile;
  slot: number;
  playerId: string;
  disabled: boolean;
  onEdit: (playerId: string, slot: number, nextLetter: string, currentLetter: string) => void;
}> = ({ tile, slot, playerId, disabled, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const isBlank = isBlankLetter(tile.letter);

  if (isBlank && !isEditing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsEditing(true)}
        title="Blank tile (Click to edit letter A-Z or ?)"
        className="h-7 w-7 rounded-lg bg-gradient-to-b from-amber-100 to-amber-200 border border-amber-400/80 flex items-center justify-center text-amber-950 shadow-sm transition-all hover:ring-2 hover:ring-rose-400 cursor-pointer shrink-0"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-amber-950 stroke-amber-950" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M12 0L14.4 8.6L23 11L14.4 13.4L12 22L9.6 13.4L1 11L9.6 8.6L12 0Z" />
        </svg>
      </button>
    );
  }

  return (
    <input
      key={`${tile.id}:${tile.letter}`}
      defaultValue={isBlank ? '?' : tile.letter}
      maxLength={1}
      disabled={disabled}
      autoFocus={isEditing}
      title="Edit letter (Type A-Z or ? for blank)"
      onFocus={e => e.target.select()}
      onBlur={e => {
        setIsEditing(false);
        onEdit(playerId, slot, e.target.value, tile.letter);
      }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className="h-7 w-7 rounded-lg bg-gradient-to-b from-amber-100 to-amber-200 border border-amber-400/80 text-center text-xs font-black uppercase text-stone-950 focus:outline-none focus:ring-2 focus:ring-rose-400 shadow-sm transition-all shrink-0"
    />
  );
};

export const DebugPanel: React.FC<DebugPanelProps> = ({
  gameId,
  players,
  sessions,
  activePlayerId,
  isOpen,
  onClose,
  onSwitchPlayer,
  onGameState,
}) => {
  const [busy, setBusy] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [completedAction, setCompletedAction] = useState<{ playerId: string; type: string } | null>(null);
  const [selectedCards, setSelectedCards] = useState<Record<string, string>>({});
  const [openDropdownPlayerId, setOpenDropdownPlayerId] = useState<string | null>(null);
  const hpInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const run = async (fn: () => Promise<GameState>, actionName: string, playerId: string = '', actionType: string = '') => {
    if (busy) return;
    setBusy(true);
    try {
      const newState = await fn();
      onGameState(newState);
      setStatusFeedback({ type: 'success', message: `${actionName} Complete` });
      if (playerId && actionType) {
        setCompletedAction({ playerId, type: actionType });
        setTimeout(() => setCompletedAction(null), 1800);
      }
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : `${actionName} Failed`,
      });
      setTimeout(() => setStatusFeedback(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  const handleSetHp = (playerId: string) => {
    const raw = hpInputRefs.current[playerId]?.value ?? '';
    const hp = Number(raw);
    if (!Number.isFinite(hp)) return;
    void run(() => debugSetHp(gameId, playerId, Math.round(hp)), 'HP Update', playerId, 'hp');
  };

  const handleQuickHpAdjust = (playerId: string, currentHp: number, delta: number) => {
    const targetHp = Math.max(0, currentHp + delta);
    if (hpInputRefs.current[playerId]) {
      hpInputRefs.current[playerId]!.value = String(targetHp);
    }
    void run(() => debugSetHp(gameId, playerId, targetHp), `HP ${delta > 0 ? `+${delta}` : delta}`, playerId, 'hp');
  };

  const handleEditTile = (playerId: string, slot: number, nextLetter: string, currentLetter: string) => {
    let letter = nextLetter.trim().toUpperCase();
    if (letter === '?' || letter === '*' || letter === '_' || letter === 'BLANK' || letter === '✦') {
      letter = 'BLANK';
    } else if (!/^[A-Z]$/.test(letter)) {
      return;
    }
    if (!letter || letter === currentLetter) return;
    void run(() => debugSetRackTile(gameId, playerId, slot, letter), `Tile [${letter === 'BLANK' ? '✦' : letter}]`, playerId, 'tile');
  };

  const handleGrantCard = (playerId: string) => {
    const card = selectedCards[playerId] || CARD_TYPES[0];
    const cardMeta = CARD_CONFIG[card]?.label || card;
    void run(() => debugGrantCard(gameId, playerId, card), `Grant ${cardMeta}`, playerId, 'grant');
  };

  const handleClearCards = (playerId: string, cardIndex?: number) => {
    void run(
      () => debugClearCards(gameId, playerId, cardIndex),
      cardIndex !== undefined ? 'Card Removed' : 'Clear All Cards',
      playerId,
      'clear'
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-14 right-3 sm:right-4 z-[200] w-[22.5rem] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4.5rem)] flex flex-col rounded-2xl border border-rose-500/60 bg-slate-950/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_24px_rgba(244,63,94,0.25)] text-slate-200 text-xs overflow-hidden select-none animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-rose-500/20">
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
          onClick={() => { onClose(); setOpenDropdownPlayerId(null); }}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Close Debug Console"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Notification Status Banner */}
      {statusFeedback && (
        <div
          className={`border-b px-3 py-1.5 text-[11px] font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150 transition-all ${
            statusFeedback.type === 'success'
              ? 'border-emerald-500/50 bg-emerald-950/90 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'border-rose-500/50 bg-rose-950/90 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {statusFeedback.type === 'success' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />
            ) : (
              <span className="text-rose-400 shrink-0">⚠️</span>
            )}
            <span className="truncate">{statusFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="p-0.5 text-slate-400 hover:text-white shrink-0 ml-2"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Roster & Controls Scrollable Area */}
      <div className="flex flex-col gap-3 p-3 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {players.map(player => {
          const session = sessions.find(s => s.playerId === player.id);
          const isActing = player.id === activePlayerId;
          const currentSelectedCard = selectedCards[player.id] || CARD_TYPES[0];
          const selectedCardMeta = CARD_CONFIG[currentSelectedCard] || { label: currentSelectedCard, icon: <Sparkles className="w-3.5 h-3.5 text-cyan-300" />, color: 'text-cyan-300', desc: '' };
          const isDropdownOpen = openDropdownPlayerId === player.id;

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
                    className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-sm active:scale-95 transition-all ${
                      completedAction?.playerId === player.id && completedAction?.type === 'hp'
                        ? 'bg-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {completedAction?.playerId === player.id && completedAction?.type === 'hp' ? 'Done ✓' : 'Set'}
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
                    <DebugTileInput
                      key={`${tile.id}:${tile.letter}`}
                      tile={tile}
                      slot={slot}
                      playerId={player.id}
                      disabled={busy}
                      onEdit={handleEditTile}
                    />
                  ))}
                </div>
              </div>

              {/* Styled Power Card Dropdown Spawner */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spawn Power Card</span>
                  <span className="text-[9px] font-mono text-cyan-400">Instant</span>
                </div>

                <div className="relative flex items-center gap-1.5">
                  {/* Custom Styled Select Trigger */}
                  <div className="relative flex-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setOpenDropdownPlayerId(isDropdownOpen ? null : player.id)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-700/80 hover:border-cyan-400/60 text-slate-100 text-xs font-bold transition-all cursor-pointer shadow-xs focus:ring-1 focus:ring-cyan-400/50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1 rounded-md bg-slate-800 border border-slate-700">
                          {selectedCardMeta.icon}
                        </div>
                        <span className={`truncate font-extrabold ${selectedCardMeta.color}`}>{selectedCardMeta.label}</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                    </button>

                    {/* Dropdown Options Menu */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-slate-700 bg-slate-950/98 backdrop-blur-2xl shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 max-h-48 overflow-y-auto [scrollbar-width:none]">
                        {CARD_TYPES.map(card => {
                          const meta = CARD_CONFIG[card] || { label: card, icon: <Sparkles className="w-3 h-3 text-cyan-300" />, color: 'text-cyan-300', desc: '' };
                          const isSelected = card === currentSelectedCard;

                          return (
                            <button
                              key={card}
                              type="button"
                              onClick={() => {
                                setSelectedCards(prev => ({ ...prev, [player.id]: card }));
                                setOpenDropdownPlayerId(null);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-950/70 border border-cyan-500/50 text-white font-black'
                                  : 'hover:bg-slate-800/80 text-slate-300 hover:text-white font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="p-1 rounded bg-slate-900 border border-slate-800">
                                  {meta.icon}
                                </div>
                                <div className="flex flex-col items-start">
                                  <span className={`font-bold text-[11px] ${meta.color}`}>{meta.label}</span>
                                  <span className="text-[9px] text-slate-500">{meta.desc}</span>
                                </div>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Grant Action Button */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleGrantCard(player.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 shrink-0 ${
                      completedAction?.playerId === player.id && completedAction?.type === 'grant'
                        ? 'bg-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(52,211,153,0.6)]'
                        : 'bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:brightness-110 active:scale-95 text-slate-950 shadow-[0_0_14px_rgba(6,182,212,0.45)]'
                    }`}
                  >
                    {completedAction?.playerId === player.id && completedAction?.type === 'grant' ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Complete</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Grant</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Hand Cards Tags */}
                {(player.cards ?? []).length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-0.5 pt-1.5 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Hand ({(player.cards ?? []).length})
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleClearCards(player.id)}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 ${
                          completedAction?.playerId === player.id && completedAction?.type === 'clear'
                            ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-300'
                            : 'border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white'
                        }`}
                        title="Clear all cards for this player"
                      >
                        {completedAction?.playerId === player.id && completedAction?.type === 'clear' ? (
                          <>
                            <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
                            <span>Cleared</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-2.5 h-2.5 text-rose-400" />
                            <span>Clear All</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {(player.cards ?? []).map((card, idx) => {
                        const cfg = CARD_CONFIG[card];
                        return (
                          <div
                            key={idx}
                            className="group flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-md border border-slate-700 bg-slate-800/90 text-[10px] font-bold text-slate-300 hover:border-rose-400/60 transition-all shadow-xs"
                          >
                            {cfg?.icon}
                            <span className={cfg?.color || 'text-slate-200'}>{cfg?.label || card}</span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleClearCards(player.id, idx)}
                              className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer"
                              title="Remove this card"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
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
