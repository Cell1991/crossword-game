'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import React, { startTransition, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { sessionStore, getGameState, validateMove, commitMove, passTurn, expireTurn, StoredSession } from '../../../lib/api';
import { useGameSocket } from '../../../hooks/useGameSocket';
import { useBoardCamera } from '../../../hooks/useBoardCamera';
import { BoardCanvas } from '../../../components/board/BoardCanvas';
import { BoardControls } from '../../../components/board/BoardControls';
import { TileRack } from '../../../components/rack/TileRack';
import { TurnBanner } from '../../../components/game/TurnBanner';
import { ScoreBoard } from '../../../components/game/ScoreBoard';
import {
  GameState,
  Tile,
  PlacedTile,
  WebSocketEvent,
} from '../../../lib/types';

const EMPTY_TILES: Tile[] = [];

/** Seats on the rack stand. The rack always shows this many, even when the bag runs dry. */
const RACK_SIZE = 7;

interface DragSession {
  tile: Tile;
  source: 'rack' | 'board';
  origin: { row: number; col: number } | null;
  position: { x: number; y: number };
}

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;

  // Session
  const [session, setSession] = useState<StoredSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

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
  const [rackOrder, setRackOrder] = useState<(string | null)[]>([]);
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [dragHoverCell, setDragHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [boardViewport, setBoardViewport] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [rackViewport, setRackViewport] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const timeoutCheckedTurnRef = useRef<number | null>(null);

  // Camera
  const camera = useBoardCamera();

  // Derived
  const myPlayerId = session?.playerId ?? null;
  const myToken = session?.token ?? '';
  const isMyTurn = gameState?.current_player_id === myPlayerId;
  const myPlayer = gameState?.players.find(p => p.id === myPlayerId);
  const boardState = useMemo(() => gameState?.board_state ?? {}, [gameState?.board_state]);
  const screenToCell = camera.screenToCell;
  const serverRack: Tile[] = myPlayer?.rack ?? EMPTY_TILES;
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
  const secondsRemaining = gameState?.turn_time_limit && gameState.turn_started_at
    ? Math.max(0, gameState.turn_time_limit - Math.floor((timerNow - new Date(gameState.turn_started_at).getTime()) / 1000))
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
    if (!session || !isMyTurn) {
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
  }, [boardState, boardViewport, dragHoverCell, dragSession, isMyTurn, rackViewport, screenToCell, seatReturningTile, temporaryTiles]);

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
    if (!isMyTurn) return;
    setSelectedTileId(null);
    setDragSession({ tile, source: 'rack', origin: null, position: { x: clientX, y: clientY } });
    updateDragHover(clientX, clientY);
  }, [isMyTurn, updateDragHover]);

  const startPendingDrag = useCallback((tile: PlacedTile, clientX: number, clientY: number) => {
    if (!isMyTurn) return;
    setDragSession({
      tile: { id: tile.tile_id, letter: tile.letter, value: tile.value },
      source: 'board',
      origin: { row: tile.row, col: tile.col },
      position: { x: clientX, y: clientY },
    });
    updateDragHover(clientX, clientY);
  }, [isMyTurn, updateDragHover]);

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
    if (!myToken) return;
    try {
      const state = await getGameState(gameId, myToken);
      setGameState(state);
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
  }, [gameId, myPlayerId, myToken]);

  useEffect(() => {
    startTransition(() => {
      setSession(sessionStore.get(gameId));
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

  // WebSocket events
  const handleSocketEvent = useCallback((event: WebSocketEvent) => {
    switch (event.type) {
      case 'GAME_STATE_SYNC':
      case 'MOVE_COMMITTED':
      case 'TURN_PASSED':
      case 'TURN_STARTED':
        loadGameState();
        const wordsFormed = event.payload?.words_formed ?? [];
        if (event.type === 'MOVE_COMMITTED' && wordsFormed.length > 0) {
          const words = wordsFormed.map((word) => word.word).join(', ');
          setLastMoveInfo(`${words} (+${event.payload.score_earned ?? 0} pts)`);
          setTimeout(() => setLastMoveInfo(null), 4000);
        }
        break;
      case 'PLACEMENT_PREVIEW':
        if (event.payload?.playerId !== myPlayerId) {
          setRemotePlacements(event.payload?.tiles ?? []);
        }
        break;
      case 'GAME_ENDED':
        setGameState(prev => prev ? { ...prev, status: 'FINISHED' } : prev);
        break;
      case 'PLAYER_JOINED':
      case 'PLAYER_LEFT':
      case 'PLAYER_RECONNECTED':
      case 'PLAYER_DISCONNECTED':
        loadGameState();
        break;
    }
  }, [loadGameState, myPlayerId]);

  const { isConnected, sendMessage } = useGameSocket({
    gameId,
    token: myToken,
    onEvent: handleSocketEvent,
  });

  useEffect(() => {
    if (gameState?.status === 'FINISHED') return;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [gameState?.status]);

  useEffect(() => {
    if (secondsRemaining !== 0 || !gameState?.turn_time_limit || !gameState.current_player_id) return;
    if (timeoutCheckedTurnRef.current === gameState.turn_number) return;
    timeoutCheckedTurnRef.current = gameState.turn_number;
    void expireTurn(gameId).then(() => loadGameState()).catch(() => undefined);
  }, [gameId, gameState?.current_player_id, gameState?.turn_number, gameState?.turn_time_limit, loadGameState, secondsRemaining]);

  // Validate move whenever temporary tiles change
  const validateTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (temporaryTiles.length === 0) {
      startTransition(() => {
        setEstimatedScore(0);
        setValidationState(null);
        setValidationReason('');
      });
      sendMessage({ type: 'PLACEMENT_PREVIEW', tiles: [], valid: null });
      return;
    }
    sendMessage({ type: 'PLACEMENT_PREVIEW', tiles: temporaryTiles, valid: null });
    if (validateTimeout.current) clearTimeout(validateTimeout.current);
    validateTimeout.current = setTimeout(async () => {
      if (!myPlayerId) return;
      const result = await validateMove(gameId, myPlayerId, temporaryTiles);
      setEstimatedScore(result.valid ? result.estimated_score : 0);
      setValidationState(result.valid);
      setValidationReason(result.reason ?? '');
      setError(result.valid ? '' : (result.reason ?? 'Invalid move'));
      sendMessage({ type: 'PLACEMENT_PREVIEW', tiles: temporaryTiles, valid: result.valid });
    }, 400);
    return () => { if (validateTimeout.current) clearTimeout(validateTimeout.current); };
  }, [temporaryTiles, gameId, myPlayerId, sendMessage]);

  // Handle cell click on board
  const handleCellClick = useCallback((row: number, col: number) => {
    if (!isMyTurn) return;
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
  }, [boardState, isMyTurn, selectedTileId, myRack, temporaryTiles]);

  const handleSelectTile = (tile: Tile) => {
    setSelectedTileId(prev => prev === tile.id ? null : tile.id);
  };

  const handleCancelMove = () => {
    setTemporaryTiles([]);
    setSelectedTileId(null);
    setSelectedCell(null);
  };

  const handleCollectPendingTile = useCallback((tileId: string) => {
    if (!isMyTurn) return;
    setTemporaryTiles(previous => {
      return previous.filter(tile => tile.tile_id !== tileId);
    });
    setSelectedTileId(null);
    setSelectedCell(null);
  }, [isMyTurn]);

  const handleConfirmMove = async () => {
    if (!myPlayerId || temporaryTiles.length === 0) return;
    if (validationState !== true) {
      setError(validationReason || 'Fix the invalid word before confirming');
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
    const winner = sorted[0];
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-8 p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-black text-white mb-2">Game Over!</h1>
          <p className="text-amber-400 text-2xl font-bold">{winner?.display_name} wins!</p>
        </div>
        <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6">
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Final Scores</h2>
          {sorted.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0 ${p.id === myPlayerId ? 'text-amber-300' : 'text-white'}`}>
              <span className="font-semibold">{i + 1}. {p.display_name} {p.id === myPlayerId && '(You)'}</span>
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

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800/60 backdrop-blur-sm shrink-0 z-10">
        {/* Left: Logo + connection */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.confirm('ต้องการออกจากเกมหรือไม่?')) router.push('/');
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Exit game"
          >
            <span>Exit</span>
          </button>
          <span className="text-lg font-black text-white">Word<span className="text-amber-400">X</span></span>
          <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'Live' : 'Reconnecting...'}
          </div>
        </div>

        {/* Center: Turn banner */}
        <TurnBanner isMyTurn={isMyTurn} currentPlayer={currentPlayer} turnNumber={gameState?.turn_number ?? 1} />

        <div className="min-w-[72px] text-center font-mono text-xs text-slate-300">
          {secondsRemaining === null ? 'Unlimited' : `${secondsRemaining}s`}
        </div>

        {/* Right: Tile bag */}
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <span>🎲</span>
          <span className="font-mono font-bold text-white">{tileBagCount}</span>
          <span className="text-xs hidden sm:block">tiles left</span>
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-600/50 text-red-200 text-sm px-4 py-2 rounded-xl shadow-xl">
          {error}
        </div>
      )}

      {/* Last move info toast */}
      {lastMoveInfo && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-900/90 border border-emerald-600/50 text-emerald-200 text-sm px-4 py-2 rounded-xl shadow-xl">
          ✨ {lastMoveInfo}
        </div>
      )}

      {/* Main: Board */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Board canvas takes full space */}
        <div className="flex-1 relative">
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
            isMyTurn={isMyTurn}
            camera={camera}
          />
          {dragSession && (
            <div
              className="pointer-events-none fixed z-[100] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 rotate-3 scale-105 flex-col items-center justify-center rounded-xl border-2 border-amber-400 bg-amber-100 text-stone-900 shadow-2xl"
              style={{ left: dragSession.position.x, top: dragSession.position.y }}
              aria-hidden="true"
            >
              <span className="text-2xl font-black leading-none">{dragSession.tile.letter}</span>
              <span className="absolute bottom-1 right-1.5 text-[10px] font-bold text-stone-600">{dragSession.tile.value}</span>
            </div>
          )}
          <BoardControls
            onZoomIn={() => camera.zoomAtPoint(-1, boardViewport.width / 2, boardViewport.height / 2)}
            onZoomOut={() => camera.zoomAtPoint(1, boardViewport.width / 2, boardViewport.height / 2)}
            onReset={() => {
              const el = document.querySelector('canvas');
              camera.resetCamera(el?.clientWidth ?? window.innerWidth, el?.clientHeight ?? window.innerHeight);
            }}
            scale={camera.scale}
            minScale={camera.minScale}
            maxScale={camera.maxScale}
          />
        </div>

        {/* Right sidebar: scoreboard (desktop) */}
        <div className="hidden lg:flex flex-col w-64 shrink-0 bg-slate-900/80 border-l border-slate-800/60 backdrop-blur-sm">
          <ScoreBoard
            players={gameState?.players ?? []}
            myPlayerId={myPlayerId}
            currentPlayerId={gameState?.current_player_id ?? null}
            tileBagCount={tileBagCount}
          />
        </div>
      </div>

      {/* Bottom: Tile rack */}
      <div className="shrink-0 bg-slate-900/90 border-t border-slate-800/60 backdrop-blur-sm p-3 z-10">
        <TileRack
          slots={rackSlots}
          selectedTileId={selectedTileId}
          onSelectTile={handleSelectTile}
          onCancelMove={handleCancelMove}
          onConfirmMove={handleConfirmMove}
          onPassTurn={handlePassTurn}
          onShuffleRack={handleShuffleRack}
          onSwapSlots={handleSwapRackSlots}
          onStartTileDrag={startRackDrag}
          onFinishTileDrag={finishDrag}
          onRackViewportChange={setRackViewport}
          isExternalDragActive={dragSession?.source === 'board'}
          isMyTurn={isMyTurn}
          hasTemporaryTiles={temporaryTiles.length > 0}
          isSubmitting={isSubmitting}
          estimatedScore={estimatedScore}
        />
      </div>
    </div>
  );
}
