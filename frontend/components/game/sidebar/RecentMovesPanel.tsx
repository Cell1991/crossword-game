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
              .map(w => w.trim().toUpperCase())
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
    <section aria-label="Recent moves history" className="flex-1 min-h-0 flex flex-col pt-1 select-none">
      {/* Celestial Header Trigger */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between px-1.5 py-1.5 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded-xl group select-none hover:bg-white/[0.04]"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-amber-300 uppercase transition-colors drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          <span>MATCH LOG</span>
        </div>
        <div className="text-slate-400 group-hover:text-amber-200 transition-colors">
          {isOpen ? <ChevronDown className="w-4 h-4 text-amber-400" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </button>

      {/* Content Container */}
      {isOpen && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-1 space-y-2 scrollbar-thin">
          {moveHistory.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 italic">
              Star chronicles will appear here...
            </div>
          ) : (
            moveHistory
              .slice(-15)
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
                        .map(w => w.trim().toUpperCase())
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

                const wordLabel = hasWords
                  ? words?.join(', ')
                  : entry.text.includes(':')
                  ? entry.text.slice(entry.text.indexOf(':') + 1).trim()
                  : entry.text;

                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'bg-gradient-to-br from-[#201d52]/95 via-[#141238]/98 to-[#0c0a24]/95 border-amber-400/55 shadow-[0_6px_22px_rgba(0,0,0,0.7),0_0_16px_rgba(245,158,11,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)]'
                        : 'bg-gradient-to-br from-[#16173a]/85 via-[#0f112b]/90 to-[#08091a]/95 hover:from-[#202252]/90 hover:to-[#121438] border-white/12 hover:border-amber-400/40 shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]'
                    }`}
                  >
                    {/* Row Summary */}
                    <button
                      type="button"
                      onClick={() => hasWords && toggleMoveAccordion(entry)}
                      disabled={!hasWords}
                      className={`relative flex w-full items-center justify-between gap-2 p-3 text-left text-xs transition-colors overflow-hidden ${
                        hasWords ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                      }`}
                    >
                      {/* Specular shimmer */}
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                      {/* Left: Identity + Word */}
                      <div className="flex flex-col min-w-0 flex-1 relative z-10">
                        <span
                          className={`text-xs font-bold truncate ${
                            isMe ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)] font-black' : 'text-slate-300'
                          }`}
                        >
                          {actorName}
                        </span>
                        <span className="text-sm sm:text-[15px] font-black font-maple bg-gradient-to-r from-white via-amber-100 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(251,191,36,0.6)] tracking-wide truncate mt-0.5">
                          {wordLabel}
                        </span>
                      </div>

                      {/* Right: Score + Turn indicator */}
                      <div className="flex items-center gap-2 shrink-0 relative z-10">
                        <div className="flex flex-col items-end gap-0.5">
                          {entry.score !== undefined && entry.score > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-r from-emerald-500/25 to-teal-500/20 border border-emerald-400/60 text-xs font-black text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                              +{entry.score}{' '}
                              <span className="text-[9.5px] text-emerald-300/90 font-bold">PTS</span>
                            </span>
                          ) : null}
                          {entry.turn_number ? (
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              T{String(entry.turn_number).padStart(2, '0')}
                            </span>
                          ) : null}
                        </div>

                        {hasWords && (
                          <div className="text-slate-400 group-hover:text-amber-300">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Accordion Word Definition (Vibrant Celestial Lexicon Pod) */}
                    {isExpanded && hasWords && words && (
                      <div className="p-3.5 border-t border-indigo-400/25 bg-gradient-to-b from-[#0e102c]/95 to-[#07081a]/98 space-y-2.5 select-text cursor-text">
                        {/* Multi-word Tabs (Only if move formed > 1 word) */}
                        {words.length > 1 ? (
                          <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-white/[0.08] select-none">
                            <span className="text-[10px] font-bold text-slate-300 uppercase mr-1">Words:</span>
                            {words.map(w => (
                              <button
                                key={w}
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  selectWordForMove(entry.id, w);
                                }}
                                className={`px-2.5 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                  activeWord === w
                                    ? 'bg-gradient-to-r from-amber-400/30 to-yellow-400/20 text-amber-200 border border-amber-400/70 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                                    : 'bg-white/5 text-slate-300 hover:text-white border border-white/10'
                                }`}
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {/* Lexicon Header & Copy Tool */}
                        <div className="flex items-center justify-between gap-2 pb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <BookOpen className="w-4 h-4 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] shrink-0" />
                            <span className="font-black text-[11px] tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-indigo-200 to-amber-200 uppercase drop-shadow-sm">
                              CELESTIAL DICTIONARY
                            </span>
                            {definition?.phonetic && (
                              <span className="px-1.5 py-0.2 rounded border border-indigo-400/30 bg-indigo-950/70 text-[11px] font-mono text-indigo-200 italic shadow-sm">
                                {definition.phonetic}
                              </span>
                            )}
                          </div>

                          {definition && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                copyDefinitionText(activeWord, definition);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-200 hover:text-white border border-indigo-400/35 hover:border-amber-400/60 transition-all cursor-pointer text-[10.5px] font-bold shadow-sm"
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
                                  <Copy className="w-3.5 h-3.5 text-indigo-300" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Definition content */}
                        {isLoading ? (
                          <div className="flex items-center gap-2 py-3 text-xs text-indigo-300 select-none">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span>Looking up star archives...</span>
                          </div>
                        ) : definition && definition.meanings && definition.meanings.length > 0 ? (
                          <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                            {definition.meanings.map((m, mIdx) => (
                              <div
                                key={mIdx}
                                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/15 transition-all flex items-start gap-2.5 shadow-sm"
                              >
                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border shrink-0 mt-0.5 ${getPosBadgeClass(m.partOfSpeech)}`}>
                                  {m.partOfSpeech}
                                </span>
                                <span className="text-xs sm:text-[12.5px] font-medium leading-relaxed text-slate-100 flex-1">
                                  {m.definitions[0]}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-1.5">
                            No dictionary definition found for &ldquo;{activeWord}&rdquo;.
                          </p>
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

