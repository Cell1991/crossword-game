'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import React, { startTransition, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { sessionStore, debugSessionStore, getGameState, validateMove, commitMove, passTurn, exchangeTiles, expireTurn, leaveGame, playCard, resolvePendingEffect, UseCardPayload, StoredSession } from '../../../lib/api';
import { useGameSocket } from '../../../hooks/useGameSocket';
import { BUTTON_ZOOM_FACTOR, useBoardCamera } from '../../../hooks/useBoardCamera';
import { BoardCanvas } from '../../../components/board/BoardCanvas';
import { BoardControls } from '../../../components/board/BoardControls';
import { TileRack } from '../../../components/rack/TileRack';
import { TurnBanner } from '../../../components/game/TurnBanner';
import ParticleField from '../../../components/effects/ParticleField';
import { RightSidebar, MoveHistoryEntry } from '../../../components/game/RightSidebar';
import { PowerCardBar } from '../../../components/game/PowerCardBar';
import { DebugPanel } from '../../../components/debug/DebugPanel';
import {
  GameState,
  Tile,
  PlacedTile,
  WebSocketEvent,
} from '../../../lib/types';

const EMPTY_TILES: Tile[] = [];

/** Seats on the rack stand. The rack always shows this many, even when the bag runs dry. */
const RACK_SIZE = 7;

/** How long to wait before asking the server again whether a turn that reads 0s has expired. */
const TIMEOUT_RETRY_MS = 2000;

