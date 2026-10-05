'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Bug, Eye, Skull } from 'lucide-react';
import { commitMove, exchangeTiles, executeBotMove, expireTurn, getBotPlan, leaveGame, passTurn, rematchGame, sessionStore } from '@/lib/api';
import confetti from 'canvas-confetti';
import { soundFx } from '@/lib/soundFx';
import { motion, AnimatePresence } from 'motion/react';
import { buildRackSlots } from '@/lib/rack';
import { BotDifficulty, CellPosition, GameState, Tile, Player, PlacedTile } from '@/lib/types';
import { TILE_THEME_STYLE } from '@/lib/tileTheme';
import { isBlankLetter } from '@/lib/tiles';
import { useBoardCamera } from '@/hooks/useBoardCamera';
import { useGameSession } from '@/hooks/useGameSession';
import { useGameSync } from '@/hooks/useGameSync';
import { useGameToasts } from '@/hooks/useGameToasts';
import { usePowerCards } from '@/hooks/usePowerCards';
import { useRackOrder } from '@/hooks/useRackOrder';
import { useStagedMove } from '@/hooks/useStagedMove';
import { useTileDrag } from '@/hooks/useTileDrag';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { TileRack } from '@/components/rack/TileRack';
import { FloatingTile } from '@/components/rack/FloatingTile';
import { RightSidebar } from '@/components/game/RightSidebar';
import { PowerCardBar } from '@/components/game/PowerCardBar';
import { GameHud } from '@/components/game/GameHud';
import { TurnTimer } from '@/components/game/TurnTimer';
import { GameOverScreen } from '@/components/game/GameOverScreen';
import { CardRevealOverlay, CardActivationOverlay, PendingEffectBanner, ToastStack } from '@/components/game/GameOverlays';
import { ScreenVignettePulse, SpySwapNotificationOverlay, TargetLockNotificationOverlay, BoardEffectsLayer } from '@/components/game/CardCinematicEffects';
import { HintSuggestionsOverlay } from '@/components/game/HintSuggestionsOverlay';
import { BlankTilePickerModal } from '@/components/game/BlankTilePickerModal';
import { ConfirmExitModal } from '@/components/game/ConfirmExitModal';
import { MobileInfoModal } from '@/components/game/MobileInfoModal';
import BackgroundMusic from '@/components/audio/BackgroundMusic';
import { GameGuideModal } from '@/components/game/GameGuideModal';
import { GrimoireModal } from '@/components/game/GrimoireModal';
import { DebugPanel } from '@/components/debug/DebugPanel';
import ParticleField from '@/components/effects/ParticleField';

