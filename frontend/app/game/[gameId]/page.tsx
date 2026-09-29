'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { commitMove, exchangeTiles, expireTurn, leaveGame, passTurn, rematchGame, sessionStore } from '@/lib/api';
import { buildRackSlots } from '@/lib/rack';
import { GameState, Tile } from '@/lib/types';
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
import { BlankTilePickerModal } from '@/components/game/BlankTilePickerModal';
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
  const { gameState, reload } = sync;

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

  const cards = usePowerCards({ gameId, myPlayerId, boardState, reload, toasts });
  const { armedCard, playArmedCardAt } = cards;
  const { handleCellClick: placeAtCell, unstageTile, selectTile, clearSelection, clearStagedMove } = staged;
  const { validationState, validationReason } = staged;
  const { flashError, setError } = toasts;

  /** The board viewport and the rack tray; drags that end over them are hit-tested against these. */
  const boardRef = useRef<HTMLDivElement>(null);
  const rackRef = useRef<HTMLDivElement>(null);
  /** Tiles picked to swap with the bag; `null` while the player is not exchanging. */
  const [exchangeTileIds, setExchangeTileIds] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);

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
    }
    turnKeyRef.current = nextTurnKey;
  }, [clearRemotePlacements, gameState, handleTurnChange]);

  const handleTimeUp = useCallback(() => expireTurn(gameId).then(() => reload()), [gameId, reload]);

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
      reload();
    } catch (error: unknown) {
      flashError(error instanceof Error ? error.message : 'Failed to exchange tiles');
    } finally {
      setIsSubmitting(false);
    }
  }, [exchangeTileIds, flashError, gameId, myPlayerId, reload]);

  const handleConfirmMove = useCallback(async () => {
    if (!myPlayerId || temporaryTiles.length === 0) return;
    if (validationState !== true) {
      setError(validationState === null
        ? 'Still checking the word, try again in a moment'
        : validationReason || 'Fix the invalid word before confirming');
      return;
    }
    setIsSubmitting(true);
    try {
      await commitMove(gameId, myPlayerId, temporaryTiles);
      clearStagedMove();
      reload();
    } catch (error: unknown) {
      flashError(error instanceof Error ? error.message : 'Failed to commit move');
    } finally {
      setIsSubmitting(false);
    }
  }, [clearStagedMove, flashError, gameId, myPlayerId, reload, setError, temporaryTiles, validationReason, validationState]);

  const handlePassTurn = useCallback(async () => {
    if (!myPlayerId) return;
    setIsSubmitting(true);
    try {
      await passTurn(gameId, myPlayerId);
      reload();
    } catch (error: unknown) {
      flashError(error instanceof Error ? error.message : 'Failed to pass turn');
    } finally {
      setIsSubmitting(false);
    }
  }, [flashError, gameId, myPlayerId, reload]);

  // The game UI needs the browser session and a game snapshot first. This loading view reads no
  // client-only state, so the server and the client's first paint render it identically (no
  // hydration mismatch) while the session/state fetch that used to show a blank screen resolves.
  if (!hydrated || !session || sync.loading || !gameState) {
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

  const tileBagCount = gameState.tile_bag_count ?? 0;
  const currentPlayer = gameState.players.find(p => p.id === gameState.current_player_id);

  const handleExit = () => {
    if (isSpectator) {
      router.push('/');
      return;
    }
    if (window.confirm('ต้องการออกจากเกมหรือไม่?')) {
      void leaveGame(gameId, myPlayerId ?? '').finally(() => router.push('/'));
    }
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
        isConnected={sync.isConnected}
        roomPin={gameState.game_pin ?? session.gamePin ?? null}
        spectatorCount={gameState.spectator_count ?? 0}
        isMyTurn={isMyTurn}
        currentPlayer={currentPlayer}
        turnNumber={gameState.turn_number ?? 1}
        maxTurns={gameState.max_turns}
        onExit={handleExit}
        onOpenInfo={() => setIsMobileInfoOpen(true)}
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
          <ToastStack info={toasts.info} error={toasts.error} />
          <div className="absolute inset-0 z-10">
            <BoardCanvas
              containerRef={boardRef}
              boardState={boardState}
              temporaryTiles={temporaryTiles}
              remotePlacements={sync.remotePlacements}
              temporaryTilesValid={validationState}
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
              pendingArmedCell={cards.pendingArmedCell}
            />
            <div className="pointer-events-none absolute left-2 right-16 top-2 z-20 lg:hidden">
              <div
                aria-label="Live scoreboard"
                className="pointer-events-auto flex max-w-full items-center gap-3 overflow-x-auto touch-pan-x rounded-lg border border-slate-700/80 bg-slate-950/90 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur-sm scroll-smooth"
              >
                <div className="flex shrink-0 items-center gap-1.5 border-r border-slate-700/80 pr-2.5">
                  <span className="font-bold text-sky-400">T{gameState.turn_number}</span>
                  <span className="font-mono text-slate-400">{tileBagCount} left</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {[...(gameState.players ?? [])].sort((a, b) => b.score - a.score).map(player => {
                    const isCurrent = player.id === gameState.current_player_id;
                    return (
                      <span key={player.id} title={player.display_name} className="flex shrink-0 items-center gap-1">
                        <span className={`max-w-[75px] truncate ${isCurrent ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
                          {player.display_name}
                        </span>
                        <strong className="font-mono text-emerald-400">{player.score}</strong>
                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8] ml-0.5 animate-pulse" />}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
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

      {isMobileInfoOpen && (
        <div
          className="fixed inset-x-2 top-14 z-40 flex min-h-0 flex-col gap-1 [@media(min-height:640px)]:top-20 bottom-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
          onClick={() => setIsMobileInfoOpen(false)}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsMobileInfoOpen(false)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
              aria-label="Close game information"
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1" onClick={event => event.stopPropagation()}>
            <RightSidebar
              mobile
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
      )}

      {/* Bottom: Tile rack (spectators have no seat and never see a rack) */}
      <div className="relative z-10 shrink-0 px-1.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1.5 sm:p-3">
        {isSpectator ? (
          <p className="py-3 text-center text-sm text-sky-300">
            👁 You are watching this game. Players&apos; tiles stay hidden.
          </p>
        ) : (
          <>
            <div className="mb-1 sm:mb-2">
              <PowerCardBar
                cards={myPlayer?.cards ?? []}
                opponents={opponents}
                ownRack={myRack}
                isMyTurn={isMyTurn}
                hasStagedMove={temporaryTiles.length > 0}
                armedCard={cards.armedCard}
                pendingArmedCell={cards.pendingArmedCell}
                busy={cards.busy}
                onUseSimple={cards.playSimpleCard}
                onUseTargeted={cards.playTargetedCard}
                onUseSpySwap={cards.playSpySwap}
                onUseBanLetter={cards.playBanLetter}
                onArmBoardCard={cards.armBoardCard}
                onCancelArm={cards.cancelArm}
                onConfirmArmedCell={cards.confirmArmedCardAt}
                onCancelArmedCell={cards.cancelPendingArmedCell}
              />
            </div>
            <TileRack
              slots={rackSlots}
              selectedTileId={staged.selectedTileId}
              designatedBlankLetters={staged.designatedBlankLetters}
              exchangeTileIds={exchangeTileIds}
              tileBagCount={tileBagCount}
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
            />
          </>
        )}
      </div>

      {/* Wildcard Blank Tile Letter Picker Modal */}
      <BlankTilePickerModal
        isOpen={staged.blankPickerTarget !== null}
        onSelect={staged.chooseBlankLetter}
        onClose={staged.closeBlankPicker}
      />

      {isDebug && (
        <DebugPanel
          gameId={gameId}
          players={gameState.players ?? []}
          sessions={debugSessions}
          activePlayerId={myPlayerId}
          onSwitchPlayer={switchSession}
          onGameState={sync.setGameState}
        />
      )}
    </div>
  );
}