interface DragSession {
  tile: Tile;
  source: 'rack' | 'board';
  origin: { row: number; col: number } | null;
  position: { x: number; y: number };
}

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.gameId as string;
  const isDebug = searchParams.get('debug') === '1';

  // Session
  const [session, setSession] = useState<StoredSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [debugSessions, setDebugSessions] = useState<StoredSession[]>([]);

  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tile interaction
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [temporaryTiles, setTemporaryTiles] = useState<PlacedTile[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [estimatedScore, setEstimatedScore] = useState<number>(0);
  const [validationState, setValidationState] = useState<boolean | null>(null);
  const [validationReason, setValidationReason] = useState('');
  const [remotePlacements, setRemotePlacements] = useState<{ row: number; col: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastMoveInfo, setLastMoveInfo] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
  const [rackOrder, setRackOrder] = useState<(string | null)[]>([]);
  /** Tiles picked to swap with the bag; `null` while the player is not exchanging. */
  const [exchangeTileIds, setExchangeTileIds] = useState<string[] | null>(null);
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [dragHoverCell, setDragHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [boardViewport, setBoardViewport] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [rackViewport, setRackViewport] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [timerNow, setTimerNow] = useState(() => Date.now());
  /** Server clock minus this device's clock. The timer runs on server time so every device agrees. */
  const clockOffsetRef = useRef(0);
  const timeoutRequestRef = useRef<{ turnNumber: number; at: number } | null>(null);
  const validationRequestRef = useRef(0);
  const turnKeyRef = useRef<string | null>(null);

  // Power cards
  const [armedCard, setArmedCard] = useState<'FREEZE_TILE' | 'DESTROY_TILE' | null>(null);
  const [hintCell, setHintCell] = useState<{ row: number; col: number } | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const resolvedEffectRef = useRef<string | null>(null);

  // Camera
  const camera = useBoardCamera();

  // Derived
  const myPlayerId = session?.playerId ?? null;
  const myToken = session?.token ?? '';
  /** Watching without a seat: no token, no rack, no turns. */
  const isSpectator = Boolean(session?.isSpectator);
  const isMyTurn = gameState?.current_player_id === myPlayerId;
  const myPlayer = gameState?.players.find(p => p.id === myPlayerId);
  const canStageMove = Boolean(myPlayer && myPlayer.hp > 0 && myPlayer.connection_status !== 'OFFLINE');
  const boardState = useMemo(() => gameState?.board_state ?? {}, [gameState?.board_state]);
  const screenToCell = camera.screenToCell;
  const serverRack: Tile[] = myPlayer?.rack ?? EMPTY_TILES;
  const opponents = gameState?.players.filter(p => p.id !== myPlayerId) ?? [];
  const pendingEffect = gameState?.pending_effect ?? null;
  const pendingTargetsMe = Boolean(pendingEffect && myPlayerId && (
    pendingEffect.type === 'DAMAGE'
      ? Boolean(pendingEffect.damage?.[myPlayerId])
      : pendingEffect.target_player_id === myPlayerId
  ));
  const iHaveShield = (myPlayer?.cards ?? []).includes('SHIELD');
  const pendingTileIds = useMemo(
    () => new Set(temporaryTiles.map(tile => tile.tile_id)),
    [temporaryTiles]
  );
  /**
   * The rack as fixed seats. A tile keeps its seat while it sits on the board, so the seat
   * renders as a gap and the neighbouring tiles never slide over to close it. Seats also
   * stay put once the bag runs dry, which is why the count never drops below RACK_SIZE.
   */
  const rackSlots = useMemo<(Tile | null)[]>(() => {
    const tilesById = new Map(serverRack.map(tile => [tile.id, tile]));
    const slotCount = Math.max(RACK_SIZE, rackOrder.length, serverRack.length);
    const hasSeating = rackOrder.some(tileId => tileId && tilesById.has(tileId));
    const slots: (Tile | null)[] = [];
    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const tileId = hasSeating ? rackOrder[slotIndex] : serverRack[slotIndex]?.id;
      const tile = tileId ? tilesById.get(tileId) : undefined;
      slots.push(tile && !pendingTileIds.has(tile.id) ? tile : null);
    }
    return slots;
  }, [pendingTileIds, rackOrder, serverRack]);
  const myRack = useMemo(
    () => rackSlots.filter((tile): tile is Tile => Boolean(tile)),
    [rackSlots]
  );
  const turnStartedAtMs = gameState?.turn_started_at
    ? Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(gameState.turn_started_at)
      ? gameState.turn_started_at
      : `${gameState.turn_started_at}Z`)
    : NaN;
  const secondsRemaining = gameState?.turn_time_limit && Number.isFinite(turnStartedAtMs)
    ? Math.max(0, gameState.turn_time_limit - Math.floor((timerNow - turnStartedAtMs) / 1000))
    : null;

  /** Seats the rack currently knows about, padded so every seat index is addressable. */
  const seatRackOrder = useCallback((previousOrder: (string | null)[], minimumLength = 0) => {
    const length = Math.max(RACK_SIZE, previousOrder.length, minimumLength);
    const nextOrder: (string | null)[] = [];
    for (let slotIndex = 0; slotIndex < length; slotIndex += 1) {
      nextOrder.push(previousOrder[slotIndex] ?? null);
    }
    return nextOrder;
  }, []);

  /** Shuffles the tiles still on the stand. Gaps left by placed tiles keep their seats. */
  const handleShuffleRack = useCallback(() => {
    setRackOrder(previousOrder => {
      const nextOrder = seatRackOrder(previousOrder);
      const seatIndexes: number[] = [];
      const tileIds: string[] = [];
      nextOrder.forEach((tileId, slotIndex) => {
        if (tileId && !pendingTileIds.has(tileId)) {
          seatIndexes.push(slotIndex);
          tileIds.push(tileId);
        }
      });
      if (tileIds.length < 2) return previousOrder;
      for (let index = tileIds.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [tileIds[index], tileIds[randomIndex]] = [tileIds[randomIndex], tileIds[index]];
      }
      seatIndexes.forEach((slotIndex, index) => { nextOrder[slotIndex] = tileIds[index]; });
      return nextOrder;
    });
  }, [pendingTileIds, seatRackOrder]);

  /** Dragging inside the rack always swaps two seats, so a gap follows the tile it traded with. */
  const handleSwapRackSlots = useCallback((fromSlot: number, toSlot: number) => {
    if (fromSlot === toSlot) return;
    setRackOrder(previousOrder => {
      const nextOrder = seatRackOrder(previousOrder, Math.max(fromSlot, toSlot) + 1);
      [nextOrder[fromSlot], nextOrder[toSlot]] = [nextOrder[toSlot], nextOrder[fromSlot]];
      return nextOrder;
    });
  }, [seatRackOrder]);

  /**
   * Seats a tile coming back from the board. It lands on the seat it was dropped on; if that
   * one is taken by a tile still on the stand, it falls back to the nearest free seat.
   */
  const seatReturningTile = useCallback((tileId: string, targetSlot: number) => {
    setRackOrder(previousOrder => {
      const nextOrder = seatRackOrder(previousOrder, targetSlot + 1);
      const fromSlot = nextOrder.indexOf(tileId);
      if (fromSlot < 0) return previousOrder;
      const isFree = (slotIndex: number) => {
        if (slotIndex < 0 || slotIndex >= nextOrder.length) return false;
        const occupant = nextOrder[slotIndex];
        return !occupant || occupant === tileId || pendingTileIds.has(occupant);
      };
      let slot = isFree(targetSlot) ? targetSlot : -1;
      for (let distance = 1; slot < 0 && distance < nextOrder.length; distance += 1) {
        if (isFree(targetSlot - distance)) slot = targetSlot - distance;
        else if (isFree(targetSlot + distance)) slot = targetSlot + distance;
      }
      if (slot < 0 || slot === fromSlot) return previousOrder;
      [nextOrder[fromSlot], nextOrder[slot]] = [nextOrder[slot], nextOrder[fromSlot]];
      return nextOrder;
    });
  }, [pendingTileIds, seatRackOrder]);

  const updateDragHover = useCallback((clientX: number, clientY: number) => {
    setDragSession(previous => previous ? { ...previous, position: { x: clientX, y: clientY } } : previous);
    if (
      clientX < boardViewport.left ||
      clientX > boardViewport.left + boardViewport.width ||
      clientY < boardViewport.top ||
      clientY > boardViewport.top + boardViewport.height
    ) {
      setDragHoverCell(null);
      return;
    }
    setDragHoverCell(screenToCell(clientX - boardViewport.left, clientY - boardViewport.top));
  }, [boardViewport, screenToCell]);

  const finishDrag = useCallback((clientX?: number, clientY?: number) => {
    const session = dragSession;
    const pointerPosition = clientX !== undefined && clientY !== undefined
      ? { x: clientX, y: clientY }
      : session?.position;
    const targetCell = pointerPosition &&
      pointerPosition.x >= boardViewport.left &&
      pointerPosition.x <= boardViewport.left + boardViewport.width &&
      pointerPosition.y >= boardViewport.top &&
      pointerPosition.y <= boardViewport.top + boardViewport.height
      ? screenToCell(pointerPosition.x - boardViewport.left, pointerPosition.y - boardViewport.top)
      : dragHoverCell;
    if (!session || !canStageMove) {
      setDragSession(null);
      setDragHoverCell(null);
      return;
    }
    const { x, y } = pointerPosition ?? session.position;
    const droppedOnRack = x >= rackViewport.left &&
      x <= rackViewport.left + rackViewport.width &&
      y >= rackViewport.top &&
      y <= rackViewport.top + rackViewport.height;
    if (droppedOnRack) {
      if (session.source === 'board') {
        const droppedSeat = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-rack-slot]');
        const targetSlot = droppedSeat ? Number(droppedSeat.dataset.rackSlot) : NaN;
        seatReturningTile(session.tile.id, Number.isInteger(targetSlot) ? targetSlot : 0);
        setTemporaryTiles(previous => previous.filter(tile => tile.tile_id !== session.tile.id));
        setSelectedTileId(null);
        setSelectedCell(null);
      }
      setDragSession(null);
      setDragHoverCell(null);
      return;
    }
    if (!targetCell) {
      setDragSession(null);
      setDragHoverCell(null);
      return;
    }
    const occupiedByCommitted = Object.values(boardState).some(cell =>
      cell.row === targetCell.row && cell.col === targetCell.col
    );
    const occupiedByPending = temporaryTiles.some(tile =>
      tile.row === targetCell.row &&
      tile.col === targetCell.col &&
      !(session.source === 'board' && tile.tile_id === session.tile.id)
    );
    const targetPendingTile = temporaryTiles.find(tile =>
      tile.row === targetCell.row &&
      tile.col === targetCell.col &&
      tile.tile_id !== session.tile.id
    );
    const canSwapPendingTiles = session.source === 'board' &&
      Boolean(session.origin) &&
      Boolean(targetPendingTile) &&
      !occupiedByCommitted;

    if (canSwapPendingTiles && session.origin && targetPendingTile) {
      setTemporaryTiles(previous => previous.map(tile => {
        if (tile.tile_id === session.tile.id) {
          return { ...tile, row: targetPendingTile.row, col: targetPendingTile.col };
        }
        if (tile.tile_id === targetPendingTile.tile_id) {
          return { ...tile, row: session.origin!.row, col: session.origin!.col };
        }
        return tile;
      }));
      setSelectedTileId(null);
      setSelectedCell(targetCell);
    } else if (!occupiedByCommitted && !occupiedByPending) {
      setTemporaryTiles(previous => [
        ...previous.filter(tile => tile.tile_id !== session.tile.id),
        {
          row: targetCell.row,
          col: targetCell.col,
          tile_id: session.tile.id,
          letter: session.tile.letter,
          value: session.tile.value,
        },
      ]);
      setSelectedTileId(null);
      setSelectedCell(targetCell);
    }
    setDragSession(null);
    setDragHoverCell(null);
  }, [boardState, boardViewport, canStageMove, dragHoverCell, dragSession, rackViewport, screenToCell, seatReturningTile, temporaryTiles]);

  const cancelDrag = useCallback(() => {
    setDragSession(null);
    setDragHoverCell(null);
  }, []);

  const dragHoverIsValid = useMemo(() => {
    if (!dragSession || !dragHoverCell) return null;
    const committed = Object.values(boardState).some(cell =>
      cell.row === dragHoverCell.row && cell.col === dragHoverCell.col
    );
    const pending = temporaryTiles.some(tile =>
      tile.row === dragHoverCell.row &&
      tile.col === dragHoverCell.col &&
      !(dragSession.source === 'board' && tile.tile_id === dragSession.tile.id)
    );
    return !committed && (!pending || dragSession.source === 'board');
  }, [boardState, dragHoverCell, dragSession, temporaryTiles]);

  const startRackDrag = useCallback((tile: Tile, clientX: number, clientY: number) => {
    if (!canStageMove) return;
    setSelectedTileId(null);
    setDragSession({ tile, source: 'rack', origin: null, position: { x: clientX, y: clientY } });
    updateDragHover(clientX, clientY);
  }, [canStageMove, updateDragHover]);

  const startPendingDrag = useCallback((tile: PlacedTile, clientX: number, clientY: number) => {
    if (!canStageMove) return;
    setDragSession({
      tile: { id: tile.tile_id, letter: tile.letter, value: tile.value },
      source: 'board',
      origin: { row: tile.row, col: tile.col },
      position: { x: clientX, y: clientY },
    });
    updateDragHover(clientX, clientY);
  }, [canStageMove, updateDragHover]);

  useEffect(() => {
    if (!dragSession) return;
    const handlePointerMove = (event: PointerEvent) => updateDragHover(event.clientX, event.clientY);
    const handlePointerUp = () => finishDrag();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelDrag();
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelDrag, dragSession, finishDrag, updateDragHover]);

  // Load game state
  const loadGameState = useCallback(async () => {
    if (!myToken && !isSpectator) return;
    try {
      const state = await getGameState(gameId, myToken, isDebug);
      const serverNow = Date.parse(state.server_time);
      if (Number.isFinite(serverNow)) clockOffsetRef.current = serverNow - Date.now();
      setGameState(state);
      setTimerNow(Date.now() + clockOffsetRef.current);
      // A sync that arrives before the player id is known carries no rack for us. Reseating from
      // it would blank every seat, so leave the seating alone until we can see our own tiles.
      const myServerPlayer = state.players.find(player => player.id === myPlayerId);
      const serverTileIds = (myServerPlayer?.rack ?? EMPTY_TILES).map(tile => tile.id);
      if (myServerPlayer) setRackOrder(previousOrder => {
        const serverIds = new Set(serverTileIds);
        const slotCount = Math.max(RACK_SIZE, previousOrder.length, serverTileIds.length);
        // Tiles the server no longer knows about (played, stolen, swapped) free their seat.
        const nextOrder: (string | null)[] = [];
        for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
          const tileId = previousOrder[slotIndex] ?? null;
          nextOrder.push(tileId && serverIds.has(tileId) ? tileId : null);
        }
        // Freshly drawn tiles fill the free seats from the left.
        const seated = new Set(nextOrder.filter((tileId): tileId is string => Boolean(tileId)));
        serverTileIds.filter(tileId => !seated.has(tileId)).forEach(tileId => {
          const freeSlot = nextOrder.indexOf(null);
          if (freeSlot >= 0) nextOrder[freeSlot] = tileId;
          else nextOrder.push(tileId);
        });
        const unchanged = nextOrder.length === previousOrder.length &&
          nextOrder.every((tileId, index) => tileId === (previousOrder[index] ?? null));
        return unchanged ? previousOrder : nextOrder;
      });
      setLoading(false);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to load game state');
      setLoading(false);
    }
  }, [gameId, isSpectator, myPlayerId, myToken, isDebug]);

  useEffect(() => {
    startTransition(() => {
      setSession(sessionStore.get(gameId));
      if (isDebug) setDebugSessions(debugSessionStore.get(gameId));
      setHydrated(true);
    });
  }, [gameId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      router.replace('/');
      return;
    }
    const initialLoad = setTimeout(() => { void loadGameState(); }, 0);
    return () => clearTimeout(initialLoad);
  }, [hydrated, session, router, loadGameState]);

  // Debug mode: one browser tab controls every clone, so when the turn hands off to another
  // clone we auto-switch "acting as" to them instead of leaving the tester stuck on whoever
  // just passed. Fires once per turn change (not on every render) so a manual "Act as" switch
  // to inspect an off-turn player isn't immediately overridden.
  const autoSwitchedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isDebug || !gameState?.current_player_id) return;
    const turnPlayerId = gameState.current_player_id;
    if (turnPlayerId === myPlayerId) return;
    if (autoSwitchedTurnRef.current === turnPlayerId) return;
    const next = debugSessions.find(s => s.playerId === turnPlayerId);
    if (!next) return;
    autoSwitchedTurnRef.current = turnPlayerId;
    sessionStore.save(next);
    setSession(next);
  }, [isDebug, gameState?.current_player_id, debugSessions, myPlayerId]);

  // WebSocket events
  const handleSocketEvent = useCallback((event: WebSocketEvent) => {
    switch (event.type) {
      case 'GAME_STATE_SYNC':
      case 'MOVE_COMMITTED':
      case 'TURN_PASSED':
      case 'TURN_STARTED': {
        loadGameState();
        const wordsFormed = event.payload?.wordsFormed ?? [];
        if (event.type === 'MOVE_COMMITTED' && wordsFormed.length > 0) {
          const words = wordsFormed.map((word) => word.word).join(', ');
          const score = event.payload.scoreEarned ?? 0;
          const player = gameState?.players.find(p => p.id === event.payload?.playerId);
          const name = event.payload?.playerId === myPlayerId ? 'You' : player?.display_name ?? 'Player';
          setLastMoveInfo(`${words} (+${score} pts)`);
          setMoveHistory(prev => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              text: `${name}: ${words}`,
              score,
              type: 'move',
            }
          ]);
          setTimeout(() => setLastMoveInfo(null), 4000);
        } else if (event.type === 'TURN_PASSED') {
          const player = gameState?.players.find(p => p.id === event.payload?.playerId);
          const name = event.payload?.playerId === myPlayerId ? 'You' : player?.display_name ?? 'Player';
          setMoveHistory(prev => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              text: `${name} passed turn`,
              type: 'pass',
            }
          ]);
        }
        break;
      }
      case 'TILES_EXCHANGED': {
        loadGameState();
        const exchangedBy = event.payload?.playerId === myPlayerId
          ? 'You'
          : gameState?.players.find(player => player.id === event.payload?.playerId)?.display_name ?? 'Opponent';
        const count = event.payload?.count ?? 0;
        setLastMoveInfo(`${exchangedBy} exchanged ${count} tile${count === 1 ? '' : 's'}`);
        setMoveHistory(prev => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            text: `${exchangedBy} swapped ${count} tiles`,
            type: 'exchange',
          }
        ]);
        setTimeout(() => setLastMoveInfo(null), 4000);
        break;
      }
      case 'PLACEMENT_PREVIEW':
        if (event.payload?.playerId !== myPlayerId) {
          setRemotePlacements(event.payload?.tiles ?? []);
        }
        break;
      case 'GAME_ENDED':
        setGameState(prev => prev ? { ...prev, status: 'FINISHED', winner_id: event.payload?.winnerId ?? prev.winner_id } : prev);
        // Pick up the final scores and HP too.
        loadGameState();
        break;
      case 'PLAYER_JOINED':
      case 'PLAYER_LEFT':
      case 'PLAYER_RECONNECTED':
      case 'PLAYER_DISCONNECTED':
      case 'EFFECT_PENDING':
      case 'EFFECT_RESOLVED':
        loadGameState();
        break;
    }
  }, [gameState?.players, loadGameState, myPlayerId]);

  const { isConnected, sendMessage } = useGameSocket({
    gameId,
    token: myToken,
    spectate: isSpectator,
    onEvent: handleSocketEvent,
  });

  useEffect(() => {
    if (gameState?.status === 'FINISHED') return;
    const interval = window.setInterval(() => setTimerNow(Date.now() + clockOffsetRef.current), 250);
    return () => window.clearInterval(interval);
  }, [gameState?.status]);

  // WebSocket events can be missed (reconnects, sockets blocked by a tunnel), so resync regularly.
  useEffect(() => {
    if (gameState?.status !== 'PLAYING') return;
    const interval = window.setInterval(() => { void loadGameState(); }, 5000);
    return () => window.clearInterval(interval);
  }, [gameState?.status, loadGameState]);

  useEffect(() => {
    if (!gameState) return;
    const nextTurnKey = `${gameState.turn_number}:${gameState.current_player_id ?? 'none'}`;
    if (turnKeyRef.current !== null && turnKeyRef.current !== nextTurnKey) {
      setSelectedTileId(null);
      setSelectedCell(null);
      setValidationState(null);
      setValidationReason('');
      setEstimatedScore(0);
      setRemotePlacements([]);
      setExchangeTileIds(null);
      // Tiles staged while waiting stay put, so when your turn comes you can confirm them straight away
      // (the new array makes the word check run again, now for real). Only tiles whose cell another
      // player just filled, or that are no longer in your rack (a card took them), go back.
      const boardCells = gameState.board_state;
      const myRack = gameState.players.find(player => player.id === myPlayerId)?.rack;
      const rackTileIds = myRack ? new Set(myRack.map(tile => tile.id)) : null;
      setTemporaryTiles(previous => previous.filter(tile =>
        !boardCells[`${tile.row}_${tile.col}`] && (!rackTileIds || rackTileIds.has(tile.tile_id))
      ));
    }
    turnKeyRef.current = nextTurnKey;
  }, [gameState, myPlayerId]);

  useEffect(() => {
    if (secondsRemaining !== 0 || !gameState?.turn_time_limit || !gameState.current_player_id) return;
    // The server has the final say. If it answers "not yet" (clocks never match exactly), ask again
    // shortly instead of leaving the turn stuck at 0s.
    const lastRequest = timeoutRequestRef.current;
    if (lastRequest?.turnNumber === gameState.turn_number && timerNow - lastRequest.at < TIMEOUT_RETRY_MS) return;
    timeoutRequestRef.current = { turnNumber: gameState.turn_number, at: timerNow };
    void expireTurn(gameId).then(() => loadGameState()).catch(() => undefined);
  }, [gameId, gameState?.current_player_id, gameState?.turn_number, gameState?.turn_time_limit, loadGameState, secondsRemaining, timerNow]);

  // A pending SHIELD-blockable DAMAGE/SWAP effect resolves itself once its window passes.
  useEffect(() => {
    const pending = gameState?.pending_effect;
    if (!pending) {
      resolvedEffectRef.current = null;
      return;
    }
    if (resolvedEffectRef.current === pending.expires_at) return;
    const delayMs = Date.parse(pending.expires_at) - Date.now() + 250;
    const timer = setTimeout(() => {
      resolvedEffectRef.current = pending.expires_at;
      void resolvePendingEffect(gameId).then(() => loadGameState()).catch(() => undefined);
    }, Math.max(0, delayMs));
    return () => clearTimeout(timer);
  }, [gameId, gameState?.pending_effect, loadGameState]);

  // Validate whenever temporary tiles change. Off-turn this is practice: the player sees whether the
  // word works, but only the current player's placement is shown to everyone else.
  const validateTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const sendPreview = (valid: boolean | null) => {
      if (isMyTurn) sendMessage({ type: 'PLACEMENT_PREVIEW', tiles: temporaryTiles, valid });
    };
    // Any result still in flight belongs to the old placement and must not overwrite the new one.
    const requestId = ++validationRequestRef.current;
    if (temporaryTiles.length === 0) {
      startTransition(() => {
        setEstimatedScore(0);
        setValidationState(null);
        setValidationReason('');
        // The word check's complaint was about tiles that are no longer on the board.
        setError('');
      });
      sendPreview(null);
      return;
    }
    // Until the new placement is checked, Confirm must not rely on the previous verdict.
    startTransition(() => setValidationState(null));
    sendPreview(null);
    if (validateTimeout.current) clearTimeout(validateTimeout.current);
    validateTimeout.current = setTimeout(async () => {
      if (!myPlayerId) return;
      const result = await validateMove(gameId, myPlayerId, temporaryTiles).catch(() => null);
      if (!result || requestId !== validationRequestRef.current) return;
      setEstimatedScore(result.valid ? result.estimated_score : 0);
      setValidationState(result.valid);
      setValidationReason(result.reason ?? '');
      setError(result.valid ? '' : (result.reason ?? 'Invalid move'));
      sendPreview(result.valid);
    }, 400);
    return () => { if (validateTimeout.current) clearTimeout(validateTimeout.current); };
  }, [temporaryTiles, gameId, myPlayerId, isMyTurn, sendMessage]);

  // Power card actions
  const handleUseSimpleCard = useCallback(async (card: 'HINT' | 'FREE_EXCHANGE' | 'MOVE_HEAL' | 'DRAW_TILE' | 'HEAL') => {
    if (!myPlayerId || cardBusy) return;
    setCardBusy(true);
    try {
      const payload: UseCardPayload = { card };
      if (card === 'MOVE_HEAL') payload.placed_tiles = temporaryTiles;
      const result = await playCard(gameId, myPlayerId, payload);
      if (card === 'HINT') {
        if (result.found && typeof result.row === 'number' && typeof result.col === 'number') {
          setHintCell({ row: result.row, col: result.col });
          setTimeout(() => setHintCell(null), 5000);
        } else {
          // The hint search found nothing this time; the card stays in hand (see cards.py) so it's
          // worth telling the player explicitly rather than leaving the click looking like a no-op.
          setLastMoveInfo('No valid move found with your current rack — Hint card kept, try again');
          setTimeout(() => setLastMoveInfo(null), 4000);
        }
      }
      await loadGameState();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to use card');
      setTimeout(() => setError(''), 4000);
    } finally {
      setCardBusy(false);
    }
  }, [cardBusy, gameId, loadGameState, myPlayerId, temporaryTiles]);

  const handleUseTargetedCard = useCallback(async (card: 'DOUBLE_DAMAGE' | 'STEAL_TILE', targetPlayerId: string) => {
    if (!myPlayerId || cardBusy) return;
    setCardBusy(true);
    try {
      await playCard(gameId, myPlayerId, { card, target_player_id: targetPlayerId });
      await loadGameState();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to use card');
      setTimeout(() => setError(''), 4000);
    } finally {
      setCardBusy(false);
    }
  }, [cardBusy, gameId, loadGameState, myPlayerId]);

  const handleUseBanLetter = useCallback(async (letter: string) => {
    if (!myPlayerId || cardBusy) return;
    setCardBusy(true);
    try {
      await playCard(gameId, myPlayerId, { card: 'BAN_LETTER', letter });
      await loadGameState();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to use card');
      setTimeout(() => setError(''), 4000);
    } finally {
      setCardBusy(false);
    }
  }, [cardBusy, gameId, loadGameState, myPlayerId]);

  const handleUseShield = useCallback(async () => {
    if (!myPlayerId || cardBusy) return;
    setCardBusy(true);
    try {
      await playCard(gameId, myPlayerId, { card: 'SHIELD' });
      await loadGameState();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to use Shield');
      setTimeout(() => setError(''), 4000);
    } finally {
      setCardBusy(false);
    }
  }, [cardBusy, gameId, loadGameState, myPlayerId]);

  // Handle cell click on board
  const handleCellClick = useCallback((row: number, col: number) => {
    if (armedCard) {
      const isOccupied = Object.values(boardState).some(cell => cell.row === row && cell.col === col);
      if (!myPlayerId || !isOccupied || cardBusy) return;
      setCardBusy(true);
      playCard(gameId, myPlayerId, { card: armedCard, row, col })
        .then(() => loadGameState())
        .catch((error: unknown) => {
          setError(error instanceof Error ? error.message : 'Failed to use card');
          setTimeout(() => setError(''), 4000);
        })
        .finally(() => { setCardBusy(false); setArmedCard(null); });
      return;
    }
    if (!canStageMove) return;
    if (Object.values(boardState).some(cell => cell.row === row && cell.col === col)) return;

    const alreadyPlaced = temporaryTiles.find(t => t.row === row && t.col === col);
    if (alreadyPlaced) {
      // Remove tile from cell, return to rack
      setTemporaryTiles(prev => prev.filter(t => !(t.row === row && t.col === col)));
      setSelectedTileId(null);
      return;
    }

    if (!selectedTileId) return;
    const tile = myRack.find(t => t.id === selectedTileId);
    if (!tile) return;

    // Check if tile already in temporaryTiles
    const alreadyUsed = temporaryTiles.find(t => t.tile_id === selectedTileId);
    if (alreadyUsed) return;

    setTemporaryTiles(prev => [
      ...prev,
      { row, col, tile_id: tile.id, letter: tile.letter, value: tile.value },
    ]);
    setSelectedTileId(null);
    setSelectedCell({ row, col });
  }, [armedCard, boardState, canStageMove, cardBusy, gameId, loadGameState, myPlayerId, selectedTileId, myRack, temporaryTiles]);

  const handleSelectTile = (tile: Tile) => {
    if (exchangeTileIds !== null) {
      setExchangeTileIds(prev => prev && (
        prev.includes(tile.id) ? prev.filter(id => id !== tile.id) : [...prev, tile.id]
      ));
      return;
    }
    setSelectedTileId(prev => prev === tile.id ? null : tile.id);
  };

  const handleStartExchange = () => {
    setSelectedTileId(null);
    setSelectedCell(null);
    setExchangeTileIds([]);
  };

  const handleConfirmExchange = async () => {
    if (!myPlayerId || !exchangeTileIds?.length) return;
    setIsSubmitting(true);
    try {
      await exchangeTiles(gameId, myPlayerId, exchangeTileIds);
      setExchangeTileIds(null);
      loadGameState();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to exchange tiles');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelMove = () => {
    setTemporaryTiles([]);
    setSelectedTileId(null);
    setSelectedCell(null);
  };

  const handleCollectPendingTile = useCallback((tileId: string) => {
    if (!canStageMove) return;
    setTemporaryTiles(previous => {
      return previous.filter(tile => tile.tile_id !== tileId);
    });
    setSelectedTileId(null);
    setSelectedCell(null);
  }, [canStageMove]);

  const handleConfirmMove = async () => {
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
      setTemporaryTiles([]);
      setSelectedTileId(null);
      setSelectedCell(null);
      loadGameState();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to commit move');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePassTurn = async () => {
    if (!myPlayerId) return;
    setIsSubmitting(true);
    try {
      await passTurn(gameId, myPlayerId);
      loadGameState();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to pass turn');
      setTimeout(() => setError(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keep the pre-hydration and pre-fetch output empty on both server and client.
  // The game UI is rendered only after the browser session and game snapshot exist.
  if (!hydrated || !session || loading || !gameState) return null;

  if (gameState?.status === 'FINISHED') {
    const sorted = [...(gameState.players ?? [])].sort((a, b) => b.score - a.score);
    // The server decides the winner: knocked-out players and players who left cannot win,
    // so the top score is not necessarily the winner.
    const winner = gameState.players.find(p => p.id === gameState.winner_id);
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-8 p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-black text-white mb-2">Game Over!</h1>
          {winner && <p className="text-amber-400 text-2xl font-bold">{winner.display_name} wins!</p>}
        </div>
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6">
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Final Scores</h2>
          {sorted.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 ${p.id === myPlayerId ? 'text-amber-300' : 'text-white'}`}>
              <span className="font-semibold">{i + 1}. {p.display_name} {p.id === myPlayerId && '(You)'} {p.id === winner?.id && '🏆'}</span>
              <span className="font-mono font-bold">{p.score} pts</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const tileBagCount = gameState?.tile_bag_count ?? 0;
  const currentPlayer = gameState?.players.find(p => p.id === gameState?.current_player_id);
  const roomPin = gameState.game_pin ?? session.gamePin ?? null;
  const spectatorCount = gameState.spectator_count ?? 0;

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
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 18%, rgba(99, 102, 241, 0.16), transparent 30%), linear-gradient(135deg, #020617 0%, #0f172a 58%, #171942 100%)',
      }}
    >
      <ParticleField className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
      {/* Top HUD. On a phone it wraps: controls and counters on the first row, the turn banner below. */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2 sm:px-4 bg-slate-900/75 border-b border-slate-800/60 backdrop-blur-sm shrink-0">
        {/* Left: Exit, logo, connection, room PIN */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            title={isSpectator ? 'Stop watching' : 'Exit game'}
          >
            <span>Exit</span>
          </button>
          <Image
            src="/wordx-icon.png?v=20260915"
            alt="WordX logo"
            width={30}
            height={30}
            className="h-7 w-7 rounded-md object-contain"
          />
          <span className="hidden text-lg font-black text-white sm:inline">Word<span className="text-amber-400">X</span></span>
          <div
            className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}
            title={isConnected ? 'Live' : 'Reconnecting...'}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="hidden sm:inline">{isConnected ? 'Live' : 'Reconnecting...'}</span>
          </div>
          {roomPin && (
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(roomPin).catch(() => undefined); }}
              className="whitespace-nowrap rounded-lg border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
              title="Room PIN (click to copy)"
            >
              PIN <span className="font-bold text-amber-300">{roomPin}</span>
            </button>
          )}
        </div>

        {/* Right: spectators, timer, and TurnBanner */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          {spectatorCount > 0 && (
            <span className="whitespace-nowrap text-xs text-slate-400" title="Spectators watching">👁 {spectatorCount}</span>
          )}
          {secondsRemaining !== null && (
            <span className="whitespace-nowrap font-mono text-xs text-amber-300 font-semibold px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60" title="Time left this turn">
              ⏳ {secondsRemaining}s
            </span>
          )}
          <TurnBanner isMyTurn={isMyTurn} currentPlayer={currentPlayer} turnNumber={gameState?.turn_number ?? 1} />
        </div>
      </div>

      {/* Pending DAMAGE/SWAP effect: a short SHIELD window before it lands.
          Error/last-move toasts moved below into the stacked toast container over the board. */}
      {pendingEffect && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-sky-950/90 border border-sky-500/50 text-sky-200 text-sm px-4 py-2 rounded-xl shadow-xl">
          <span>{pendingEffect.type === 'SWAP' ? '🔄 A tile swap is pending…' : '⚔️ Damage is pending…'}</span>
          {pendingTargetsMe && iHaveShield && (
            <button
              onClick={handleUseShield}
              disabled={cardBusy}
              className="rounded-full bg-sky-600 hover:bg-sky-500 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
            >
              🛡️ Shield
            </button>
          )}
        </div>
      )}

      {/* Main: Board */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* Board canvas takes full space */}
        <div className="flex-1 relative">
          {/* Toasts stack instead of sitting on top of each other, and stay clear of the zoom controls */}
          {(lastMoveInfo || error) && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex w-max max-w-[calc(100%-9rem)] -translate-x-1/2 flex-col items-center gap-2">
              {lastMoveInfo && (
                <div className="rounded-xl border border-emerald-600/50 bg-emerald-900/90 px-4 py-2 text-center text-sm text-emerald-200 shadow-xl">
                  ✨ {lastMoveInfo}
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-red-600/50 bg-red-900/90 px-4 py-2 text-center text-sm text-red-200 shadow-xl">
                  {error}
                </div>
              )}
            </div>
          )}
        <div className="absolute inset-0 z-10">
          <BoardCanvas
            boardState={boardState}
            temporaryTiles={temporaryTiles}
            remotePlacements={remotePlacements}
            temporaryTilesValid={validationState}
            selectedCell={selectedCell}
            onCellClick={handleCellClick}
            onStartPendingDrag={startPendingDrag}
            onFinishPendingDrag={finishDrag}
            onCollectPendingTile={handleCollectPendingTile}
            onPendingDragMove={updateDragHover}
            onViewportChange={setBoardViewport}
            dragPreviewCell={dragHoverCell}
            draggingTileId={dragSession?.tile.id ?? null}
            dragPreviewTile={dragSession?.tile ?? null}
            dragPreviewIsValid={dragHoverIsValid}
            canStageMove={canStageMove}
            camera={camera}
            frozenTile={gameState.frozen_tile}
            hintCell={hintCell}
          />
          {dragSession && (
            <div
              className="pointer-events-none fixed z-[100] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 rotate-2 scale-105 flex-col items-center justify-center rounded-xl border border-sky-400/40 bg-gradient-to-b from-[#23407a] via-[#1a305e] to-[#122244] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_14px_28px_rgba(0,0,0,0.7)]"
              style={{ left: dragSession.position.x, top: dragSession.position.y }}
              aria-hidden="true"
            >
              <span className="text-[38px] font-normal leading-none font-quakduck text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                {dragSession.tile.letter}
              </span>
              <span className="absolute bottom-1 right-1.5 text-[10px] font-semibold text-slate-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                {dragSession.tile.value}
              </span>
            </div>
          )}
          {/* Floating board controls on mobile only (desktop has them in the RightSidebar) */}
          <div className="lg:hidden">
            <BoardControls
              onZoomIn={() => camera.zoomBy(BUTTON_ZOOM_FACTOR, boardViewport.width / 2, boardViewport.height / 2)}
              onZoomOut={() => camera.zoomBy(1 / BUTTON_ZOOM_FACTOR, boardViewport.width / 2, boardViewport.height / 2)}
              onReset={() => {
                const el = document.querySelector('canvas');
                camera.resetCamera(el?.clientWidth ?? window.innerWidth, el?.clientHeight ?? window.innerHeight);
              }}
              scale={camera.scale}
              minScale={camera.minScale}
              maxScale={camera.maxScale}
            />
          </div>
        </div>
        </div>

        {/* Right sidebar: Unified Glassmorphism Control & Scoreboard Panel (desktop) */}
        <div className="hidden lg:flex flex-col shrink-0">
          <RightSidebar
            players={gameState?.players ?? []}
            myPlayerId={myPlayerId}
            currentPlayerId={gameState?.current_player_id ?? null}
            tileBagCount={tileBagCount}
            moveHistory={moveHistory}
            onZoomIn={() => camera.zoomBy(BUTTON_ZOOM_FACTOR, boardViewport.width / 2, boardViewport.height / 2)}
            onZoomOut={() => camera.zoomBy(1 / BUTTON_ZOOM_FACTOR, boardViewport.width / 2, boardViewport.height / 2)}
            onReset={() => {
              const el = document.querySelector('canvas');
              camera.resetCamera(el?.clientWidth ?? window.innerWidth, el?.clientHeight ?? window.innerHeight);
            }}
            scale={camera.scale}
            minScale={camera.minScale}
            maxScale={camera.maxScale}
          />
        </div>
      </div>

      {/* Bottom: Tile rack (spectators have no seat and never see a rack) */}
      <div className="relative z-10 shrink-0 p-3">
        {isSpectator ? (
          <p className="py-3 text-center text-sm text-sky-300">
            👁 You are watching this game. Players&apos; tiles stay hidden.
          </p>
        ) : (
        <>
        <div className="mb-2">
          <PowerCardBar
            cards={myPlayer?.cards ?? []}
            opponents={opponents}
            isMyTurn={isMyTurn}
            hasStagedMove={temporaryTiles.length > 0}
            armedCard={armedCard}
            busy={cardBusy}
            onUseSimple={handleUseSimpleCard}
            onUseTargeted={handleUseTargetedCard}
            onUseBanLetter={handleUseBanLetter}
            onArmBoardCard={(card) => setArmedCard(card)}
            onCancelArm={() => setArmedCard(null)}
          />
        </div>
        <TileRack
          slots={rackSlots}
          selectedTileId={selectedTileId}
          exchangeTileIds={exchangeTileIds}
          tileBagCount={tileBagCount}
          onSelectTile={handleSelectTile}
          onCancelMove={handleCancelMove}
          onConfirmMove={handleConfirmMove}
          onPassTurn={handlePassTurn}
          onShuffleRack={handleShuffleRack}
          onStartExchange={handleStartExchange}
          onCancelExchange={() => setExchangeTileIds(null)}
          onConfirmExchange={handleConfirmExchange}
          onSwapSlots={handleSwapRackSlots}
          onStartTileDrag={startRackDrag}
          onFinishTileDrag={finishDrag}
          onCancelTileDrag={cancelDrag}
          onRackViewportChange={setRackViewport}
          isExternalDragActive={dragSession?.source === 'board'}
          isMyTurn={isMyTurn}
          canStageMove={canStageMove}
          hasTemporaryTiles={temporaryTiles.length > 0}
          placementValid={validationState}
          isSubmitting={isSubmitting}
          estimatedScore={estimatedScore}
        />
        </>
        )}
      </div>

      {isDebug && (
        <DebugPanel
          gameId={gameId}
          players={gameState?.players ?? []}
          sessions={debugSessions}
          activePlayerId={myPlayerId}
          onSwitchPlayer={(next) => { sessionStore.save(next); setSession(next); }}
          onGameState={setGameState}
        />
      )}
    </div>
  );
}
