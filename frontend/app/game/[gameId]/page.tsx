'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Bug, Eye } from 'lucide-react';
import { commitMove, exchangeTiles, executeBotMove, expireTurn, getBotPlan, leaveGame, passTurn, rematchGame, sessionStore } from '@/lib/api';
import { buildRackSlots } from '@/lib/rack';
import { GameState, Tile, Player, PlacedTile } from '@/lib/types';
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
import { CardRevealOverlay, PendingEffectBanner, ToastStack } from '@/components/game/GameOverlays';
import { HintSuggestionsOverlay } from '@/components/game/HintSuggestionsOverlay';
import { BlankTilePickerModal } from '@/components/game/BlankTilePickerModal';
import { ConfirmExitModal } from '@/components/game/ConfirmExitModal';
import { MobileInfoModal } from '@/components/game/MobileInfoModal';
import BackgroundMusic from '@/components/audio/BackgroundMusic';
import { GameGuideModal } from '@/components/game/GameGuideModal';
import { DebugPanel } from '@/components/debug/DebugPanel';

const EMPTY_TILES: Tile[] = [];

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
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const seatReturningTile = useCallback((tileId: string, targetSlot: number) => {
    seatReturning(tileId, targetSlot, pendingTileIds);
  }, [pendingTileIds, seatReturning]);

  const {
    dragSession,
    dragHoverCell,
    dragHoverIsValid,
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
      setBotStagedTiles([]);
    }
    turnKeyRef.current = nextTurnKey;
  }, [cards, clearRemotePlacements, gameState, handleTurnChange]);

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
    if (validationState !== true) {
      setError(validationState === null
        ? 'Still checking the word, try again in a moment'
        : validationReason || 'Fix the invalid word before confirming');
      return;
    }
    const tilesToCommit = [...temporaryTiles];
    setIsSubmitting(true);
    try {
      const freezeTileId = cards.deferredFreezeTileId ?? undefined;
      const wasBingo = tilesToCommit.length >= 7;
      await commitMove(gameId, myPlayerId, tilesToCommit, freezeTileId);
      if (wasBingo) {
        toasts.flashInfo('🎉 BINGO! All 7 tiles placed (+50 Bonus Points)!');
      }

      // Optimistically bake placed tiles directly into board_state and remove them from rack
      // BEFORE clearing staged move so tiles never vanish from the board for even a fraction of a second!
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
            if (p.id === myPlayerId && p.rack) {
              return {
                ...p,
                rack: p.rack.filter(tile => !committedTileIds.has(tile.id)),
              };
            }
            return p;
          }),
        };
      });

      clearStagedMove();
      cards.clearHints();
      reload();
    } catch (error: unknown) {
      flashError(error instanceof Error ? error.message : 'Failed to commit move');
    } finally {
      setIsSubmitting(false);
    }
  }, [cards, clearStagedMove, flashError, gameId, myPlayerId, reload, setError, setGameState, temporaryTiles, toasts, validationReason, validationState]);

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
  const isBotTurn = Boolean(
    currentTurnPlayer &&
    (currentTurnPlayer.display_name.toLowerCase().includes('bot') ||
     currentTurnPlayer.display_name.toLowerCase().includes('[ai]'))
  );

  const botDifficulty = useMemo<'easy' | 'medium' | 'hard'>(() => {
    const name = currentTurnPlayer?.display_name?.toLowerCase() || '';
    if (name.includes('hard') || name.includes('titan')) return 'hard';
    if (name.includes('medium') || name.includes('nexus')) return 'medium';
    return 'easy';
  }, [currentTurnPlayer?.display_name]);

  const isHostDriver = Boolean(
    session?.isHost ||
    (gameState?.players && gameState.players.find(p => !p.display_name.toLowerCase().includes('bot') && !p.display_name.toLowerCase().includes('[ai]'))?.id === myPlayerId)
  );

  const activeBotTurnKeyRef = useRef<string | null>(null);
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
    if (lastCompletedBotTurnRef.current === turnKey || activeBotTurnKeyRef.current === turnKey) return;

    activeBotTurnKeyRef.current = turnKey;

    const runBotTurn = async () => {
      try {
        // 1. Natural thinking time calibrated by difficulty
        const thinkingMs = botDifficulty === 'hard' ? 900 : botDifficulty === 'medium' ? 1200 : 1500;
        await new Promise(r => setTimeout(r, thinkingMs));
        if (activeBotTurnKeyRef.current !== turnKey) return;

        // 2. Fetch dictionary-valid move planned on the backend
        const plan = await getBotPlan(gameId, botDifficulty);
        if (activeBotTurnKeyRef.current !== turnKey) return;

        const planTiles = plan.tiles ?? [];
        if (plan.action === 'MOVE' && planTiles.length > 0) {
          // Place tiles step-by-step (one by one) with visual feedback (sound effects disabled)
          const stepDelay = botDifficulty === 'hard' ? 280 : botDifficulty === 'medium' ? 350 : 450;
          const stagedList: PlacedTile[] = [];

          for (const tile of planTiles) {
            if (activeBotTurnKeyRef.current !== turnKey) return;
            stagedList.push(tile);
            setBotStagedTiles([...stagedList]);

            // Broadcast staging to other players / spectators
            sendMessageRef.current?.({
              type: 'STAGING_CHANGE',
              placements: stagedList.map(t => ({ row: t.row, col: t.col })),
            });

            await new Promise(r => setTimeout(r, stepDelay));
          }

          if (activeBotTurnKeyRef.current !== turnKey) return;

          // Short suspense delay before committing word
          await new Promise(r => setTimeout(r, 450));
          if (activeBotTurnKeyRef.current !== turnKey) return;

          await executeBotMove(gameId, plan);
          lastCompletedBotTurnRef.current = turnKey;
        } else {
          // Exchange tiles or pass
          await new Promise(r => setTimeout(r, 400));
          if (activeBotTurnKeyRef.current !== turnKey) return;
          await executeBotMove(gameId, plan);
          lastCompletedBotTurnRef.current = turnKey;
        }

        setBotStagedTiles([]);
        reloadRef.current?.();
      } catch (err) {
        console.error('Bot turn execution error, attempting 1 retry:', err);
        try {
          if (activeBotTurnKeyRef.current === turnKey && gameState.current_player_id) {
            await new Promise(r => setTimeout(r, 800));
            if (activeBotTurnKeyRef.current === turnKey) {
              const retryPlan = await getBotPlan(gameId, botDifficulty);
              if (activeBotTurnKeyRef.current === turnKey) {
                await executeBotMove(gameId, retryPlan);
                lastCompletedBotTurnRef.current = turnKey;
                reloadRef.current?.();
                return;
              }
            }
          }
        } catch (retryErr) {
          console.error('Bot retry error:', retryErr);
        }

        try {
          if (activeBotTurnKeyRef.current === turnKey && gameState.current_player_id) {
            await passTurn(gameId, gameState.current_player_id);
            lastCompletedBotTurnRef.current = turnKey;
            reloadRef.current?.();
          }
        } catch (passErr) {
          console.error('Bot fallback pass error:', passErr);
        }
      } finally {
        if (activeBotTurnKeyRef.current === turnKey) {
          activeBotTurnKeyRef.current = null;
        }
        setBotStagedTiles([]);
      }
    };

    void runBotTurn();
  }, [
    botDifficulty,
    currentTurnPlayer?.id,
    gameId,
    gameState?.current_player_id,
    gameState?.status,
    gameState?.turn_number,
    isBotTurn,
    isHostDriver,
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
      className="relative flex h-[100dvh] min-h-[100dvh] w-screen flex-col overflow-hidden"
      style={{
        ...TILE_THEME_STYLE,
        background: 'radial-gradient(circle at 50% 18%, rgba(99, 102, 241, 0.16), transparent 30%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #171942 100%)',
      }}
    >
      <GameHud
        isSpectator={isSpectator}
        isEliminated={isEliminated}
        isConnected={sync.isConnected}
        roomPin={gameState.game_pin ?? session.gamePin ?? null}
        spectatorCount={gameState.spectator_count ?? 0}
        isMyTurn={isMyTurn}
        currentPlayer={currentPlayer}
        nextPlayer={nextPlayer}
        turnNumber={gameState.turn_number ?? 1}
        maxTurns={gameState.max_turns}
        onExit={handleExit}
        onOpenInfo={() => setIsMobileInfoOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
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

      {sync.cardReveal && <CardRevealOverlay reveal={sync.cardReveal} />}

      {/* Main: Board */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* Board canvas takes full space */}
        <div className="relative min-w-0 flex-1">
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
            <ToastStack info={toasts.info} error={toasts.error} inline />
          </div>
          <div className="absolute inset-0 z-10">
            <BoardCanvas
              containerRef={boardRef}
              boardState={boardState}
              temporaryTiles={isBotTurn && botStagedTiles.length > 0 ? botStagedTiles : temporaryTiles}
              remotePlacements={isBotTurn && botStagedTiles.length > 0 ? botStagedTiles.map(t => ({ row: t.row, col: t.col })) : sync.remotePlacements}
              temporaryTilesValid={isBotTurn && botStagedTiles.length > 0 ? true : validationState}
              selectedCell={staged.selectedCell}
              onCellClick={handleCellClick}
              onStartPendingDrag={startPendingDrag}
              onFinishPendingDrag={finishDrag}
              onCollectPendingTile={handleCollectPendingTile}
              onPendingDragMove={updateDragHover}
              dragPreviewCell={dragHoverCell}
              draggingTileId={dragSession?.tile.id ?? null}
              dragPreviewTile={dragSession?.tile ?? null}
              dragPreviewIsValid={dragHoverIsValid}
              canStageMove={canStageMove}
              camera={camera}
              frozenTile={gameState.frozen_tile}
              hintCell={cards.hintCell}
              hintTiles={cards.activeHintTiles}
              pendingArmedCell={cards.pendingArmedCell ?? deferredFreezeCell}
              pendingArmedCard={cards.armedCard ?? (cards.deferredFreezeTileId ? 'FREEZE_TILE' : null)}
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

        {/* Right sidebar: Unified Glassmorphism Control & Scoreboard Panel (desktop) */}
        <div className="hidden lg:flex flex-col shrink-0">
          <RightSidebar
            players={gameState.players ?? []}
            showHealth={gameState.max_turns === null}
            myPlayerId={myPlayerId}
            currentPlayerId={gameState.current_player_id ?? null}
            tileBagCount={tileBagCount}
            tileBagCounts={gameState.tile_bag_counts ?? {}}
            moveHistory={sync.moveHistory}
            cardUseEffects={sync.cardUseEffects}
          />
        </div>
      </div>

      {/* Mobile Info, Scoreboard & History Sheet Modal */}
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
      />

      {/* Bottom: Tile rack (spectators and eliminated players have no active rack) */}
      <div className="relative z-10 shrink-0 px-1.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1.5 sm:p-3">
        {isSpectator ? (
          <div className="flex items-center justify-center gap-2 py-2.5 px-4 text-center text-xs sm:text-sm text-sky-300 bg-sky-950/40 border border-sky-500/25 rounded-xl shadow-[0_0_12px_rgba(56,189,248,0.1)] ring-1 ring-sky-400/15 max-w-md mx-auto select-none">
            <Eye className="h-4 w-4 text-sky-400 drop-shadow-[0_0_4px_#38bdf8] shrink-0" />
            <span>You are watching this game. Players&apos; tiles stay hidden.</span>
          </div>
        ) : isEliminated ? (
          <div className="flex flex-col items-center justify-center py-3.5 px-4 sm:px-6 rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-950/85 via-slate-900/90 to-rose-950/85 text-center shadow-[0_0_24px_rgba(244,63,94,0.25)] ring-1 ring-rose-500/30 max-w-lg mx-auto">
            <div className="flex items-center gap-2 text-rose-300 font-black text-sm sm:text-base tracking-wide uppercase">
              <span className="text-xl">☠️</span>
              <span>You Have Been Knocked Out</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Your HP reached 0. You are now spectating the remaining players in the room.
            </p>
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
                deferredFreezeTileId={cards.deferredFreezeTileId}
                busy={cards.busy}
                onUseSimple={cards.playSimpleCard}
                onUseTargeted={cards.playTargetedCard}
                onUseSpySwap={cards.playSpySwap}
                onUseBanLetter={cards.playBanLetter}
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
              placementValid={validationState}
              isSubmitting={isSubmitting}
              estimatedScore={staged.estimatedScore}
              isBingoBonus={temporaryTiles.length >= 7}
            />
        )}
      </div>

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
      <GameGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
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
