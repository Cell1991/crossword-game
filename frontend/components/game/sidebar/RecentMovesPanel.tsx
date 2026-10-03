'use client';

import React, { useCallback, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Loader2, Copy, Check } from 'lucide-react';
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
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-1 space-y-1.5 scrollbar-thin">
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
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'bg-gradient-to-br from-[#1d1744]/95 via-[#120f2e]/98 to-[#09071c]/95 border-purple-400/50 shadow-[0_4px_16px_rgba(0,0,0,0.7),0_0_12px_rgba(168,85,247,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)]'
                        : 'bg-gradient-to-br from-[#131430]/85 via-[#0d0e24]/90 to-[#070817]/95 hover:from-[#1b1c40]/90 hover:to-[#0f102c] border-white/10 hover:border-purple-400/40 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]'
                    }`}
                  >
                    {/* Row Summary */}
                    <button
                      type="button"
                      onClick={() => hasWords && toggleMoveAccordion(entry)}
                      disabled={!hasWords}
                      className={`relative flex w-full items-center justify-between gap-2 p-2 sm:p-2.5 text-left text-xs transition-colors overflow-hidden ${
                        hasWords ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                      }`}
                    >
                      {/* Specular shimmer */}
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                      {/* Left: Identity + Word */}
                      <div className="flex flex-col min-w-0 flex-1 relative z-10">
                        <span
                          className={`text-[10.5px] font-bold truncate ${
                            isMe ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)] font-black' : 'text-slate-300'
                          }`}
                        >
                          {actorName}
                        </span>
                        <span className="text-xs sm:text-[13px] font-black font-maple bg-gradient-to-r from-white via-amber-100 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] tracking-wide truncate mt-0.5">
                          {wordLabel}
                        </span>
                      </div>

                      {/* Right: Score + Turn indicator */}
                      <div className="flex items-center gap-1.5 shrink-0 relative z-10">
                        <div className="flex flex-col items-end gap-1">
                          {entry.score !== undefined && entry.score > 0 ? (
                            <div className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-950/90 via-violet-950/80 to-purple-950/90 border border-purple-400/50 text-[11px] font-black text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.3),inset_0_1px_1px_rgba(255,255,255,0.15)] min-w-[30px]">
                              <span className="tracking-tight drop-shadow-[0_0_4px_rgba(192,132,252,0.4)]">+{entry.score}</span>
                            </div>
                          ) : null}
                          {entry.turn_number ? (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-white/[0.04] border border-white/10 text-[8.5px] font-mono font-bold text-slate-300 shadow-sm">
                              <span className="text-[7.5px] font-sans text-slate-400 font-extrabold tracking-wider">TURN</span>
                              <span className="text-purple-200/90 font-mono font-black">{entry.turn_number}</span>
                            </div>
                          ) : null}
                        </div>

                        {hasWords && (
                          <div className="p-1 rounded-md bg-white/[0.04] border border-white/10 group-hover:border-purple-400/40 text-slate-400 group-hover:text-purple-300 transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-purple-300 drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Accordion Word Definition (Vibrant Celestial Lexicon Pod) */}
                    {isExpanded && hasWords && words && (
                      <div className="p-2.5 border-t border-white/10 bg-gradient-to-b from-[#0c0e24]/95 to-[#060714]/98 space-y-2 select-text cursor-text">
                        {/* Multi-word Tabs (Only if move formed > 1 word) */}
                        {words.length > 1 ? (
                          <div className="flex flex-wrap items-center gap-1 pb-1 border-b border-white/[0.08] select-none">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Words:</span>
                            {words.map(w => (
                              <button
                                key={w}
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  selectWordForMove(entry.id, w);
                                }}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-black transition-all cursor-pointer ${
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

                        {/* Top Bar with phonetic & Copy Tool */}
                        <div className="flex items-center justify-between gap-2">
                          {definition?.phonetic ? (
                            <span className="px-1.5 py-0.5 rounded border border-indigo-400/30 bg-indigo-950/70 text-[10px] font-mono text-indigo-200 italic shadow-sm">
                              {definition.phonetic}
                            </span>
                          ) : (
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
                              DEFINITION
                            </span>
                          )}

                          {definition && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                copyDefinitionText(activeWord, definition);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/90 hover:bg-indigo-950 text-slate-300 hover:text-white border border-white/10 hover:border-amber-400/50 transition-all cursor-pointer text-[10px] font-bold shadow-sm active:scale-95"
                              title="Copy definition"
                              aria-label={`Copy definition for ${activeWord}`}
                            >
                              {copiedWord === activeWord ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                                  <span className="text-emerald-300 font-bold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Definition content */}
                        {isLoading ? (
                          <div className="flex items-center gap-2 py-2 text-xs text-indigo-300 select-none">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            <span className="text-[11px]">Looking up archives...</span>
                          </div>
                        ) : definition && definition.meanings && definition.meanings.length > 0 ? (
                          <div className="space-y-1.5">
                            {definition.meanings.map((m, mIdx) => (
                              <div
                                key={mIdx}
                                className="p-2 rounded-xl bg-gradient-to-b from-[#121430]/90 to-[#0a0c20]/90 border border-white/10 hover:border-amber-400/30 transition-all flex flex-col gap-1 shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase tracking-wider border shadow-sm ${getPosBadgeClass(m.partOfSpeech)}`}>
                                    {m.partOfSpeech}
                                  </span>
                                </div>
                                <p className="text-[11px] sm:text-[11.5px] leading-relaxed text-slate-200 font-medium tracking-wide">
                                  {m.definitions[0]}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic py-1">
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

