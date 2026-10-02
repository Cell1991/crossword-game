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
    <aside className={`game-match-hud-content flex min-w-0 flex-col select-none ${mobile ? 'w-full p-0' : 'w-full'}`}>
      <div className="flex min-w-0 flex-col">
        <section className="game-bag-panel" aria-label="Letter bag">
          <button
            ref={tileBagButtonRef}
            type="button"
            onClick={() => setIsTileBagOpen(true)}
            className="game-bag-summary"
            aria-label={`Show remaining letters, ${tileBagCount} tiles remaining`}
          >
            <span className="game-bag-copy">
              <span className="game-section-eyebrow">Letter bag</span>
              <span className="game-bag-label">Tiles left</span>
            </span>
            <span className="game-bag-count font-mono tabular-nums">{tileBagCount}</span>
          </button>
        </section>

        <section className="game-score-panel" aria-label="Scoreboard">
          <div className="game-section-heading">
            <div className="game-section-heading-title">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              <span>Players</span>
            </div>
            <span className="game-section-count">{players.length} {players.length === 1 ? 'player' : 'players'}</span>
          </div>

          <div className="game-players-list">
            {sortedPlayers.map((player, idx) => {
              const isCurrent = player.id === currentPlayerId;
              const isMe = player.id === myPlayerId;
              const isDead = player.hp <= 0;
              const hasLeft = player.connection_status === 'OFFLINE';
              const hasShield = Boolean(player.has_shield && !isDead);
              const playerMaxHp = player.max_hp || maxHp;
              const displayName = player.display_name.trim() || 'Player';

              return (
                <div
                  key={player.id}
                  className="game-player-row"
                  data-current={isCurrent && !isDead}
                  data-inactive={isDead || hasLeft}
                >
                  <div className="game-player-topline">
                    <div className="game-player-main">
                      <span className="game-player-rank font-mono tabular-nums" aria-label={`Rank ${idx + 1}`}>
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="game-player-crest" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
                      <div className="game-player-identity">
                        <div className="game-player-name-line">
                          <span className="game-player-name" title={displayName}>{displayName}</span>
                          {isMe && <span className="game-player-you">You</span>}
                          {player.is_host && <Crown className="game-player-host h-3.5 w-3.5" aria-label="Host" />}
                          {hasShield && <Shield className="game-player-shield h-3.5 w-3.5" aria-label="Shield active" />}
                          {cardUseEffects[player.id] && (
                            <span className="game-player-effect" title={`${cardUseEffects[player.id]} used`}>
                              {cardIcon(cardUseEffects[player.id], 'h-3.5 w-3.5', <span>×2</span>) ?? '✨'}
                            </span>
                          )}
                        </div>
                        <div className="game-player-subline">
                          {isDead ? 'Eliminated' : hasLeft ? 'Left game' : isCurrent ? 'Playing now' : 'Waiting for turn'}
                          {player.connection_status === 'ONLINE'
                            ? <Wifi className="h-3 w-3" aria-label="Online" />
                            : <WifiOff className="h-3 w-3" aria-label="Offline" />}
                        </div>
                      </div>
                    </div>
                    <div className="game-player-score font-mono tabular-nums">
                      <strong>{player.score}</strong>
                      <span>pts</span>
                    </div>
                  </div>

                  {showHealth && (
                    <div className="game-player-health">
                      <div className="game-player-health-label">
                        <span>Health</span>
                        <span className="font-mono tabular-nums">{Math.max(0, player.hp)} / {playerMaxHp}</span>
                      </div>
                      <div
                        className="game-player-health-track"
                        role="progressbar"
                        aria-label={`${displayName} health`}
                        aria-valuemin={0}
                        aria-valuemax={playerMaxHp}
                        aria-valuenow={Math.max(0, Math.min(playerMaxHp, player.hp))}
                      >
                        <div
                          className={`game-player-health-fill ${hasShield ? 'is-shielded' : ''} ${player.hp <= playerMaxHp / 2 ? 'is-low' : ''}`}
                          style={{ width: `${Math.max(0, Math.min(100, (player.hp / playerMaxHp) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <div className="game-move-log flex flex-col">
          <button
            type="button"
            onClick={() => setIsHistoryOpen(prev => !prev)}
            className="game-move-trigger flex w-full shrink-0 items-center justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/60 cursor-pointer"
          >
            <div className="game-section-heading-title flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              <span>Recent moves</span>
            </div>
            {isHistoryOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>

          {isHistoryOpen && (
            <div className="max-h-[24vh] overflow-y-auto px-3 pb-3 pr-2">
              {moveHistory.length === 0 ? (
                <div className="game-move-empty">
                  Moves will appear here
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
                          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/45 bg-cyan-300/10 text-xs font-black uppercase text-cyan-200">
                            {actorName.trim().charAt(0) || '?'}
                          </span>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-amber-200">
                              {actorName}
                            </span>
                            <span className="truncate text-[10px] font-medium tracking-wide text-slate-400">
                              {moveLabel}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex flex-col items-end gap-0.5 font-mono text-[10px] font-bold tabular-nums text-slate-100">
                            <span>{entry.score ?? 0} PTS</span>
                            {entry.turn_number && <span className="text-[9px] font-normal text-slate-400">Turn {entry.turn_number}</span>}
                          </span>
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


