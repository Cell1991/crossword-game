'use client';

import React, { useCallback, useState } from 'react';
import { History, ChevronDown, ChevronUp, Loader2, Copy, Check, BookOpen } from 'lucide-react';
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

    // Extract words
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
    <section
      aria-label="Recent moves history"
      className="flex-1 min-h-0 flex flex-col pt-1"
    >
      {/* Header Trigger */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="flex w-full items-center justify-between px-1 py-1.5 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5]/60 rounded-lg group select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-[#91A0B5] group-hover:text-[#F2F6FC] uppercase transition-colors">
          <History className="w-3 h-3 text-[#91A0B5] group-hover:text-[#22D3C5] transition-colors" />
          <span>RECENT MOVES</span>
        </div>
        <div className="text-[#66758A] group-hover:text-[#F2F6FC] transition-colors">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Content Container */}
      {isOpen && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1 scrollbar-thin">
          {moveHistory.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-[#66758A] italic">
              Moves will appear here
            </div>
          ) : (
            moveHistory.slice(-15).reverse().map((entry) => {
              const isExpanded = expandedMoveId === entry.id;

              // Parse words formed
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
                    : 'Player'
              );
              const actorInitial = actorName.charAt(0).toUpperCase();

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
                      ? 'bg-slate-900/80 border-cyan-400/50 shadow-[0_0_16px_rgba(34,211,197,0.12)]'
                      : 'bg-slate-900/40 hover:bg-slate-800/50 border-white/[0.06] hover:border-white/[0.12] shadow-sm'
                  }`}
                >
                  {/* Row Summary */}
                  <button
                    type="button"
                    onClick={() => hasWords && toggleMoveAccordion(entry)}
                    disabled={!hasWords}
                    className={`flex w-full items-center justify-between gap-2 p-2 text-left text-[11px] transition-colors ${
                      hasWords ? 'cursor-pointer hover:bg-white/[0.02]' : 'cursor-default'
                    }`}
                  >
                    {/* Left: Crest + Identity */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-5 h-5 rounded-full bg-[#18263a] border border-[#273a52] text-[9px] font-bold text-[#91A0B5] flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        {actorInitial}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-[#F2F6FC] truncate">
                          {actorName}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-[#22D3C5] tracking-wide truncate">
                          {wordLabel}
                        </span>
                      </div>
                    </div>

                    {/* Right: Score + Turn indicator */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex flex-col items-end">
                        {entry.score !== undefined && entry.score > 0 ? (
                          <span className="font-mono font-bold text-[11px] text-[#F2F6FC]">
                            +{entry.score} <span className="text-[9px] text-[#91A0B5]">PTS</span>
                          </span>
                        ) : null}
                        {entry.turn_number ? (
                          <span className="font-mono text-[9px] text-[#66758A]">
                            T{String(entry.turn_number).padStart(2, '0')}
                          </span>
                        ) : null}
                      </div>

                      {hasWords && (
                        <div className="text-[#66758A]">
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-[#22D3C5]" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Accordion Word Definition */}
                  {isExpanded && hasWords && words && (
                    <div className="p-3 pt-2 border-t border-[rgba(120,160,200,0.12)] bg-[rgba(10,18,30,0.9)] space-y-2 select-text cursor-text">
                      {/* Multi-word Tabs */}
                      {words.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pb-1 border-b border-[rgba(120,160,200,0.08)] select-none">
                          {words.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectWordForMove(entry.id, w);
                              }}
                              className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold transition-all cursor-pointer ${
                                activeWord === w
                                  ? 'bg-[#22D3C5]/20 text-[#22D3C5] border border-[#22D3C5]/50'
                                  : 'bg-[rgba(20,35,55,0.7)] text-[#91A0B5] hover:text-[#F2F6FC] border border-[rgba(120,160,200,0.1)]'
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
                          <span className="font-mono font-extrabold text-sm text-[#F6C453] tracking-wider">
                            {activeWord}
                          </span>
                          {definition?.phonetic && (
                            <span className="font-mono text-[11px] text-[#91A0B5]">
                              {definition.phonetic}
                            </span>
                          )}
                        </div>

                        {definition && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyDefinitionText(activeWord, definition);
                            }}
                            className="p-1 rounded-md text-[#91A0B5] hover:text-[#F2F6FC] hover:bg-white/[0.05] transition-colors cursor-pointer"
                            title="Copy definition"
                            aria-label={`Copy definition for ${activeWord}`}
                          >
                            {copiedWord === activeWord ? (
                              <Check className="w-3.5 h-3.5 text-[#22D3C5]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Definition content */}
                      {isLoading ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-[#91A0B5] select-none">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#22D3C5]" />
                          <span>Looking up definition...</span>
                        </div>
                      ) : definition && definition.meanings && definition.meanings.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {definition.meanings.map((m, mIdx) => (
                            <div key={mIdx} className="text-xs leading-relaxed">
                              <span className="font-bold text-[10px] text-[#22D3C5] uppercase mr-1.5">
                                [{m.partOfSpeech}]
                              </span>
                              <span className="text-[#F2F6FC]">
                                {m.definitions[0]}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#66758A] italic py-1">
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
