'use client';

import React, { useCallback, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Loader2, Copy, Check, BookOpen } from 'lucide-react';
import { MoveHistoryEntry, WordDefinition } from '@/lib/types';
import { getWordDefinition } from '@/lib/api';

interface RecentMovesPanelProps {
  moveHistory?: MoveHistoryEntry[];
  myPlayerId: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  hideHeaderTrigger?: boolean;
  maxItems?: number;
}

const getPosBadgeClass = (pos: string) => {
  const p = pos.toLowerCase();
  if (p.includes('noun')) {
    return 'bg-gradient-to-r from-sky-500/35 via-cyan-500/25 to-sky-500/35 border-sky-300/80 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]';
  }
  if (p.includes('verb')) {
    return 'bg-gradient-to-r from-emerald-500/35 via-teal-500/25 to-emerald-500/35 border-emerald-300/80 text-emerald-200 shadow-[0_0_10px_rgba(52,211,153,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]';
  }
  if (p.includes('adj')) {
    return 'bg-gradient-to-r from-purple-500/35 via-fuchsia-500/25 to-purple-500/35 border-purple-300/80 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]';
  }
  if (p.includes('adv')) {
    return 'bg-gradient-to-r from-amber-500/35 via-orange-500/25 to-amber-500/35 border-amber-300/80 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]';
  }
  return 'bg-indigo-900/40 border-indigo-400/50 text-indigo-200 shadow-sm';
};

