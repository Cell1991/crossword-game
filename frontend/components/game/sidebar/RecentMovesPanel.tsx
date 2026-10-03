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
    <section aria-label="Recent moves history" className="flex-1 min-h-0 flex flex-col pt-1">
      {/* Celestial Header Trigger */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between px-1.5 py-1.5 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 rounded-xl group select-none hover:bg-white/[0.04]"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-300 group-hover:text-amber-300 uppercase transition-colors">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-300 transition-colors drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
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
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? 'bg-[#141533]/95 border-amber-400/60 shadow-[0_0_18px_rgba(251,191,36,0.25)]'
                        : 'bg-gradient-to-br from-[#16173a]/75 via-[#0f112b]/80 to-[#08091a]/85 hover:from-[#1d1f48]/90 hover:to-[#111333] border-white/10 hover:border-amber-400/30 shadow-sm'
                    }`}
                  >
                    {/* Row Summary */}
                    <button
                      type="button"
                      onClick={() => hasWords && toggleMoveAccordion(entry)}
                      disabled={!hasWords}
                      className={`flex w-full items-center justify-between gap-2 p-2.5 text-left text-xs transition-colors ${
                        hasWords ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                      }`}
                    >
                      {/* Left: Identity + Word */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span
                          className={`text-xs font-bold truncate ${
                            isMe ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]' : 'text-slate-200'
                          }`}
                        >
                          {actorName}
                        </span>
                        <span className="text-xs font-black text-amber-200 tracking-wide truncate">
                          {wordLabel}
                        </span>
                      </div>

                      {/* Right: Score + Turn indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-0.5">
                          {entry.score !== undefined && entry.score > 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-500/15 border border-emerald-400/40 text-[11px] font-black text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]">
                              +{entry.score}{' '}
                              <span className="text-[9px] text-emerald-400/80 font-bold">PTS</span>
                            </span>
                          ) : null}
                          {entry.turn_number ? (
                            <span className="text-[9.5px] font-bold text-slate-400">
                              T{String(entry.turn_number).padStart(2, '0')}
                            </span>
                          ) : null}
                        </div>

                        {hasWords && (
                          <div className="text-slate-400 group-hover:text-amber-300">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Accordion Word Definition */}
                    {isExpanded && hasWords && words && (
                      <div className="p-3 border-t border-amber-400/20 bg-[#0a0a1c]/95 space-y-2.5 select-text cursor-text">
                        {/* Multi-word Tabs */}
                        {words.length > 1 && (
                          <div className="flex flex-wrap gap-1.5 pb-1 border-b border-white/10 select-none">
                            {words.map(w => (
                              <button
                                key={w}
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  selectWordForMove(entry.id, w);
                                }}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                                  activeWord === w
                                    ? 'bg-amber-400/25 text-amber-200 border border-amber-400/60 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                                    : 'bg-slate-800 text-slate-400 hover:text-white border border-white/10'
                                }`}
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Header Word & Action */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="font-black text-sm text-amber-300 tracking-wider">
                              {activeWord}
                            </span>
                            {definition?.phonetic && (
                              <span className="text-xs text-slate-400">
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
                              className="p-1 rounded-md text-slate-400 hover:text-amber-300 hover:bg-white/10 transition-colors cursor-pointer"
                              title="Copy definition"
                              aria-label={`Copy definition for ${activeWord}`}
                            >
                              {copiedWord === activeWord ? (
                                <Check className="w-3.5 h-3.5 text-amber-400 stroke-[3]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Definition content */}
                        {isLoading ? (
                          <div className="flex items-center gap-2 py-2 text-xs text-slate-400 select-none">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            <span>Looking up celestial dictionary...</span>
                          </div>
                        ) : definition && definition.meanings && definition.meanings.length > 0 ? (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                            {definition.meanings.map((m, mIdx) => (
                              <div key={mIdx} className="text-xs leading-relaxed">
                                <span className="font-black text-[10px] text-amber-400 uppercase mr-1.5">
                                  [{m.partOfSpeech}]
                                </span>
                                <span className="text-slate-200">{m.definitions[0]}</span>
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
