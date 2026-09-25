'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { commitMove, exchangeTiles, expireTurn, leaveGame, passTurn } from '@/lib/api';
import { buildRackSlots } from '@/lib/rack';
import { GameState, Tile } from '@/lib/types';
import { isBlankLetter } from '@/lib/tiles';
import { BUTTON_ZOOM_FACTOR, useBoardCamera } from '@/hooks/useBoardCamera';
import { useGameSession } from '@/hooks/useGameSession';
import { useGameSync } from '@/hooks/useGameSync';
import { useGameToasts } from '@/hooks/useGameToasts';
import { usePowerCards } from '@/hooks/usePowerCards';
import { useRackOrder } from '@/hooks/useRackOrder';
import { useStagedMove } from '@/hooks/useStagedMove';
import { useTileDrag } from '@/hooks/useTileDrag';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { BoardControls } from '@/components/board/BoardControls';
import { TileRack } from '@/components/rack/TileRack';
import { FloatingTile } from '@/components/rack/FloatingTile';
import ParticleField from '@/components/effects/ParticleField';
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

  const handleZoomIn = useCallback(() => camera.zoomAtCenter(BUTTON_ZOOM_FACTOR), [camera]);
  const handleZoomOut = useCallback(() => camera.zoomAtCenter(1 / BUTTON_ZOOM_FACTOR), [camera]);
  // Centres on the board's own area (not the window), so Reset matches the initial view.
  const handleResetView = useCallback(() => camera.resetCamera(), [camera]);

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

  // Keep the pre-hydration and pre-fetch output empty on both server and client.
  // The game UI is rendered only after the browser session and game snapshot exist.
  if (!hydrated || !session || sync.loading || !gameState) return null;

  if (gameState.status === 'FINISHED') {
    return <GameOverScreen gameState={gameState} myPlayerId={myPlayerId} onHome={() => router.push('/')} />;
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
        background: 'radial-gradient(circle at 50% 18%, rgba(99, 102, 241, 0.16), transparent 30%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #171942 100%)',
      }}
    >
      <ParticleField className="pointer-events-none fixed inset-0 z-0 h-full w-full" />
      <GameHud
        isSpectator={isSpectator}
        isConnected={sync.isConnected}
        roomPin={gameState.game_pin ?? session.gamePin ?? null}
        spectatorCount={gameState.spectator_count ?? 0}
        isMyTurn={isMyTurn}
        currentPlayer={currentPlayer}
        turnNumber={gameState.turn_number ?? 1}
        onExit={handleExit}
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
        <div className="flex-1 relative">
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
            {/* Floating board controls on mobile only (desktop has them in the RightSidebar) */}
            <div className="lg:hidden">
              <BoardControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleResetView}
                camera={camera}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar: Unified Glassmorphism Control & Scoreboard Panel (desktop) */}
        <div className="hidden lg:flex flex-col shrink-0">
          <RightSidebar
            players={gameState.players ?? []}
            myPlayerId={myPlayerId}
            currentPlayerId={gameState.current_player_id ?? null}
            tileBagCount={tileBagCount}
            tileBagCounts={gameState.tile_bag_counts ?? {}}
            moveHistory={sync.moveHistory}
            cardUseEffects={sync.cardUseEffects}
            camera={camera}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleResetView}
          />
        </div>
      </div>

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
                isMyTurn={isMyTurn}
                hasStagedMove={temporaryTiles.length > 0}
                armedCard={cards.armedCard}
                busy={cards.busy}
                onUseSimple={cards.playSimpleCard}
                onUseTargeted={cards.playTargetedCard}
                onUseBanLetter={cards.playBanLetter}
                onArmBoardCard={cards.armBoardCard}
                onCancelArm={cards.cancelArm}
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