export const RecentMovesPanel: React.FC<RecentMovesPanelProps> = ({
  moveHistory = [],
  myPlayerId,
  isOpen,
  onToggleOpen,
  hideHeaderTrigger = false,
  maxItems = 25,
}) => {
  const [expandedMoveId, setExpandedMoveId] = useState<string | null>(null);
  const [definitionsCache, setDefinitionsCache] = useState<Record<string, WordDefinition | null>>({});
  const [loadingWords, setLoadingWords] = useState<Record<string, boolean>>({});
  const [selectedWordByMove, setSelectedWordByMove] = useState<Record<string, string>>({});
  const [copiedWord, setCopiedWord] = useState<string | null>(null);

  const fetchDefinition = useCallback(
    async (word: string) => {
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
    },
    [definitionsCache, loadingWords]
  );

  const toggleMoveAccordion = useCallback(
    (entry: MoveHistoryEntry) => {
      if (expandedMoveId === entry.id) {
        setExpandedMoveId(null);
        return;
      }

      setExpandedMoveId(entry.id);

      // Extract words
      let words = entry.words;
      if (!words || words.length === 0) {
        if (entry.type === 'move' && entry.text.includes(':')) {
          const parts = entry.text.split(':');
          if (parts[1]) {
            words = parts[1]
              .split(',')
              .map(w => w.trim().replace(/\s*\(🎴.*\)$/, '').toUpperCase())
              .filter(w => /^[A-Z]+$/.test(w));
          }
        }
      }

      if (words && words.length > 0) {
        const initialWord = selectedWordByMove[entry.id] || words[0];
        setSelectedWordByMove(prev => ({ ...prev, [entry.id]: initialWord }));
        fetchDefinition(initialWord);
      }
    },
    [expandedMoveId, selectedWordByMove, fetchDefinition]
  );

  const selectWordForMove = useCallback(
    (moveId: string, word: string) => {
      setSelectedWordByMove(prev => ({ ...prev, [moveId]: word }));
      fetchDefinition(word);
    },
    [fetchDefinition]
  );

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
    <section aria-label="Recent moves history" className="w-full flex flex-col pt-0.5 select-none">
      {/* Celestial Header Trigger (if not embedded in dedicated modal) */}
      {!hideHeaderTrigger && (
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex w-full items-center justify-between px-2 py-2 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded-xl group select-none hover:bg-white/[0.04]"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-amber-300 uppercase transition-colors drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            <span>MATCH LOG</span>
            {moveHistory.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-400/20 border border-amber-400/40 text-[9.5px] font-mono font-bold text-amber-200">
                {moveHistory.length}
              </span>
            )}
          </div>
          <div className="text-slate-400 group-hover:text-amber-200 transition-colors">
            {isOpen ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>
      )}

      {/* Content Container */}
      {isOpen && (
        <div className="w-full space-y-2 mt-1">
          {moveHistory.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic flex flex-col items-center gap-2">
              <BookOpen className="w-6 h-6 text-slate-600 animate-pulse" />
              <span>No words played yet. Star chronicles will appear here.</span>
            </div>
          ) : (
            moveHistory
              .slice(-maxItems)
              .reverse()
              .map(entry => {
                const isExpanded = expandedMoveId === entry.id;

                // Parse words formed
                let words = entry.words;
                if (!words || words.length === 0) {
                  if (entry.type === 'move' && entry.text.includes(':')) {
                    const parts = entry.text.split(':');
                    if (parts[1]) {
                      words = parts[1]
                        .split(',')
                        .map(w => w.trim().replace(/\s*\(🎴.*\)$/, '').toUpperCase())
                        .filter(w => /^[A-Z]+$/.test(w));
                    }
                  }
                }
                const hasWords = Boolean(words && words.length > 0);
                const activeWord = selectedWordByMove[entry.id] || (words && words[0]) || '';
                const definition = activeWord ? definitionsCache[activeWord] : null;
                const isLoading = activeWord ? loadingWords[activeWord] : false;

                const isMe = entry.player_id === myPlayerId;
                const actorName =
                  entry.display_name ||
                  (isMe ? 'You' : entry.text.includes(':') ? entry.text.split(':')[0] : 'Player');

                let wordLabel = entry.text;
                if (entry.type === 'card') {
                  const regex = new RegExp(`^(${actorName}|You|Player)\\s+`, 'i');
                  const stripped = entry.text.replace(regex, '').trim();
                  wordLabel = stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : entry.text;
                } else if (hasWords && words && words.length > 0) {
                  const cardTagMatch = entry.text.match(/(🎴.+)$/);
                  const cardTag = cardTagMatch ? ` (${cardTagMatch[1]})` : '';
                  wordLabel = `${words.join(', ')}${cardTag}`;
                } else if (entry.type === 'exchange' || entry.text.toLowerCase().includes('swap')) {
                  const cardTagMatch = entry.text.match(/(🎴.+)$/);
                  const cardTag = cardTagMatch ? ` (${cardTagMatch[1]})` : '';
                  wordLabel = `Swapped tiles${cardTag}`;
                } else if (entry.type === 'pass' || entry.text.toLowerCase().includes('pass')) {
                  const cardTagMatch = entry.text.match(/(🎴.+)$/);
                  const cardTag = cardTagMatch ? ` (${cardTagMatch[1]})` : '';
                  wordLabel = `Passed turn${cardTag}`;
                } else if (entry.text.includes(':')) {
                  wordLabel = entry.text.slice(entry.text.indexOf(':') + 1).trim();
                } else {
                  const regex = new RegExp(`^(${actorName}|You|Player)\\s+`, 'i');
                  const stripped = entry.text.replace(regex, '').trim();
                  wordLabel = stripped ? stripped.charAt(0).toUpperCase() + stripped.slice(1) : entry.text;
                }

                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'bg-gradient-to-br from-[#1e1748]/95 via-[#131030]/98 to-[#09071c]/95 border-amber-400/50 shadow-[0_4px_16px_rgba(0,0,0,0.7),0_0_12px_rgba(245,158,11,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)]'
                        : 'bg-gradient-to-br from-[#131430]/90 via-[#0d0e24]/90 to-[#070817]/95 hover:from-[#1b1c40]/95 hover:to-[#0f102c] border-white/10 hover:border-amber-400/40 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]'
                    }`}
                  >
                    {/* Row Summary Trigger Button (Strictly valid HTML: no nested buttons inside this button) */}
                    <button
                      type="button"
                      onClick={() => hasWords && toggleMoveAccordion(entry)}
                      disabled={!hasWords}
                      className={`relative flex w-full items-center justify-between gap-2.5 p-2.5 sm:p-3 text-left text-xs transition-colors overflow-hidden ${
                        hasWords ? 'cursor-pointer hover:bg-white/[0.05] active:bg-white/[0.08]' : 'cursor-default'
                      }`}
                      aria-expanded={isExpanded}
                    >
                      {/* Specular shimmer */}
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                      {/* Left: Identity + Word */}
                      <div className="flex flex-col min-w-0 flex-1 relative z-10">
                        <span
                          className={`text-[11px] font-bold truncate ${
                            isMe ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)] font-black' : 'text-slate-300'
                          }`}
                        >
                          {actorName}
                        </span>
                        <span className="text-xs sm:text-sm font-black font-maple bg-gradient-to-r from-white via-amber-100 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] tracking-wide truncate mt-0.5">
                          {wordLabel}
                        </span>
                      </div>

                      {/* Right: Score + Turn indicator */}
                      <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                        <div className="flex flex-col items-end gap-1">
                          {entry.score !== undefined && entry.score > 0 ? (
                            <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-950/90 via-violet-950/80 to-purple-950/90 border border-purple-400/50 text-[11px] font-black text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.3),inset_0_1px_1px_rgba(255,255,255,0.15)] min-w-[32px]">
                              <span className="tracking-tight drop-shadow-[0_0_4px_rgba(192,132,252,0.4)]">+{entry.score}</span>
                            </div>
                          ) : null}
                          {entry.turn_number ? (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[9px] font-mono font-bold text-slate-300 shadow-sm">
                              <span className="text-[8px] font-sans text-slate-400 font-extrabold tracking-wider">TURN</span>
                              <span className="text-purple-200/90 font-mono font-black">{entry.turn_number}</span>
                            </div>
                          ) : null}
                        </div>

                        {hasWords && (
                          <div className="p-1.5 rounded-lg bg-white/[0.06] border border-white/10 group-hover:border-amber-400/40 text-slate-300 transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Accordion Word Definition: Rendered as Sibling Container (outside the button to support nested interactive controls) */}
                    {isExpanded && hasWords && words && (
                      <div className="p-3 border-t border-white/10 bg-gradient-to-b from-[#0e1028]/98 to-[#060714]/98 space-y-2.5 select-text">
                        {/* Multi-word Tabs (Only if move formed > 1 word) */}
                        {words.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-white/[0.08] select-none">
                            <span className="text-[9.5px] font-bold text-slate-400 uppercase mr-1">Words:</span>
                            {words.map(w => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => selectWordForMove(entry.id, w)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer active:scale-95 touch-manipulation min-h-[30px] ${
                                  activeWord === w
                                    ? 'bg-gradient-to-r from-amber-400/35 to-yellow-400/25 text-amber-200 border border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                                    : 'bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:border-white/20'
                                }`}
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Top Bar with phonetic & Copy Tool */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black font-maple tracking-wide text-amber-300">
                              {activeWord}
                            </span>
                            {definition?.phonetic && (
                              <span className="px-1.5 py-0.5 rounded border border-indigo-400/30 bg-indigo-950/70 text-[10px] font-mono text-indigo-200 italic shadow-sm">
                                {definition.phonetic}
                              </span>
                            )}
                          </div>

                          {definition && (
                            <button
                              type="button"
                              onClick={() => copyDefinitionText(activeWord, definition)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-indigo-950 text-slate-300 hover:text-white border border-white/10 hover:border-amber-400/50 transition-all cursor-pointer text-[10.5px] font-bold shadow-sm active:scale-95 touch-manipulation min-h-[28px]"
                              title="Copy definition"
                              aria-label={`Copy definition for ${activeWord}`}
                            >
                              {copiedWord === activeWord ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                                  <span className="text-emerald-300 font-bold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Definition content */}
                        {isLoading ? (
                          <div className="flex items-center gap-2.5 py-3 text-xs text-indigo-200 select-none">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span className="text-xs font-semibold">Looking up definition for {activeWord}...</span>
                          </div>
                        ) : definition && definition.meanings && definition.meanings.length > 0 ? (
                          <div className="space-y-2">
                            {definition.meanings.map((m, mIdx) => (
                              <div
                                key={mIdx}
                                className="p-2.5 rounded-xl bg-gradient-to-b from-[#141638]/90 to-[#0a0c24]/90 border border-white/10 hover:border-amber-400/30 transition-all flex flex-col gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shadow-sm ${getPosBadgeClass(m.partOfSpeech)}`}>
                                    {m.partOfSpeech}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {m.definitions.slice(0, 3).map((defText, dIdx) => (
                                    <p key={dIdx} className="text-xs leading-relaxed text-slate-200 font-medium tracking-wide">
                                      {m.definitions.length > 1 ? <span className="text-amber-400/80 font-mono mr-1.5 font-bold">{dIdx + 1}.</span> : null}
                                      {defText}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-400">
                            No English dictionary definition found for <strong className="text-amber-300">&ldquo;{activeWord}&rdquo;</strong>.
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
    </section>
  );
};
