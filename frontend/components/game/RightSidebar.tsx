'use client';

import React, { memo, useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MoveHistoryEntry, Player, WordDefinition } from '@/lib/types';
import {
  Trophy,
  Crown,
  Wifi,
  WifiOff,
  History,
  ChevronDown,
  ChevronUp,
  Layers,
  BookOpen,
  Loader2,
  Copy,
  Check,
  Shield,
} from 'lucide-react';
import { cardIcon } from './cardIcons';
import { TileBagDialog } from './TileBagDialog';
import { getWordDefinition } from '@/lib/api';

interface RightSidebarProps {
  players: Player[];
  showHealth: boolean;
  currentPlayerId: string | null;
  myPlayerId: string | null;
  tileBagCount: number;
  tileBagCounts: Record<string, number>;
  moveHistory?: MoveHistoryEntry[];
  cardUseEffects?: Record<string, string>;
  mobile?: boolean;
}

export const RightSidebar = memo(function RightSidebar({
  players,
  showHealth,
  currentPlayerId,
  myPlayerId,
  tileBagCount,
  tileBagCounts,
  moveHistory = [],
  cardUseEffects = {},
  mobile = false,
}: RightSidebarProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(!mobile);
  const [isTileBagOpen, setIsTileBagOpen] = useState(false);
  const [expandedMoveId, setExpandedMoveId] = useState<string | null>(null);
  const [definitionsCache, setDefinitionsCache] = useState<Record<string, WordDefinition | null>>({});
  const [loadingWords, setLoadingWords] = useState<Record<string, boolean>>({});
  const [selectedWordByMove, setSelectedWordByMove] = useState<Record<string, string>>({});
  const [copiedWord, setCopiedWord] = useState<string | null>(null);

  const tileBagButtonRef = useRef<HTMLButtonElement>(null);
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  // Starting HP scales with the roster (see RoomService.start_game); the bar must scale with it too.
  const maxHp = 100 + Math.max(0, players.length - 2) * 20;

  const closeTileBag = useCallback(() => {
    setIsTileBagOpen(false);
    tileBagButtonRef.current?.focus();
  }, []);

  const fetchDefinition = useCallback(async (word: string) => {
    const cleanWord = word.trim().toUpperCase();
    if (!cleanWord || definitionsCache[cleanWord] !== undefined || loadingWords[cleanWord]) return;

    setLoadingWords(prev => ({ ...prev, [cleanWord]: true }));
    try {
      const def = await getWordDefinition(cleanWord);
      setDefinitionsCache(prev => ({ ...prev, [cleanWord]: def }));
    } catch {
      setDefinitionsCache(prev => ({ ...prev, [cleanWord]: null }));
    } finally {
      setLoadingWords(prev => ({ ...prev, [cleanWord]: false }));
    }
  }, [definitionsCache, loadingWords]);

  const toggleMoveAccordion = useCallback((entry: MoveHistoryEntry) => {
    if (expandedMoveId === entry.id) {
      setExpandedMoveId(null);
      return;
    }

    setExpandedMoveId(entry.id);

    // Determine words formed in this entry
    let words = entry.words;
    if (!words || words.length === 0) {
      if (entry.type === 'move' && entry.text.includes(':')) {
        const parts = entry.text.split(':');
        if (parts[1]) {
          words = parts[1].split(',').map(w => w.trim().toUpperCase()).filter(w => /^[A-Z]+$/.test(w));
        }
      }
    }

    if (words && words.length > 0) {
      const initialWord = selectedWordByMove[entry.id] || words[0];
      setSelectedWordByMove(prev => ({ ...prev, [entry.id]: initialWord }));
      fetchDefinition(initialWord);
    }
  }, [expandedMoveId, selectedWordByMove, fetchDefinition]);

  const selectWordForMove = useCallback((moveId: string, word: string) => {
    setSelectedWordByMove(prev => ({ ...prev, [moveId]: word }));
    fetchDefinition(word);
  }, [fetchDefinition]);

  const copyDefinitionText = useCallback((word: string, def?: WordDefinition | null) => {
    let copyText = word;
    if (def && def.meanings && def.meanings.length > 0) {
      const meaningsText = def.meanings
        .map(m => `[${m.partOfSpeech.toUpperCase()}] ${m.definitions.join('; ')}`)
        .join('\n');
      copyText = `${word}${def.phonetic ? ` ${def.phonetic}` : ''}\n${meaningsText}`;
    }
    navigator.clipboard?.writeText(copyText);
    setCopiedWord(word);
    window.setTimeout(() => setCopiedWord(null), 2000);
  }, []);

  return (
    <aside className={`game-match-sidebar flex h-full min-h-0 min-w-0 shrink-0 flex-col select-none ${mobile ? 'w-full p-0 bg-transparent' : 'w-full border-l border-slate-800/70 bg-slate-950/35'}`}>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        {/* TOP SECTION: COMPACT TILES STATUS CARD */}
        <div className="game-bag-panel shrink-0 px-4 pb-3 pt-3">
          <button
            ref={tileBagButtonRef}
            type="button"
            onClick={() => setIsTileBagOpen(true)}
            className="group flex w-full items-center justify-between rounded-xl border border-amber-300/20 bg-amber-300/[0.045] px-3.5 py-3 text-left transition-colors hover:border-amber-300/40 hover:bg-amber-300/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 cursor-pointer"
            aria-label={`Show remaining letters, ${tileBagCount} tiles remaining`}
          >
            <div className="flex items-center gap-2.5">
              {/* Golden Tile Stack Icon */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-300/35 bg-amber-300/10">
                <Layers className="h-4 w-4 text-amber-300" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300 group-hover:text-white transition-colors">Tiles left</span>
            </div>
            <span className="font-mono text-2xl font-black leading-none tabular-nums text-amber-300">
              {tileBagCount}
            </span>
          </button>
        </div>

        {/* MAIN SECTION: SCOREBOARD */}
        <div className="game-score-panel shrink-0 flex flex-col px-4 pb-4 pt-2">
          {/* Section Header */}
          <div className="mb-2 flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-300" />
              <span className="text-[10px] font-extrabold tracking-[0.16em] text-slate-300 uppercase">
                Players
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {players.length} {players.length === 1 ? 'Player' : 'Players'}
            </span>
          </div>

          {/* Players List */}
          <div className="game-players-list max-h-[42vh] space-y-1 overflow-y-auto px-0.5">
            {sortedPlayers.map((player, idx) => {
              const isCurrent = player.id === currentPlayerId;
              const isMe = player.id === myPlayerId;
              const isDead = player.hp <= 0;
              const hasLeft = player.connection_status === 'OFFLINE';

              return (
                <div
                  key={player.id}
                  className={`relative flex flex-col rounded-xl border border-l-2 p-3 transition-colors duration-150 ${
                    isDead || hasLeft
                      ? 'border-slate-800 border-l-slate-700 bg-slate-900/20 opacity-55'
                      : isCurrent
                      ? 'border-emerald-400/25 border-l-emerald-300 bg-emerald-300/[0.055]'
                      : isMe
                      ? 'border-amber-400/15 border-l-amber-400 bg-amber-300/[0.035]'
                      : 'border-slate-800/70 border-l-transparent bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {/* Rank Number */}
                      <span className={`text-xs font-mono font-bold w-4 shrink-0 ${
                        idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {idx + 1}.
                      </span>

                      {/* Player Name */}
                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className={`max-w-full truncate text-sm ${
                          isDead || hasLeft 
                            ? 'text-slate-500 line-through' 
                            : isMe 
                            ? 'font-black text-amber-200'
                            : isCurrent
                            ? 'font-bold text-emerald-200'
                            : 'font-semibold text-slate-200'
                        }`}>
                          {player.display_name}
                        </span>
                        {isMe && (
                          <span className="shrink-0 rounded-md border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                            YOU
                          </span>
                        )}
                        {player.is_host && (
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                        )}
                        {isDead && (
                          <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[9px] font-black uppercase tracking-wider shrink-0 shadow-sm">
                            ☠️ DEAD
                          </span>
                        )}
                        {player.has_shield && !isDead && (
                          <span
                            className="flex shrink-0 items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-950/55 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200"
                            title="Shield Active: Blocks 1 incoming attack"
                          >
                            <Shield className="w-3 h-3 text-cyan-300 fill-cyan-400/40 drop-shadow-[0_0_4px_#38bdf8]" />
                            <span className="hidden sm:inline text-[9px] font-extrabold tracking-wider">SHIELD</span>
                          </span>
                        )}
                        {cardUseEffects[player.id] && (
                          <span
                            className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-1.5 py-0.5 text-sm leading-none"
                            title={`${cardUseEffects[player.id]} used`}
                          >
                            {cardIcon(cardUseEffects[player.id], 'h-3.5 w-3.5', <span className="text-xs font-black text-amber-300">×2</span>) ?? '✨'}
                          </span>
                        )}
                        {isCurrent && !isDead && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            TURN
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score & Connection Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      <motion.span
                        key={player.score}
                        initial={false}
                        animate={{ scale: 1, color: isCurrent ? '#34d399' : '#f8fafc' }}
                        transition={{ duration: 0.18 }}
                        className={`inline-block whitespace-nowrap font-mono text-lg font-black tabular-nums ${
                          isCurrent
                            ? 'text-emerald-300'
                            : 'text-white'
                        }`}
                      >
                        {player.score} <span className="font-sans text-[9px] font-bold uppercase text-slate-500">pts</span>
                      </motion.span>
                      {player.connection_status === 'ONLINE' ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400/80" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 text-rose-400/80" />
                      )}
                    </div>
                  </div>

                  {showHealth && (() => {
                    const playerMaxHp = player.max_hp || maxHp;
                    const hasShield = Boolean(player.has_shield && !isDead);
                    return (
                      <div className="relative mt-2.5">
                        <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          <span>Health</span>
                          <span className="font-mono tabular-nums text-slate-300">{Math.max(0, player.hp)} / {playerMaxHp}</span>
                        </div>
                        <div className={`relative h-2 overflow-hidden rounded-full transition-all ${
                          hasShield
                            ? 'bg-slate-950/90 border-2 border-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.9),inset_0_0_10px_rgba(56,189,248,0.5)] ring-1 ring-cyan-200/80'
                            : 'bg-slate-950/80 border border-slate-800/60 shadow-inner'
                        }`}>
                          <div
                            className={`h-full transition-all duration-300 ${
                              player.hp <= 0
                                ? 'bg-slate-700'
                                : hasShield
                                ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400'
                                : player.hp > playerMaxHp / 2
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : 'bg-gradient-to-r from-rose-500 to-amber-500'
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100))}%` }}
                          />
                          {/* HP Dividers every 20% */}
                          {[20, 40, 60, 80].map((percent) => (
                            <div
                              key={percent}
                              className="absolute top-0 bottom-0 w-px bg-slate-950/90 z-10"
                              style={{ left: `${percent}%` }}
                            />
                          ))}
                          {/* Protective Shield Shimmer / Badge */}
                          {hasShield && (
                            <div className="absolute inset-0 z-20 flex items-center px-1.5 pointer-events-none">
                              <div className="flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5 text-white fill-cyan-300 drop-shadow-[0_0_4px_#38bdf8]" />
                                <span className="text-[9px] font-black tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] uppercase">
                                  Shielded
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM SECTION: COLLAPSIBLE MOVE HISTORY & DEFINITION ACCORDION */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-slate-700/50 bg-slate-950/20">
          <button
            onClick={() => setIsHistoryOpen(prev => !prev)}
            className="flex w-full shrink-0 items-center justify-between px-3 py-3 text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/60 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Recent moves</span>
            </div>
            {isHistoryOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {isHistoryOpen && (
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pr-2">
              {moveHistory.length === 0 ? (
                <div className="py-3 text-center text-[11px] text-slate-500 italic">
                  No moves recorded yet
                </div>
              ) : (
                moveHistory.slice(-10).reverse().map((entry) => {
                  const isExpanded = expandedMoveId === entry.id;
                  
                  // Extract words for this move
                  let words = entry.words;
                  if (!words || words.length === 0) {
                    if (entry.type === 'move' && entry.text.includes(':')) {
                      const parts = entry.text.split(':');
                      if (parts[1]) {
                        words = parts[1].split(',').map(w => w.trim().toUpperCase()).filter(w => /^[A-Z]+$/.test(w));
                      }
                    }
                  }
                  const hasWords = Boolean(words && words.length > 0);
                  const activeWord = selectedWordByMove[entry.id] || (words && words[0]) || '';
                  const definition = activeWord ? definitionsCache[activeWord] : null;
                  const isLoading = activeWord ? loadingWords[activeWord] : false;
                  const actorName = entry.display_name || (
                    entry.player_id === myPlayerId
                      ? 'You'
                      : entry.text.includes(':')
                        ? entry.text.split(':')[0]
                        : 'Game'
                  );
                  const moveLabel = hasWords
                    ? words?.join(', ')
                    : entry.text.includes(':')
                      ? entry.text.slice(entry.text.indexOf(':') + 1).trim()
                      : entry.text;

                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className={`overflow-hidden border-b border-slate-800/80 last:border-b-0 ${
                        isExpanded
                          ? 'bg-cyan-950/20'
                          : ''
                      }`}
                    >
                      {/* Move Row Header (Clickable to expand/collapse) */}
                      <button
                        type="button"
                        onClick={() => hasWords && toggleMoveAccordion(entry)}
                        aria-expanded={hasWords ? isExpanded : undefined}
                        disabled={!hasWords}
                        className={`flex w-full items-center justify-between gap-3 px-1.5 py-2.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/60 ${
                          hasWords ? 'cursor-pointer hover:bg-white/[0.025]' : 'cursor-default'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <BookOpen className={`h-4 w-4 shrink-0 ${isExpanded ? 'text-cyan-300' : 'text-slate-500'}`} />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                              {actorName}{entry.turn_number ? ` · Turn ${entry.turn_number}` : ''}
                            </span>
                            <span className="truncate font-semibold tracking-wide text-slate-100">
                              {moveLabel}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {entry.score !== undefined && entry.score > 0 && (
                            <span className="font-mono text-xs font-bold tabular-nums text-emerald-300">
                              +{entry.score}
                            </span>
                          )}
                          {hasWords && (
                            <span className="text-slate-500 transition-colors">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              )}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Accordion Definition Content (Selectable with mouse) */}
                      {isExpanded && hasWords && words && (
                        <div className="space-y-2.5 border-t border-slate-800/70 bg-slate-950/30 p-3 pt-2 select-text cursor-text">
                          {/* Multi-word Tabs (if multiple words formed in 1 turn) */}
                          {words.length > 1 && (
                            <div className="flex flex-wrap gap-1.5 pb-1.5 border-b border-slate-800/80 select-none">
                              {words.map((w) => (
                                <button
                                  key={w}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectWordForMove(entry.id, w);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                                    activeWord === w
                                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-[0_0_10px_rgba(6,182,212,0.35)]'
                                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                                  }`}
                                >
                                  {w}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Definition Details Card */}
                          {isLoading ? (
                            <div className="flex items-center justify-center py-4 text-cyan-400 gap-2.5 select-none">
                              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                              <span className="text-xs text-slate-300 font-medium">Looking up definition...</span>
                            </div>
                          ) : definition && definition.meanings && definition.meanings.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between pb-1 border-b border-slate-800/60 select-none">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-cyan-300 tracking-wider text-sm drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                                    {definition.word}
                                  </span>
                                  {definition.phonetic && (
                                    <span className="text-[11px] text-cyan-400/80 font-mono italic">
                                      {definition.phonetic}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyDefinitionText(definition.word, definition);
                                  }}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-cyan-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer"
                                  title="Copy word and definition"
                                >
                                  {copiedWord === definition.word ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400 font-bold">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="space-y-2">
                                {definition.meanings.map((m, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 shadow-inner space-y-1.5"
                                  >
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-bold text-cyan-300 uppercase tracking-widest select-none">
                                      {m.partOfSpeech}
                                    </span>
                                    <ul className="space-y-1.5 text-xs text-slate-200 leading-relaxed pl-1">
                                      {m.definitions.map((def, dIdx) => (
                                        <li key={dIdx} className="flex items-start gap-1.5">
                                          <span className="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                                          <span>{def}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="py-3 text-center text-xs text-slate-400 italic">
                              No definition found for {activeWord}.
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>

      {isTileBagOpen && (
        <TileBagDialog tileBagCount={tileBagCount} tileBagCounts={tileBagCounts} onClose={closeTileBag} />
      )}
    </aside>
  );
});


