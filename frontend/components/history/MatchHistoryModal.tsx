'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  Trophy,
  Crown,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Trash2,
  Calendar,
  Clock,
  Swords,
  Heart,
  Bot,
  User,
  Sparkles,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  BoardCell,
  CellPosition,
  PlacedTile,
  MatchHistoryItem,
  MatchHistoryPlayer,
  MatchReplayResponse,
  MatchReplayMove,
  MatchReplayPlacedTile,
} from '@/lib/types';
import {
  getMatchHistory,
  getMatchReplay,
  deleteMatchHistory,
  clearAllMatchHistory,
} from '@/lib/api';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { useBoardCamera } from '@/hooks/useBoardCamera';

const EMPTY_CELL_POSITIONS: CellPosition[] = [];
const noop = () => {};

interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGameId?: string | null;
}

interface ReplayBoardCanvasViewProps {
  boardState: Record<string, BoardCell>;
  temporaryTiles: PlacedTile[];
}

const ReplayBoardCanvasView: React.FC<ReplayBoardCanvasViewProps> = ({
  boardState,
  temporaryTiles,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const camera = useBoardCamera();

  // Auto-center board when first mounted
  const hasInitializedCameraRef = useRef(false);
  useEffect(() => {
    if (!hasInitializedCameraRef.current && containerRef.current) {
      hasInitializedCameraRef.current = true;
      camera.resetCamera();
    }
  }, [camera]);

  return (
    <div className="flex-1 flex flex-col bg-slate-950/60 p-2 sm:p-3 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 min-h-[380px]">
      {/* HTML5 Canvas Authentic Board */}
      <div className="relative flex-1 w-full h-full min-h-[300px] overflow-hidden rounded-2xl bg-[#040612] border border-amber-400/20 shadow-[inset_0_2px_20px_rgba(0,0,0,0.85)]">
        <BoardCanvas
          containerRef={containerRef}
          boardState={boardState}
          temporaryTiles={temporaryTiles}
          remotePlacements={EMPTY_CELL_POSITIONS}
          temporaryTilesValid={true}
          selectedCell={null}
          onCellClick={noop}
          onStartPendingDrag={noop}
          onFinishPendingDrag={noop}
          onCollectPendingTile={noop}
          onPendingDragMove={noop}
          dragPreviewCell={null}
          draggingTileId={null}
          dragPreviewTile={null}
          dragPreviewIsValid={null}
          canStageMove={false}
          camera={camera}
        />
      </div>
    </div>
  );
};

export const MatchHistoryModal: React.FC<MatchHistoryModalProps> = ({
  isOpen,
  onClose,
  initialGameId = null,
}) => {
  // Modal state
  const [activeTab, setActiveTab] = useState<'list' | 'replay'>(initialGameId ? 'replay' : 'list');
  const [historyList, setHistoryList] = useState<MatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(initialGameId);
  const [replayData, setReplayData] = useState<MatchReplayResponse | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Playback state
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const moveLogScrollRef = useRef<HTMLDivElement | null>(null);

  // Confirmation state for deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Fetch History List
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await getMatchHistory(50);
      if (res.success) {
        setHistoryList(res.history);
      }
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load match history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Fetch Replay Data
  const fetchReplay = useCallback(async (gameId: string) => {
    setLoadingReplay(true);
    setReplayError(null);
    setIsPlaying(false);
    try {
      const data = await getMatchReplay(gameId);
      if (data.success) {
        setReplayData(data);
        // Default to final move
        setCurrentStep(data.moves.length);
      }
    } catch (err: unknown) {
      setReplayError(err instanceof Error ? err.message : 'Failed to load match replay');
    } finally {
      setLoadingReplay(false);
    }
  }, []);

  // Sync initial game id on modal open
  useEffect(() => {
    if (isOpen) {
      if (initialGameId) {
        setSelectedGameId(initialGameId);
        setActiveTab('replay');
        fetchReplay(initialGameId);
      } else {
        setActiveTab('list');
        fetchHistory();
      }
    } else {
      setIsPlaying(false);
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    }
  }, [isOpen, initialGameId, fetchHistory, fetchReplay]);

  // Handle open replay from list
  const handleSelectReplay = (gameId: string) => {
    setSelectedGameId(gameId);
    setActiveTab('replay');
    fetchReplay(gameId);
  };

  // Handle delete match
  const handleDeleteMatch = async (e: React.MouseEvent, gameId: string) => {
    e.stopPropagation();
    try {
      await deleteMatchHistory(gameId);
      setHistoryList((prev) => prev.filter((m) => m.game_id !== gameId));
      setDeletingId(null);
      if (selectedGameId === gameId) {
        setReplayData(null);
        setSelectedGameId(null);
        setActiveTab('list');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete match');
    }
  };

  // Handle clear all history
  const handleClearAll = async () => {
    try {
      await clearAllMatchHistory();
      setHistoryList([]);
      setIsClearingAll(false);
      setReplayData(null);
      setSelectedGameId(null);
      setActiveTab('list');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to clear match history');
    }
  };

  // Auto-play timer loop
  useEffect(() => {
    if (isPlaying && replayData) {
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= replayData.moves.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    } else if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [isPlaying, replayData]);

  // Reconstruct Board State up to `currentStep - 1` (committed moves)
  const replayBoardState = useMemo<Record<string, BoardCell>>(() => {
    const state: Record<string, BoardCell> = {};
    if (!replayData || !replayData.moves) return state;

    const commitCount = Math.max(0, currentStep - 1);
    for (let i = 0; i < commitCount && i < replayData.moves.length; i++) {
      const move = replayData.moves[i];
      if (move.placed_tiles && Array.isArray(move.placed_tiles)) {
        for (const tile of move.placed_tiles) {
          const key = `${tile.row}_${tile.col}`;
          state[key] = {
            row: tile.row,
            col: tile.col,
            letter: tile.letter,
            value: tile.value,
            player_id: move.player_id,
            turn_number: i + 1,
          };
        }
      }
    }
    return state;
  }, [replayData, currentStep]);

  // Active Placed Tiles for `currentStep` (rendered with active glow)
  const replayTemporaryTiles = useMemo<PlacedTile[]>(() => {
    if (!replayData || currentStep === 0 || currentStep > replayData.moves.length) return [];
    const move = replayData.moves[currentStep - 1];
    if (!move || !move.placed_tiles || !Array.isArray(move.placed_tiles)) return [];

    return move.placed_tiles.map((tile, idx) => ({
      row: tile.row,
      col: tile.col,
      letter: tile.letter,
      value: tile.value,
      tile_id: `replay_step_${currentStep}_${idx}_${tile.row}_${tile.col}`,
    }));
  }, [replayData, currentStep]);

  // Highlighted Tiles / Move details for the Current Step
  const currentMove = useMemo(() => {
    if (!replayData || currentStep === 0 || currentStep > replayData.moves.length) {
      return null;
    }
    return replayData.moves[currentStep - 1];
  }, [replayData, currentStep]);

  // Running scores at `currentStep`
  const currentRunningScores = useMemo(() => {
    if (!replayData) return {};
    if (currentStep === 0) {
      const initial: Record<string, number> = {};
      for (const p of replayData.players) {
        initial[p.id] = 0;
      }
      return initial;
    }
    return replayData.moves[currentStep - 1]?.running_scores || {};
  }, [replayData, currentStep]);

  // Auto scroll active move in move list
  useEffect(() => {
    if (moveLogScrollRef.current && currentStep > 0) {
      const activeEl = moveLogScrollRef.current.querySelector(`[data-move-step="${currentStep}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentStep]);

  // Keyboard navigation for replay
  useEffect(() => {
    if (!isOpen || activeTab !== 'replay' || !replayData) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentStep((prev) => Math.max(0, prev - 1));
        setIsPlaying(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentStep((prev) => Math.min(replayData.moves.length, prev + 1));
        setIsPlaying(false);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentStep(0);
        setIsPlaying(false);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentStep(replayData.moves.length);
        setIsPlaying(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, replayData]);

  if (!isOpen) return null;

  // Format date helper
  const formatMatchDate = (isoStr: string | null) => {
    if (!isoStr) return 'Recent Match';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-6xl h-[94vh] max-h-[920px] rounded-2xl sm:rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 text-white shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
        
        {/* TOP MODAL HEADER */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            {activeTab === 'replay' ? (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list');
                  setIsPlaying(false);
                  fetchHistory();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-xs sm:text-sm font-semibold text-slate-200 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Matches</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Match History & Analysis
                </h2>
              </div>
            )}

            {activeTab === 'replay' && replayData && (
              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-white/10 text-xs text-slate-300">
                <span className="font-bold text-amber-300">
                  Game Replay
                </span>
                <span className="text-slate-500">•</span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-semibold text-[10px]">
                  {replayData.game_mode} Mode
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{replayData.total_moves} Moves</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'list' && historyList.length > 0 && (
              <>
                {isClearingAll ? (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <span className="text-xs text-rose-300 font-medium mr-1">Clear all?</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Yes, Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsClearingAll(false)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsClearingAll(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                    title="Clear all saved matches"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear History</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BODY CONTENT */}
        <div className="relative flex-1 overflow-hidden flex flex-col">
          {/* TAB 1: MATCH HISTORY LIST VIEW */}
          {activeTab === 'list' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                  <RotateCcw className="w-7 h-7 animate-spin text-cyan-400" />
                  <p className="text-sm font-medium">Loading match archives...</p>
                </div>
              ) : historyError ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-rose-400 text-center px-4">
                  <Info className="w-8 h-8 text-rose-400" />
                  <p className="text-sm font-semibold">{historyError}</p>
                  <button
                    type="button"
                    onClick={fetchHistory}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              ) : historyList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 gap-4 text-center px-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-500 shadow-inner">
                    <BookOpen className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">No Match Records Found</h3>
                    <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-md">
                      Play games with friends or bots to record matches. You will be able to replay every move turn-by-turn here!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  {historyList.map((match) => {
                    const winnerPlayer = match.winner || (match.players.length > 0 ? match.players[0] : null);
                    const isHp = match.game_mode === 'HP';

                    return (
                      <div
                        key={match.game_id}
                        onClick={() => handleSelectReplay(match.game_id)}
                        className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.09] bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/90 p-4 sm:p-5 hover:border-cyan-400/50 hover:from-slate-900/98 hover:to-slate-950/98 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[0_8px_30px_rgba(6,182,212,0.18)] hover:-translate-y-0.5"
                      >
                        {/* Top Metadata Row: Mode Badge, Date & Delete */}
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              isHp 
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/25' 
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                            }`}>
                              {isHp ? <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-500/20" /> : <Clock className="w-3.5 h-3.5 text-amber-400" />}
                              {isHp ? 'HP Battle' : 'Turn Match'}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {formatMatchDate(match.started_at || match.created_at)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {deletingId === match.game_id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                   type="button"
                                   onClick={(e) => handleDeleteMatch(e, match.game_id)}
                                   className="px-2.5 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shadow transition-colors"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                  className="px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDeletingId(match.game_id); }}
                                className="opacity-50 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-all"
                                title="Delete match"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Winner Showcase & Players Comparison */}
                        <div className="my-3.5 space-y-2.5">
                          {winnerPlayer && (
                            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-400/30 px-3.5 py-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/25 border border-amber-300/40 text-amber-300 shrink-0">
                                  <Crown className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs sm:text-sm font-bold text-amber-200 truncate">
                                  {winnerPlayer.display_name}
                                </span>
                                {winnerPlayer.is_bot && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 tracking-wider">
                                    BOT
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black text-amber-300 shrink-0">
                                <span className="text-[11px] uppercase tracking-wider text-amber-300/80 font-bold">Winner</span>
                                <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/30 text-amber-200">
                                  {winnerPlayer.score} pts
                                </span>
                              </div>
                            </div>
                          )}

                          {/* All Players Grid */}
                          <div className="grid grid-cols-2 gap-2">
                            {match.players.map((p) => {
                              const isWinner = winnerPlayer?.id === p.id;
                              return (
                                <div
                                  key={p.id}
                                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                                    isWinner
                                      ? 'bg-amber-400/10 border border-amber-400/20 text-amber-100'
                                      : 'bg-black/30 border border-white/5 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {p.is_bot ? (
                                      <Bot className="w-3.5 h-3.5 text-amber-300/80 shrink-0" />
                                    ) : (
                                      <User className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
                                    )}
                                    <span className="truncate font-medium text-[11px] sm:text-xs">
                                      {p.display_name}
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold text-[11px] sm:text-xs ml-1 shrink-0 text-slate-200">
                                    {p.score} pts
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Footer: Moves Count & Analyze CTA */}
                        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                          <span className="text-slate-400 font-medium flex items-center gap-1.5">
                            <Swords className="w-3.5 h-3.5 text-slate-500" />
                            <span>{match.total_moves} Moves Played</span>
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">
                            <span>Analyze Match</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHESS-STYLE TURN-BY-TURN REPLAY & ANALYSIS VIEW */}
          {activeTab === 'replay' && (
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {loadingReplay ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RotateCcw className="w-8 h-8 animate-spin text-cyan-400" />
                  <p className="text-sm font-medium">Reconstructing match timeline...</p>
                </div>
              ) : replayError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-400 text-center px-4">
                  <Info className="w-8 h-8 text-rose-400" />
                  <p className="text-sm font-semibold">{replayError}</p>
                  <button
                    type="button"
                    onClick={() => selectedGameId && fetchReplay(selectedGameId)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Retry Replay
                  </button>
                </div>
              ) : replayData ? (
                <>
                  {/* LEFT: INTERACTIVE REPLAY HTML5 CANVAS BOARD */}
                  <ReplayBoardCanvasView
                    boardState={replayBoardState}
                    temporaryTiles={replayTemporaryTiles}
                  />

                  {/* RIGHT: PLAYBACK SCRUBBER, MOVE BREAKDOWN, RUNNING SCORES & MOVE HISTORY */}
                  <div className="w-full lg:w-96 flex flex-col bg-slate-900/60 p-3 sm:p-4 overflow-hidden shrink-0 space-y-3">
                    
                    {/* 1. PLAYBACK CONTROLS (Media / Esports Style) */}
                    <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] shrink-0 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-cyan-400" />
                          Move Navigation
                        </span>
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                          Step {currentStep} / {replayData.moves.length}
                        </span>
                      </div>

                      {/* Scrubber Range Slider */}
                      <div className="relative flex items-center w-full py-1">
                        <input
                          type="range"
                          min={0}
                          max={replayData.moves.length}
                          value={currentStep}
                          onChange={(e) => {
                            setCurrentStep(Number(e.target.value));
                            setIsPlaying(false);
                          }}
                          className="w-full h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                        />
                      </div>

                      {/* Button Bar: First, Prev, Play/Pause, Next, Last */}
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setCurrentStep(0); setIsPlaying(false); }}
                          disabled={currentStep === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition-all cursor-pointer border border-white/5"
                          title="Jump to Start (Home)"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCurrentStep((s) => Math.max(0, s - 1)); setIsPlaying(false); }}
                          disabled={currentStep === 0}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition-all cursor-pointer border border-white/5"
                          title="Previous Move (Left Arrow)"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (currentStep >= replayData.moves.length) {
                              setCurrentStep(0);
                            }
                            setIsPlaying((p) => !p);
                          }}
                          className="flex-1 h-9 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:brightness-110 active:scale-95 text-white font-black text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer border border-cyan-300/40 uppercase"
                          title="Play / Pause (Spacebar)"
                        >
                          {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                          <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setCurrentStep((s) => Math.min(replayData.moves.length, s + 1)); setIsPlaying(false); }}
                          disabled={currentStep >= replayData.moves.length}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition-all cursor-pointer border border-white/5"
                          title="Next Move (Right Arrow)"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCurrentStep(replayData.moves.length); setIsPlaying(false); }}
                          disabled={currentStep >= replayData.moves.length}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition-all cursor-pointer border border-white/5"
                          title="Jump to End (End)"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* 2. CURRENT TURN CARD BREAKDOWN */}
                    <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 shadow-md shrink-0">
                      {currentMove ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 px-2 items-center justify-center rounded-md bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[11px] font-mono font-bold">
                                Move #{currentStep}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                                {currentMove.is_bot ? <Bot className="w-4 h-4 text-amber-300" /> : <User className="w-4 h-4 text-cyan-300" />}
                                {currentMove.player_name}
                              </span>
                            </div>
                            <span className="text-xs sm:text-sm font-black font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 rounded-lg shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                              +{currentMove.score_earned} pts
                            </span>
                          </div>

                          {/* Words Formed */}
                          {currentMove.words_formed && currentMove.words_formed.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {currentMove.words_formed.map((w, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-mono font-bold flex items-center shadow-sm"
                                >
                                  <span>{w.word}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">
                              {currentMove.move_type === 'PASS'
                                ? 'Turn Passed (Scoreless)'
                                : currentMove.move_type === 'EXCHANGE'
                                ? 'Exchanged Tiles with Tile Bag'
                                : 'No words formed'}
                            </p>
                          )}

                          {/* Player's Rack at this turn */}
                          {(() => {
                            const rackTiles = currentMove.rack_before && currentMove.rack_before.length > 0
                              ? currentMove.rack_before
                              : (currentMove.placed_tiles || []);

                            if (rackTiles.length === 0) return null;

                            // Track which tiles were played in this move
                            const placedCounts = new Map<string, number>();
                            if (currentMove.placed_tiles) {
                              for (const pt of currentMove.placed_tiles) {
                                const l = pt.letter.toUpperCase();
                                placedCounts.set(l, (placedCounts.get(l) || 0) + 1);
                              }
                            }
                            const matchedPlaced = new Map<string, number>();

                            return (
                              <div className="pt-2.5 border-t border-white/[0.08] space-y-2">
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                  <span className="text-slate-300 flex items-center gap-1.5">
                                    <span>Player Hand Rack</span>
                                    <span className="text-amber-400/80 font-normal">({rackTiles.length} Tiles)</span>
                                  </span>
                                  <span className="text-[9px] text-cyan-400 font-semibold">
                                    {currentMove.placed_tiles?.length || 0} Played
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {rackTiles.map((t, idx) => {
                                    const lUpper = t.letter.toUpperCase();
                                    const totalPlaced = placedCounts.get(lUpper) || 0;
                                    const alreadyMatched = matchedPlaced.get(lUpper) || 0;
                                    const isPlaced = alreadyMatched < totalPlaced;
                                    if (isPlaced) {
                                      matchedPlaced.set(lUpper, alreadyMatched + 1);
                                    }

                                    return (
                                      <div
                                        key={idx}
                                        className={`tile-face relative flex flex-col items-center justify-center w-8 h-9 sm:w-9 sm:h-10 rounded-[9px] border font-sans select-none overflow-hidden transition-all duration-150 ${
                                          isPlaced
                                            ? 'border-cyan-300 ring-2 ring-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.7),inset_0_1px_1px_rgba(255,255,255,0.7)] scale-105 z-10'
                                            : 'border-amber-200/80 opacity-80 hover:opacity-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]'
                                        }`}
                                        title={
                                          isPlaced
                                            ? `Played in this move: ${t.letter} (${t.value} pts)`
                                            : `Held in rack: ${t.letter} (${t.value} pts)`
                                        }
                                      >
                                        {/* Top Highlight Glint */}
                                        <div
                                          className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent ${
                                            isPlaced ? 'via-cyan-100/90' : 'via-amber-100/70'
                                          } to-transparent pointer-events-none z-10`}
                                        />

                                        {/* Authentic Letter (Solid Maple font without interior stroke lines) */}
                                        <span
                                          className={`tile-letter tile-letter-orange relative z-20 text-[19px] sm:text-[21px] leading-none font-maple inline-block ${
                                            t.letter.toUpperCase() === 'W'
                                              ? 'scale-x-90 -translate-x-[0.5px]'
                                              : t.letter.toUpperCase() === 'M'
                                              ? 'scale-x-95'
                                              : ''
                                          }`}
                                        >
                                          {t.letter}
                                        </span>

                                        {/* Authentic Score Subscript */}
                                        <span className="tile-score-blue absolute bottom-0.5 right-1 z-20 text-[8.5px] sm:text-[9.5px] font-maple leading-none">
                                          {t.value}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-2 text-xs text-slate-400 font-medium">
                          <span>Initial Empty Board (Turn 0)</span>
                        </div>
                      )}
                    </div>

                    {/* 3. RUNNING SCOREBOARD */}
                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 shrink-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                        <span>Standings at Step {currentStep}</span>
                        {currentStep === replayData.moves.length && (
                          <span className="text-[9px] font-extrabold text-amber-300 flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-300" />
                            <span>FINAL RESULT</span>
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {replayData.players.map((p) => {
                          const score = currentRunningScores[p.id] ?? 0;
                          const isFinalWinner =
                            currentStep === replayData.moves.length &&
                            (replayData.winner_id === p.id ||
                              p.is_winner ||
                              p.score === Math.max(...replayData.players.map((pl) => pl.score)));

                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-colors ${
                                isFinalWinner
                                  ? 'bg-amber-500/20 border border-amber-400/40 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                                  : 'bg-white/5 border border-white/5 text-slate-300 shadow-inner'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isFinalWinner ? (
                                  <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                ) : p.is_bot ? (
                                  <Bot className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                ) : (
                                  <User className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                                )}
                                <span className="truncate text-slate-200 font-medium text-[11px]">
                                  {p.display_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 ml-1.5 shrink-0 font-mono">
                                <span className="font-bold text-amber-300 text-xs">
                                  {score} pts
                                </span>
                                {isFinalWinner && (
                                  <span className="text-[8px] font-black px-1 py-0.2 rounded bg-amber-400/30 text-amber-200 border border-amber-400/50 uppercase">
                                    WIN
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. SCROLLABLE MOVE HISTORY LOG (CHESS NOTATION STYLE) */}
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                        <span>Turn-by-Turn Notation</span>
                        <span className="text-[9px] text-cyan-400 font-normal">Click step to inspect</span>
                      </div>
                      <div
                        ref={moveLogScrollRef}
                        className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar"
                      >
                        {/* Turn 0 Item */}
                        <button
                          type="button"
                          onClick={() => { setCurrentStep(0); setIsPlaying(false); }}
                          data-move-step={0}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                            currentStep === 0
                              ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-bold shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                              : 'bg-white/[0.03] hover:bg-white/[0.08] text-slate-400'
                          }`}
                        >
                          <span className="font-mono text-[10px] text-slate-500">#0</span>
                          <span className="text-[11px] font-medium">Initial Board State</span>
                          <span className="font-mono text-[10px] text-slate-500">0 pts</span>
                        </button>

                        {replayData.moves.map((move, idx) => {
                          const stepNumber = idx + 1;
                          const isActive = currentStep === stepNumber;
                          const isFinalStep = idx === replayData.moves.length - 1;
                          const wordSummary =
                            move.words_formed && move.words_formed.length > 0
                              ? move.words_formed.map((w) => w.word).join(', ')
                              : move.move_type;

                          return (
                            <button
                              key={move.move_id || idx}
                              type="button"
                              onClick={() => { setCurrentStep(stepNumber); setIsPlaying(false); }}
                              data-move-step={stepNumber}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-gradient-to-r from-amber-500/25 to-amber-500/10 border border-amber-400/50 text-amber-200 font-bold shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/40'
                                  : isFinalStep
                                  ? 'bg-amber-500/10 hover:bg-amber-500/15 border border-amber-400/30 text-amber-200'
                                  : 'bg-white/[0.03] hover:bg-white/[0.08] text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                  #{stepNumber}
                                </span>
                                <span className="truncate text-[11px] font-medium text-slate-200">
                                  {move.player_name}: <strong className="text-white font-mono font-bold">{wordSummary}</strong>
                                </span>
                                {isFinalStep && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black uppercase tracking-wider shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                                    <Crown className="w-2.5 h-2.5 text-amber-300 fill-amber-300/30" />
                                    <span>WINNER</span>
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[11px] font-bold text-emerald-400 shrink-0 ml-1.5">
                                +{move.score_earned}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
