'use client';

import React, { memo, useCallback, useRef, useState } from 'react';
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
    <aside className={`flex h-full shrink-0 flex-col select-none ${mobile ? 'w-full p-0 bg-transparent' : 'w-72 p-3'}`}>
      {/* Sleek Vertical Glassmorphism Panel */}
      <div className={`flex flex-col h-full ${mobile ? 'bg-transparent border-0 rounded-none shadow-none ring-0' : 'bg-slate-950/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.12),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-cyan-500/20'} overflow-hidden`}>
        {/* TOP SECTION: COMPACT TILES STATUS CARD */}
        <div className="p-3 border-b border-slate-800/80 bg-gradient-to-r from-amber-950/30 via-slate-900/30 to-slate-950/30">
          <button
            ref={tileBagButtonRef}
            type="button"
            onClick={() => setIsTileBagOpen(true)}
            className="group w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-amber-500/30 hover:border-amber-400/70 hover:bg-slate-800/80 active:scale-[0.99] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_0_16px_rgba(251,191,36,0.25)] transition-all cursor-pointer text-left"
            aria-label={`Show remaining letters, ${tileBagCount} tiles remaining`}
          >
            <div className="flex items-center gap-2.5">
              {/* Golden Tile Stack Icon */}
              <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500/30 via-yellow-600/40 to-slate-900 border border-amber-400/60 shadow-[0_0_10px_rgba(251,191,36,0.45)] flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
                </div>
              </div>
              <span className="text-xs font-bold text-amber-200/90 group-hover:text-amber-100 transition-colors">Tiles Remaining</span>
            </div>
            <span className="text-sm font-black font-mono text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
              {tileBagCount}
            </span>
          </button>
        </div>

        {/* MAIN SECTION: SCOREBOARD */}
        <div className="flex-1 flex flex-col min-h-0 p-3 overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <span className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                Scoreboard
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {players.length} {players.length === 1 ? 'Player' : 'Players'}
            </span>
          </div>

          {/* Players List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {sortedPlayers.map((player, idx) => {
              const isCurrent = player.id === currentPlayerId;
              const isMe = player.id === myPlayerId;
              const isDead = player.hp <= 0;
              const hasLeft = player.connection_status === 'OFFLINE';

              return (
                <div
                  key={player.id}
                  className={`relative flex flex-col p-2.5 rounded-xl transition-all ${
                    isDead || hasLeft
                      ? 'bg-slate-950/60 border border-slate-800/50 opacity-50'
                      : isMe
                      ? 'bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-slate-900/60 border border-pink-500/50 shadow-[0_0_14px_rgba(236,72,153,0.25)] ring-1 ring-pink-500/30'
                      : isCurrent
                      ? 'bg-blue-950/40 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'bg-slate-900/50 border border-slate-800/70 hover:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Rank Number */}
                      <span className={`text-xs font-mono font-bold w-4 shrink-0 ${
                        idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        {idx + 1}.
                      </span>

                      {/* Player Name */}
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`text-xs truncate ${
                          isDead || hasLeft 
                            ? 'text-slate-500 line-through' 
                            : isMe 
                            ? 'font-bold text-pink-200' 
                            : 'font-medium text-slate-200'
                        }`}>
                          {player.display_name} {isMe && '(You)'}
                        </span>
                        {player.is_host && (
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                        )}
                        {cardUseEffects[player.id] && (
                          <span
                            className="animate-pulse rounded-full border border-cyan-300/80 bg-cyan-400/20 px-1.5 py-0.5 text-sm leading-none shadow-[0_0_14px_rgba(34,211,238,0.85)]"
                            title={`${cardUseEffects[player.id]} used`}
                          >
                            {cardIcon(cardUseEffects[player.id], 'h-3.5 w-3.5', <span className="text-xs font-black text-amber-300">×2</span>) ?? '✨'}
                          </span>
                        )}
                        {isCurrent && !isDead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8] animate-pulse" />
                        )}
                      </div>
                    </div>

                    {/* Score & Connection Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold font-mono text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">
                        {player.score}
                      </span>
                      {player.connection_status === 'ONLINE' ? (
                        <Wifi className="w-3.5 h-3.5 text-emerald-400/80" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5 text-rose-400/80" />
                      )}
                    </div>
                  </div>

                  {showHealth && (
                    <div className="mt-2 h-3 rounded-sm bg-slate-950/80 relative overflow-hidden border border-slate-800/60 shadow-inner">
                      <div
                        className={`h-full transition-all duration-300 ${
                          player.hp <= 0
                            ? 'bg-slate-700'
                            : player.hp > maxHp / 2
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-rose-500 to-amber-500'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, (player.hp / maxHp) * 100))}%` }}
                      />
                      {/* HP Dividers every 20% */}
                      {[20, 40, 60, 80].map((percent) => (
                        <div
                          key={percent}
                          className="absolute top-0 bottom-0 w-px bg-slate-950/90 z-10"
                          style={{ left: `${percent}%` }}
                        />
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM SECTION: COLLAPSIBLE MOVE HISTORY & DEFINITION ACCORDION */}
        <div className="border-t border-slate-800/80 bg-slate-900/40">
          <button
            onClick={() => setIsHistoryOpen(prev => !prev)}
            className="w-full flex items-center justify-between p-2.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Move History</span>
            </div>
            {isHistoryOpen ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {isHistoryOpen && (
            <div className="p-2.5 pt-0 max-h-64 overflow-y-auto pr-1 space-y-2">
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

                  return (
                    <div
                      key={entry.id}
                      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                        isExpanded
                          ? 'bg-slate-900/90 border-cyan-500/50 shadow-[0_0_16px_rgba(6,182,212,0.18)] ring-1 ring-cyan-500/20'
                          : 'bg-slate-900/60 border-slate-800/70 hover:border-slate-700/90 hover:bg-slate-900/80'
                      }`}
                    >
                      {/* Move Row Header (Clickable to expand/collapse) */}
                      <div
                        onClick={() => hasWords && toggleMoveAccordion(entry)}
                        className={`flex items-center justify-between p-2.5 text-xs transition-colors ${
                          hasWords ? 'cursor-pointer hover:bg-slate-800/40 select-none' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          {hasWords && (
                            <div className={`p-1 rounded-md transition-colors ${
                              isExpanded ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                            }`}>
                              <BookOpen className="w-3.5 h-3.5 shrink-0" />
                            </div>
                          )}
                          <span className="text-slate-200 truncate font-semibold tracking-wide">
                            {entry.text}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {entry.score !== undefined && entry.score > 0 && (
                            <span className="font-mono font-bold text-emerald-400 text-xs drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]">
                              +{entry.score}
                            </span>
                          )}
                          {hasWords && (
                            <div className="text-slate-400 hover:text-white transition-colors">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Accordion Definition Content (Selectable with mouse) */}
                      {isExpanded && hasWords && words && (
                        <div className="p-3 pt-2 border-t border-slate-800/90 bg-gradient-to-b from-slate-950/90 to-slate-900/90 space-y-2.5 select-text cursor-text animate-in fade-in slide-in-from-top-1 duration-200">
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
                    </div>
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