const EMPTY_TILES: Tile[] = [];
const EMPTY_CELL_POSITIONS: CellPosition[] = [];
const activeBotTurns = new Set<string>();

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const isDebug = searchParams.get('debug') === '1';

  const { session, hydrated, debugSessions, switchSession } = useGameSession(gameId, isDebug);
  const myPlayerId = session?.playerId ?? null;
  /** Watching without a seat: no token, no rack, no turns. */
  const isSpectator = Boolean(session?.isSpectator);
  const toasts = useGameToasts();
  const { rackOrder, shuffle, swapSeats, seatReturning, reconcile } = useRackOrder();
  const camera = useBoardCamera();

  // Debug mode: one browser tab controls every clone, so when the turn hands off to another
  // clone we auto-switch "acting as" to them instead of leaving the tester stuck on whoever
  // just passed. Fires once per turn change so a manual "Act as" switch to inspect an off-turn
  // player isn't immediately overridden.
  const autoSwitchedTurnRef = useRef<string | null>(null);
  const handleSnapshot = useCallback((state: GameState) => {
    // A sync that arrives before the player id is known carries no rack for us. Reseating from
    // it would blank every seat, so leave the seating alone until we can see our own tiles.
    const myServerPlayer = state.players.find(player => player.id === myPlayerId);
    if (myServerPlayer) reconcile(myServerPlayer.rack ?? EMPTY_TILES);

    const turnPlayerId = state.current_player_id;
    if (!isDebug || !turnPlayerId || turnPlayerId === myPlayerId) return;
    if (autoSwitchedTurnRef.current === turnPlayerId) return;
    const next = debugSessions.find(debugSession => debugSession.playerId === turnPlayerId);
    if (!next) return;
    autoSwitchedTurnRef.current = turnPlayerId;
    switchSession(next);
  }, [debugSessions, isDebug, myPlayerId, reconcile, switchSession]);

  const sync = useGameSync({ gameId, session, hydrated, isDebug, toasts, onSnapshot: handleSnapshot });
  const { gameState, reload, setGameState } = sync;

  const isMyTurn = gameState?.current_player_id === myPlayerId;
  const myPlayer = gameState?.players.find(p => p.id === myPlayerId);
  const canStageMove = Boolean(myPlayer && myPlayer.hp > 0 && myPlayer.connection_status !== 'OFFLINE');
  const boardState = useMemo(() => gameState?.board_state ?? {}, [gameState?.board_state]);
  const serverRack: Tile[] = myPlayer?.rack ?? EMPTY_TILES;
  const opponents = gameState?.players.filter(p => p.id !== myPlayerId) ?? [];
  const pendingEffect = gameState?.pending_effect ?? null;
  const pendingTargetsMe = Boolean(pendingEffect && myPlayerId && (
    pendingEffect.type === 'DAMAGE'
      ? Boolean(pendingEffect.damage?.[myPlayerId])
      : pendingEffect.target_player_id === myPlayerId
  ));
  const iHaveShield = (myPlayer?.cards ?? []).includes('SHIELD');

  const staged = useStagedMove({
    gameId,
    myPlayerId,
    isMyTurn,
    canStageMove,
    boardState,
    sendMessage: sync.sendMessage,
    setError: toasts.setError,
  });
  const { temporaryTiles, pendingTileIds } = staged;
  const rackSlots = useMemo(
    () => buildRackSlots(serverRack, rackOrder, pendingTileIds),
    [pendingTileIds, rackOrder, serverRack]
  );
  const myRack = useMemo(
    () => rackSlots.filter((tile): tile is Tile => Boolean(tile)),
    [rackSlots]
  );

  const cards = usePowerCards({ gameId, myPlayerId, boardState, temporaryTiles, reload, toasts });
  const { armedCard, playArmedCardAt } = cards;
  /** The staged tile a FREEZE_TILE mark will apply to on Confirm Move, for the board highlight. */
  const deferredFreezeCell = useMemo(() => {
    if (!cards.deferredFreezeTileId) return null;
    const tile = temporaryTiles.find(t => t.tile_id === cards.deferredFreezeTileId);
    return tile ? { row: tile.row, col: tile.col } : null;
  }, [cards.deferredFreezeTileId, temporaryTiles]);
  const { handleCellClick: placeAtCell, unstageTile, selectTile, clearSelection, clearStagedMove } = staged;
  const { validationState, validationReason } = staged;
  const { flashError, setError } = toasts;

  /** The board viewport and the rack tray; drags that end over them are hit-tested against these. */
  const boardRef = useRef<HTMLDivElement>(null);
  const rackRef = useRef<HTMLDivElement>(null);
  /** Tiles picked to swap with the bag; `null` while the player is not exchanging. */
  const [exchangeTileIds, setExchangeTileIds] = useState<string[] | null>(null);
  const [botStagedTiles, setBotStagedTiles] = useState<PlacedTile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isGrimoireOpen, setIsGrimoireOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const seatReturningTile = useCallback((tileId: string, targetSlot: number) => {
    seatReturning(tileId, targetSlot, pendingTileIds);
  }, [pendingTileIds, seatReturning]);

  const hoverHandlerRef = useRef<((cell: CellPosition | null) => void) | null>(null);

  const {
    dragSession,
    ghostRef: dragGhostRef,
    updateDragHover,
    finishDrag,
    cancelDrag,
    startRackDrag,
    startPendingDrag,
  } = useTileDrag({
    canStageMove,
    boardState,
    temporaryTiles,
    boardRef,
    rackRef,
    screenToCell: camera.screenToCell,
    deselectTile: staged.deselectTile,
    stageTile: staged.stageTile,
    swapStagedTiles: staged.swapStagedTiles,
    unstageTile: staged.unstageTile,
    seatReturningTile,
    onSwapSlots: swapSeats,
    onHoverCellChange: (cell) => hoverHandlerRef.current?.(cell),
  });

  // A new turn clears the selection, the verdict, the other player's preview and any exchange.
  const { handleTurnChange } = staged;
  const { clearRemotePlacements } = sync;
  const turnKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameState) return;
    const nextTurnKey = `${gameState.turn_number}:${gameState.current_player_id ?? 'none'}`;
    if (turnKeyRef.current !== null && turnKeyRef.current !== nextTurnKey) {
      handleTurnChange(gameState);
      clearRemotePlacements();
      setExchangeTileIds(null);
      cards.clearHints();
      // Never wipe the preview while this tab is animating a bot turn - the turn key has already
      // moved on by then, and clearing mid-animation is what made tiles lift off and drop again.
      if (activeBotTurns.size === 0) {
        startTransition(() => setBotStagedTiles([]));
      }
    }
    turnKeyRef.current = nextTurnKey;
  }, [cards, clearRemotePlacements, gameId, gameState, handleTurnChange]);

  const handleTimeUp = useCallback(() => expireTurn(gameId).then(() => reload()), [gameId, reload]);

  const handleSelectHint = useCallback((index: number) => {
    cards.setActiveHintIndex(index);
    const suggestion = cards.hintSuggestions[index];
    if (suggestion && serverRack.length > 0) {
      staged.stageHintTiles(suggestion.tiles, serverRack);
    }
  }, [cards, serverRack, staged]);

  // When hint suggestions arrive or change, automatically stage tiles onto the board
  const prevHintKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (cards.hintSuggestions.length > 0) {
      const activeSuggestion = cards.hintSuggestions[cards.activeHintIndex];
      const hintKey = `${cards.activeHintIndex}:${activeSuggestion?.word ?? ''}`;
      if (activeSuggestion && serverRack.length > 0) {
        if (prevHintKeyRef.current !== hintKey) {
          prevHintKeyRef.current = hintKey;
          staged.stageHintTiles(activeSuggestion.tiles, serverRack);
        }
      }
    } else {
      prevHintKeyRef.current = null;
    }
  }, [cards.activeHintIndex, cards.hintSuggestions, serverRack, staged]);

  // Handlers below are stable callbacks: TileRack, PowerCardBar and RightSidebar are memoised
  // so a drag crossing into another cell does not re-render them.
  const handleCellClick = useCallback((row: number, col: number) => {
    if (armedCard) {
      playArmedCardAt(row, col);
      return;
    }
    placeAtCell(row, col, myRack);
  }, [armedCard, myRack, placeAtCell, playArmedCardAt]);

  const handleCollectPendingTile = useCallback((tileId: string) => {
    if (!canStageMove) return;
    unstageTile(tileId);
  }, [canStageMove, unstageTile]);

  const isExchanging = exchangeTileIds !== null;
  const handleSelectTile = useCallback((tile: Tile) => {
    if (isExchanging) {
      setExchangeTileIds(prev => prev && (
        prev.includes(tile.id) ? prev.filter(id => id !== tile.id) : [...prev, tile.id]
      ));
      return;
    }
    selectTile(tile);
  }, [isExchanging, selectTile]);

  const handleStartExchange = useCallback(() => {
    clearSelection();
    setExchangeTileIds([]);
  }, [clearSelection]);

  const handleCancelExchange = useCallback(() => setExchangeTileIds(null), []);

  const handleShuffleRack = useCallback(() => shuffle(pendingTileIds), [pendingTileIds, shuffle]);

  const handleConfirmExchange = useCallback(async () => {
    if (!myPlayerId || !exchangeTileIds?.length) return;
    setIsSubmitting(true);
    try {
      await exchangeTiles(gameId, myPlayerId, exchangeTileIds);
      setExchangeTileIds(null);
      cards.clearHints();
      reload();
    } catch (error: unknown) {
      flashError(error instanceof Error ? error.message : 'Failed to exchange tiles');
    } finally {
      setIsSubmitting(false);
    }
  }, [cards, exchangeTileIds, flashError, gameId, myPlayerId, reload]);

  const handleConfirmMove = useCallback(async () => {
    if (!myPlayerId || temporaryTiles.length === 0) return;
    if (validationState === false) {
      setError(validationReason || 'Fix the invalid word before confirming');
      return;
    }
    const tilesToCommit = [...temporaryTiles];
    const wasBingo = tilesToCommit.length >= 7;
    const moveScore = (staged.estimatedScore && staged.estimatedScore > 0)
      ? staged.estimatedScore
      : tilesToCommit.reduce((sum, t) => sum + (t.value || 1), 0);

    setIsSubmitting(true);

    // 1. INSTANT (0ms) Feedback: Play sound & optimistic state update
    if (moveScore > 0) {
      soundFx.playScoreBurst(moveScore, wasBingo);
    }
    if (wasBingo) {
      toasts.flashInfo('🎉 BINGO! All 7 tiles placed (+50 Bonus Points)!');
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#38bdf8', '#fbbf24', '#34d399', '#f43f5e', '#a855f7'],
      });
    }

    const committedTileIds = new Set(tilesToCommit.map(t => t.tile_id));
    setGameState(prev => {
      if (!prev) return prev;
      const nextBoard = { ...prev.board_state };
      for (const t of tilesToCommit) {
        nextBoard[`${t.row}_${t.col}`] = {
          row: t.row,
          col: t.col,
          letter: t.letter,
          value: t.value,
          player_id: myPlayerId,
          turn_number: prev.turn_number,
        };
      }
      return {
        ...prev,
        board_state: nextBoard,
        players: prev.players.map(p => {
          if (p.id === myPlayerId) {
            return {
              ...p,
              score: (p.score || 0) + moveScore,
              rack: (p.rack || []).filter(tile => !committedTileIds.has(tile.id)),
            };
          }
          return p;
        }),
      };
    });

    clearStagedMove(true);
    cards.clearHints();

    // 2. Authoritative background server commit
    try {
      const freezeTileId = cards.deferredFreezeTileId ?? undefined;
      const res = await commitMove(gameId, myPlayerId, tilesToCommit, freezeTileId);
      if (res) {
        setGameState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            turn_number: res.turn_number ?? prev.turn_number + 1,
            current_player_id: res.next_player_id ?? prev.current_player_id,
          };
        });
      }
    } catch (error: unknown) {
      flashError(error instanceof Error ? error.message : 'Failed to commit move');
      reload();
    } finally {
      setIsSubmitting(false);
    }
  }, [cards, clearStagedMove, flashError, gameId, myPlayerId, reload, setError, setGameState, staged.estimatedScore, temporaryTiles, toasts, validationReason, validationState]);

  const handlePassTurn = useCallback(async () => {
    if (!myPlayerId) return;
    setIsSubmitting(true);
    try {
      await passTurn(gameId, myPlayerId);
      cards.clearHints();
      reload();
    } catch (error: unknown) {
      flashError(error instanceof Error ? error.message : 'Failed to pass turn');
    } finally {
      setIsSubmitting(false);
    }
  }, [flashError, gameId, myPlayerId, reload]);

  // --- Bot Player Turn Automation & Step-by-Step Animated Tile Placement ---
  const currentTurnPlayer = gameState?.players?.find(p => p.id === gameState?.current_player_id);
  // Whether a seat is the AI comes from the server's own flag. Matching on the display name used to
  // mean a human called "Robert" drove the bot automation, and renaming a bot changed its level.
  const isBotTurn = Boolean(currentTurnPlayer?.is_bot);

  const botDifficulty = useMemo<BotDifficulty>(
    () => currentTurnPlayer?.bot_difficulty ?? 'medium',
    [currentTurnPlayer?.bot_difficulty],
  );

  const firstHumanPlayer = gameState?.players?.find(p => !p.is_bot);
  const isHostDriver = !isSpectator && (Boolean(session?.isHost) || firstHumanPlayer?.id === myPlayerId || !firstHumanPlayer);

  const lastCompletedBotTurnRef = useRef<string | null>(null);
  const sendMessageRef = useRef(sync.sendMessage);
  useEffect(() => {
    sendMessageRef.current = sync.sendMessage;
  }, [sync.sendMessage]);
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    if (!gameState || gameState.status !== 'PLAYING') return;
    if (!isBotTurn || !currentTurnPlayer || !isHostDriver || !gameState.current_player_id) return;

    const turnKey = `${gameState.turn_number}:${gameState.current_player_id}`;
    const activeTurnId = `${gameId}:${turnKey}`;
    if (lastCompletedBotTurnRef.current === turnKey || activeBotTurns.has(activeTurnId)) return;

    activeBotTurns.add(activeTurnId);

    const runBotTurn = async () => {
      try {
        console.log(`[Bot] Starting turn ${turnKey} for ${currentTurnPlayer.display_name} (${botDifficulty})`);
        // 1. Fetch move from backend in parallel with natural "thinking" duration
        const minThinkMs = botDifficulty === 'hard' ? 500 : botDifficulty === 'medium' ? 800 : 1100;
        const planPromise = getBotPlan(gameId, botDifficulty);
        const [plan] = await Promise.all([
          planPromise,
          new Promise(r => setTimeout(r, minThinkMs)),
        ]);

        console.log('[Bot] Received plan:', plan);
        // The server pins one plan per turn, so re-asking returns the same answer.
        const activePlan = plan;
        const planTiles = activePlan.tiles ?? [];
        if (planTiles.length > 0) {
          // Place tiles step-by-step (one by one) with clear, distinct visual feedback
          const stepDelay = botDifficulty === 'hard' ? 280 : botDifficulty === 'medium' ? 380 : 480;
          const stagedList: PlacedTile[] = [];

          for (const tile of planTiles) {
            stagedList.push(tile);
            setBotStagedTiles([...stagedList]);

            // Broadcast staging to other players / spectators
            sendMessageRef.current?.({
              type: 'PLACEMENT_PREVIEW',
              tiles: stagedList.map(t => ({ row: t.row, col: t.col })),
              botTiles: stagedList,
            });

            await new Promise(r => setTimeout(r, stepDelay));
          }

          // Short suspense delay before committing word so the player can see the full word formed
          await new Promise(r => setTimeout(r, 500));

          console.log('[Bot] Committing move with tiles:', activePlan.tiles);
          const execRes = await executeBotMove(gameId, activePlan);
          lastCompletedBotTurnRef.current = turnKey;

          // Optimistically bake bot tiles directly into board_state
          // BEFORE clearing botStagedTiles so tiles NEVER vanish from the board!
          if (execRes?.board_state) {
            setGameState(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                board_state: execRes.board_state!,
                current_player_id: execRes.next_player_id ?? prev.current_player_id,
                turn_number: execRes.turn_number ?? prev.turn_number,
                players: prev.players.map(p => {
                  if (p.id === currentTurnPlayer.id && typeof execRes.player_total_score === 'number') {
                    return { ...p, score: execRes.player_total_score };
                  }
                  return p;
                }),
              };
            });
          } else {
            setGameState(prev => {
              if (!prev) return prev;
              const nextBoard = { ...prev.board_state };
              for (const t of planTiles) {
                nextBoard[`${t.row}_${t.col}`] = {
                  row: t.row,
                  col: t.col,
                  letter: t.letter,
                  value: t.value,
                  player_id: currentTurnPlayer.id,
                  turn_number: prev.turn_number,
                };
              }
              return {
                ...prev,
                board_state: nextBoard,
                current_player_id: execRes?.next_player_id ?? prev.current_player_id,
              };
            });
          }

          if (execRes?.words_formed?.length) {
            const wordList = execRes.words_formed.map((w: { word: string }) => w.word.toUpperCase());
            const wordsStr = wordList.join(', ');
            const pts = execRes.score_earned ?? 0;
          }
        } else {
          console.log('[Bot] Executing fallback move on backend');
          const execRes = await executeBotMove(gameId, { action: 'MOVE', bot_player_id: gameState.current_player_id || '' });
          lastCompletedBotTurnRef.current = turnKey;
          if (execRes?.board_state) {
            setGameState(prev => prev ? {
              ...prev,
              board_state: execRes.board_state!,
              current_player_id: execRes.next_player_id ?? prev.current_player_id,
              turn_number: execRes.turn_number ?? prev.turn_number,
            } : prev);
          }
        }

        setBotStagedTiles([]);
        reloadRef.current?.();
      } catch (err) {
        console.error('[Bot] Turn execution error, falling back to server execution:', err);
        try {
          if (gameState.current_player_id) {
            const retryRes = await executeBotMove(gameId, { action: 'MOVE', bot_player_id: gameState.current_player_id });
            lastCompletedBotTurnRef.current = turnKey;
            if (retryRes?.board_state) {
              setGameState(prev => prev ? {
                ...prev,
                board_state: retryRes.board_state!,
                current_player_id: retryRes.next_player_id ?? prev.current_player_id,
                turn_number: retryRes.turn_number ?? prev.turn_number,
              } : prev);
            }
            reloadRef.current?.();
          }
        } catch (retryErr) {
          console.error('[Bot] Server fallback error:', retryErr);
          lastCompletedBotTurnRef.current = turnKey;
        }
      } finally {
        activeBotTurns.delete(activeTurnId);
        setBotStagedTiles([]);
      }
    };

    void runBotTurn();
  }, [
    botDifficulty,
    currentTurnPlayer,
    gameId,
    gameState,
    isBotTurn,
    isHostDriver,
    setGameState,
    toasts,
  ]);

  // The game UI needs the browser session and a game snapshot first. This loading view reads no
  // client-only state, so the server and the client's first paint render it identically (no
  // hydration mismatch) while the session/state fetch that used to show a blank screen resolves.
  if (!hydrated || !session || sync.loading || !gameState || isLeaving) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #020617 0%, #0f172a 58%, #171942 100%)' }}
      >
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
      </div>
    );
  }

  if (gameState.status === 'FINISHED') {
    const rematchPin = gameState.rematch_pin;
    const handlePlayAgain = async () => {
      // A debug game's clones all live in this tab, so set up a fresh set of them instead.
      if (isDebug) {
        router.push('/debug');
        return;
      }
      // Already seated in the new lobby (joined it, then came back here): go back to that seat.
      const last = sessionStore.getLast();
      if (rematchPin && last && !last.isSpectator && last.gamePin === rematchPin) {
        router.push(`/lobby/${rematchPin}`);
        return;
      }
      const res = await rematchGame(gameId, myPlayerId ?? '');
      sessionStore.save({
        gameId: res.game_id,
        playerId: res.player_id,
        token: res.session_token,
        displayName: res.display_name,
        isHost: res.is_host,
        gamePin: res.game_pin,
      });
      router.push(`/lobby/${res.game_pin}`);
    };
    return (
      <GameOverScreen
        gameState={gameState}
        myPlayerId={myPlayerId}
        onHome={() => router.push('/')}
        onPlayAgain={isSpectator ? undefined : handlePlayAgain}
      />
    );
  }

  const isHpMode = gameState.max_turns === null;
  const isEligibleForTurn = (p: Player) => (!isHpMode || p.hp > 0) && p.connection_status !== 'OFFLINE';
  const isEliminated = Boolean(myPlayer && isHpMode && myPlayer.hp <= 0);

  const tileBagCount = gameState.tile_bag_count ?? 0;
  const currentPlayer = gameState.players.find(p => p.id === gameState.current_player_id);
  const sortedPlayers = [...(gameState.players ?? [])].sort((a, b) => a.turn_order - b.turn_order);
  const currentPlayerIndex = sortedPlayers.findIndex(p => p.id === gameState.current_player_id);

  let nextPlayer: Player | undefined = undefined;
  if (currentPlayerIndex >= 0 && sortedPlayers.length > 1) {
    for (let step = 1; step <= sortedPlayers.length; step++) {
      const candidate = sortedPlayers[(currentPlayerIndex + step) % sortedPlayers.length];
      if (isEligibleForTurn(candidate) && candidate.id !== gameState.current_player_id) {
        nextPlayer = candidate;
        break;
      }
    }
  }

  const handleExit = () => {
    if (isSpectator) {
      setIsLeaving(true);
      sessionStore.remove(gameId);
      router.replace('/');
      return;
    }
    setIsExitModalOpen(true);
  };

  const handleConfirmExit = async () => {
    setIsLeaving(true);
    setIsExitModalOpen(false);
    sessionStore.remove(gameId);
    if (myPlayerId) {
      try {
        await leaveGame(gameId, myPlayerId);
      } catch {}
    }
    router.replace('/');
  };

  return (
    <div
      className="wordx-game-shell relative flex h-[100dvh] min-h-[100dvh] w-screen flex-col overflow-hidden bg-slate-950"
      style={{
        ...TILE_THEME_STYLE,
        background: 'radial-gradient(ellipse at 48% 50%, rgba(8, 145, 178, 0.09), transparent 46%), radial-gradient(ellipse at 88% 8%, rgba(99, 102, 241, 0.11), transparent 34%), linear-gradient(135deg, #020617 0%, #0b1224 58%, #12152f 100%)',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 shadow-[inset_0_0_130px_rgba(0,0,0,0.42)]" />
      <ParticleField className="pointer-events-none fixed inset-0 w-screen h-screen z-0 opacity-40" accent="245, 158, 11" />
      <GameHud
        isSpectator={isSpectator}
        isEliminated={isEliminated}
        isConnected={sync.isConnected}
        roomPin={gameState.game_pin ?? session.gamePin ?? null}
        myPlayerName={myPlayer?.display_name}
        spectatorCount={gameState.spectator_count ?? 0}
        isMyTurn={isMyTurn}
        isBotPlacing={isBotTurn && (botStagedTiles.length > 0 || (sync.remoteBotTiles?.length ?? 0) > 0)}
        currentPlayer={currentPlayer}
        nextPlayer={nextPlayer}
        turnNumber={gameState.turn_number ?? 1}
        maxTurns={gameState.max_turns}
        totalPlayers={gameState.players.length}
        onExit={handleExit}
        onOpenInfo={() => setIsMobileInfoOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenGrimoire={() => setIsGrimoireOpen(true)}
        isGrimoireEnabled={Boolean(gameState.enable_grimoire)}
        debugSlot={
          isDebug ? (
            <button
              type="button"
              onClick={() => setIsDebugOpen(prev => !prev)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0 select-none ${
                isDebugOpen
                  ? 'border-rose-400 bg-rose-950/80 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.45)] ring-1 ring-rose-400/50'
                  : 'border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 hover:text-white hover:border-rose-400/70 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
              }`}
              title="Toggle Sandbox Developer Tools"
              aria-label="Toggle Sandbox Developer Tools"
            >
              <Bug className="h-3.5 w-3.5 text-rose-400 drop-shadow-[0_0_4px_#fb7185] shrink-0" />
              <span className="tracking-wide">Debug</span>
            </button>
          ) : undefined
        }
        timer={(
          <TurnTimer
            turnTimeLimit={gameState.turn_time_limit}
            turnStartedAt={gameState.turn_started_at}
            turnNumber={gameState.turn_number}
            currentPlayerId={gameState.current_player_id}
            clockOffsetRef={sync.clockOffsetRef}
            syncedAt={sync.syncedAt}
            onTimeUp={handleTimeUp}
          />
        )}
      />

      <BackgroundMusic src="/audio/escapism.mp3" />

      {pendingEffect && (
        <PendingEffectBanner
          effect={pendingEffect}
          canShield={pendingTargetsMe && iHaveShield}
          busy={cards.busy}
          onShield={cards.playShield}
        />
      )}

      {sync.cardReveal && (!sync.cardReveal.playerId || sync.cardReveal.playerId === myPlayerId) && (
        <CardRevealOverlay
          reveal={sync.cardReveal}
          onDismiss={sync.dismissCardReveal}
        />
      )}

      <AnimatePresence>
        {sync.activeCardCast && <CardActivationOverlay event={sync.activeCardCast} />}
      </AnimatePresence>

      {/* Screen-wide Environmental Vignette Pulses (Freeze frost, Destroy fireball, etc.) */}
      <ScreenVignettePulse
        type={sync.screenVignette}
        onComplete={sync.clearScreenVignette}
      />

      {/* Spy Swap Dramatic Notification Overlay (Victim warning + Caster confirmation) */}
      <SpySwapNotificationOverlay
        data={sync.spySwapAlert}
        onDismiss={sync.dismissSpySwapAlert}
      />

      {/* Double Damage Target Lock Notification Overlay (Victim warning + Caster confirmation) */}
      <TargetLockNotificationOverlay
        data={sync.targetLockAlert}
        onDismiss={sync.dismissTargetLockAlert}
      />

      <div className="gameplay-body relative z-10 flex min-h-0 flex-1">
      <div className="gameplay-play-area flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Main: Board */}
      <main className="gameplay-stage relative flex w-full flex-1 min-h-0">
        {/* Board canvas takes full space */}
        <div className="gameplay-world relative min-h-0 min-w-0 flex-1">
          {/* Top Overlays Stack: Toasts & Hint Suggestions (stacked vertically, never overlapping) */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex w-full max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2.5 sm:top-4">
            {cards.hintSuggestions.length > 0 && (
              <HintSuggestionsOverlay
                suggestions={cards.hintSuggestions}
                activeIndex={cards.activeHintIndex}
                onSelectIndex={handleSelectHint}
                onDismiss={cards.clearHints}
              />
            )}
            <ToastStack
              info={toasts.info}
              error={toasts.error}
              onDismissInfo={toasts.dismissInfo}
              onDismissError={toasts.dismissError}
              inline
            />
          </div>
          <div className="absolute inset-0 z-10">
            <BoardCanvas
              containerRef={boardRef}
              onRegisterHoverHandler={(handler) => {
                hoverHandlerRef.current = handler;
              }}
              boardState={boardState}
              temporaryTiles={
                isBotTurn
                  ? (botStagedTiles.length > 0 ? botStagedTiles : (sync.remoteBotTiles?.length ? sync.remoteBotTiles : temporaryTiles))
                  : temporaryTiles
              }
              remotePlacements={
                isBotTurn
                  ? (botStagedTiles.length === 0 && (!sync.remoteBotTiles || sync.remoteBotTiles.length === 0)
                      ? (sync.remotePlacements ?? EMPTY_CELL_POSITIONS)
                      : EMPTY_CELL_POSITIONS)
                  : (sync.remotePlacements ?? EMPTY_CELL_POSITIONS)
              }
              temporaryTilesValid={isBotTurn ? true : validationState}
              selectedCell={staged.selectedCell}
              onCellClick={handleCellClick}
              onStartPendingDrag={startPendingDrag}
              onFinishPendingDrag={finishDrag}
              onCollectPendingTile={handleCollectPendingTile}
              onPendingDragMove={updateDragHover}
              dragPreviewCell={null}
              draggingTileId={dragSession?.tile.id ?? null}
              dragPreviewTile={null}
              dragPreviewIsValid={null}
              canStageMove={canStageMove}
              camera={camera}
              frozenTile={gameState.frozen_tile}
              hintCell={cards.hintCell}
              hintTiles={cards.activeHintTiles}
              pendingArmedCell={cards.pendingArmedCell ?? deferredFreezeCell}
              pendingArmedCard={cards.armedCard ?? (cards.deferredFreezeTileId ? 'FREEZE_TILE' : null)}
              pendingFrozenCells={cards.pendingFrozenCells}
            />
            {/* Cinematic Board Burst & Particle Blast Effects (Freeze shockwave & Destroy incineration) */}
            <BoardEffectsLayer
              camera={camera}
              effects={sync.boardCellEffects}
              onEffectEnd={sync.removeBoardCellEffect}
            />
            {dragSession && (
              <FloatingTile
                ref={dragGhostRef}
                letter={isBlankLetter(dragSession.tile.letter) ? staged.designatedBlankLetters[dragSession.tile.id] ?? dragSession.tile.letter : dragSession.tile.letter}
                value={dragSession.tile.value}
                position={dragSession.start}
                isDesignatedBlank={isBlankLetter(dragSession.tile.letter) && Boolean(staged.designatedBlankLetters[dragSession.tile.id])}
              />
            )}
          </div>
        </div>

      </main>

      <footer className="gameplay-control-stage absolute bottom-0 left-0 right-0 z-20 flex w-full justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 sm:px-5 sm:pb-4 pointer-events-none">
        <div className="gameplay-control-content w-full min-w-0 pointer-events-auto">
          {isSpectator ? (
            <div className="relative mx-auto flex max-w-lg items-center justify-between gap-2.5 sm:gap-3 rounded-full sm:rounded-xl border border-sky-400/30 bg-[#061020]/60 px-3.5 sm:px-4 py-2 text-center text-xs text-sky-200 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(14,165,233,0.15)] ring-1 ring-sky-400/20 select-none overflow-hidden backdrop-blur-md">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 font-black text-[11px] uppercase tracking-wider whitespace-nowrap shrink-0">
                  <Eye className="w-3.5 h-3.5 text-sky-300 animate-pulse" />
                  <span>Spectating</span>
                </div>
                <span className="text-[11.5px] sm:text-xs text-slate-300 font-medium truncate">
                  Observing match. Players&apos; racks stay hidden.
                </span>
              </div>
            </div>
          ) : isEliminated ? (
            <div className="relative mx-auto flex max-w-xl items-center justify-between gap-2.5 sm:gap-3 rounded-full sm:rounded-xl border border-rose-500/35 bg-[#140612]/65 px-3.5 sm:px-4 py-2 text-xs text-rose-200 shadow-[0_4px_20px_rgba(0,0,0,0.6),0_0_15px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/20 select-none overflow-hidden backdrop-blur-md">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 font-black text-[11px] uppercase tracking-wider whitespace-nowrap shrink-0">
                  <Skull className="w-3.5 h-3.5 text-rose-300 drop-shadow-[0_0_6px_#fb7185]" />
                  <span>Knocked Out</span>
                </div>
                <span className="text-[11.5px] sm:text-xs text-slate-300 font-medium truncate">
                  Your HP reached 0. Spectating remaining players.
                </span>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-500/30 text-[10px] font-bold text-rose-300/90 tracking-wider uppercase whitespace-nowrap shrink-0">
                <Eye className="w-3 h-3 text-rose-400 animate-pulse" />
                <span>Spectator</span>
              </div>
            </div>
          ) : (
            <TileRack
              slots={rackSlots}
              selectedTileId={staged.selectedTileId}
              designatedBlankLetters={staged.designatedBlankLetters}
              exchangeTileIds={exchangeTileIds}
              tileBagCount={tileBagCount}
              powerCardSlot={
                <PowerCardBar
                  cards={myPlayer?.cards ?? []}
                  opponents={opponents}
                  ownRack={myRack}
                  isMyTurn={isMyTurn}
                  hasStagedMove={temporaryTiles.length > 0}
                  armedCard={cards.armedCard}
                  pendingArmedCell={cards.pendingArmedCell}
                  pendingFrozenCells={cards.pendingFrozenCells}
                  deferredFreezeTileId={cards.deferredFreezeTileId}
                  myScore={myPlayer?.score ?? 0}
                  busy={cards.busy}
                  onUseSimple={cards.playSimpleCard}
                  onUseTargeted={cards.playTargetedCard}
                  onUseSpySwap={cards.playSpySwap}
                  onArmBoardCard={cards.armBoardCard}
                  onCancelArm={cards.cancelArm}
                  onConfirmArmedCell={cards.confirmArmedCardAt}
                  onCancelArmedCell={cards.cancelPendingArmedCell}
                  onCancelDeferredFreeze={cards.cancelDeferredFreeze}
                />
              }
              onSelectTile={handleSelectTile}
              onCancelMove={clearStagedMove}
              onConfirmMove={handleConfirmMove}
              onPassTurn={handlePassTurn}
              onShuffleRack={handleShuffleRack}
              onStartExchange={handleStartExchange}
              onCancelExchange={handleCancelExchange}
              onConfirmExchange={handleConfirmExchange}
              onSwapSlots={swapSeats}
              onStartTileDrag={startRackDrag}
              onFinishTileDrag={finishDrag}
              onCancelTileDrag={cancelDrag}
              rackRef={rackRef}
              isExternalDragActive={dragSession?.source === 'board'}
              isMyTurn={isMyTurn}
              canStageMove={canStageMove}
              hasTemporaryTiles={temporaryTiles.length > 0}
              stagedTileCount={temporaryTiles.length}
              placementValid={validationState}
              isSubmitting={isSubmitting}
              estimatedScore={staged.estimatedScore}
              isBingoBonus={temporaryTiles.length >= 7}
            />
          )}
        </div>
      </footer>
      </div>
      <div className="gameplay-match-hud hidden lg:block">
        <RightSidebar
          players={gameState.players ?? []}
          showHealth={gameState.max_turns === null}
          myPlayerId={myPlayerId}
          currentPlayerId={gameState.current_player_id ?? null}
          tileBagCount={tileBagCount}
          tileBagCounts={gameState.tile_bag_counts ?? {}}
          moveHistory={sync.moveHistory}
          cardUseEffects={sync.cardUseEffects}
          pendingDoubleTargetId={gameState.pending_double_target_id}
        />
      </div>
      </div>

      {/* Match details must sit outside the clipped board and sidebar frame. */}
      <MobileInfoModal
        isOpen={isMobileInfoOpen}
        onClose={() => setIsMobileInfoOpen(false)}
        turnNumber={gameState.turn_number}
        players={gameState.players ?? []}
        showHealth={gameState.max_turns === null}
        myPlayerId={myPlayerId}
        currentPlayerId={gameState.current_player_id ?? null}
        tileBagCount={tileBagCount}
        tileBagCounts={gameState.tile_bag_counts ?? {}}
        moveHistory={sync.moveHistory}
        cardUseEffects={sync.cardUseEffects}
        pendingDoubleTargetId={gameState.pending_double_target_id}
      />

      {/* Wildcard Blank Tile Letter Picker Modal */}
      <BlankTilePickerModal
        isOpen={staged.blankPickerTarget !== null}
        onSelect={staged.chooseBlankLetter}
        onClose={staged.closeBlankPicker}
      />

      {/* In-Game Themed Exit Confirmation Modal */}
      <ConfirmExitModal
        isOpen={isExitModalOpen}
        isSpectator={isSpectator}
        isLeaving={isLeaving}
        onConfirm={handleConfirmExit}
        onClose={() => setIsExitModalOpen(false)}
      />

      {/* Game Guide Modal */}
      {isGuideOpen && <GameGuideModal
        isOpen
        onClose={() => setIsGuideOpen(false)}
      />}

      {/* Grimoire Word Guide Modal */}
      <GrimoireModal
        isOpen={isGrimoireOpen}
        onClose={() => setIsGrimoireOpen(false)}
        gameId={gameId}
        sessionToken={session?.token}
        playerId={myPlayerId ?? undefined}
        isGrimoireEnabled={Boolean(gameState.enable_grimoire)}
        turnNumber={gameState.turn_number ?? 1}
      />

      {isDebug && (
        <DebugPanel
          gameId={gameId}
          players={gameState.players ?? []}
          sessions={debugSessions}
          activePlayerId={myPlayerId}
          isOpen={isDebugOpen}
          onClose={() => setIsDebugOpen(false)}
          onSwitchPlayer={switchSession}
          onGameState={sync.setGameState}
        />
      )}
    </div>
  );
}
