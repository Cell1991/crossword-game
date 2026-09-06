'use client';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { sessionStore, getGameState, validateMove, commitMove, passTurn, StoredSession } from '../../../lib/api';
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

  // Camera
  const camera = useBoardCamera();

  // Derived
  const myPlayerId = session?.playerId ?? null;
  const myToken = session?.token ?? '';
  const isMyTurn = gameState?.current_player_id === myPlayerId;
  const myPlayer = gameState?.players.find(p => p.id === myPlayerId);
  const myRack: Tile[] = myPlayer?.rack ?? [];

  // Load game state
  const loadGameState = useCallback(async () => {
    if (!myToken) return;
    try {
      const state = await getGameState(gameId, myToken);
      setGameState(state);
      setLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to load game state');
      setLoading(false);
    }
  }, [gameId, myToken]);

  useEffect(() => {
    setSession(sessionStore.get(gameId));
    setHydrated(true);
  }, [gameId]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      router.replace('/');
      return;
    }
    loadGameState();
  }, [hydrated, session, router, loadGameState]);

  // WebSocket events
  const handleSocketEvent = useCallback((event: WebSocketEvent) => {
    switch (event.type) {
      case 'GAME_STATE_SYNC':
      case 'MOVE_COMMITTED':
      case 'TURN_PASSED':
      case 'TURN_STARTED':
        loadGameState();
        if (event.type === 'MOVE_COMMITTED' && event.payload?.words_formed?.length > 0) {
          const words = event.payload.words_formed.map((w: any) => w.word).join(', ');
          setLastMoveInfo(`${words} (+${event.payload.score_earned} pts)`);
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

  // Validate move whenever temporary tiles change
  const validateTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (temporaryTiles.length === 0) {
      setEstimatedScore(0);
      setValidationState(null);
      setValidationReason('');
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
  }, [isMyTurn, selectedTileId, myRack, temporaryTiles]);

  const handleSelectTile = (tile: Tile) => {
    setSelectedTileId(prev => prev === tile.id ? null : tile.id);
  };

  const handleCancelMove = () => {
    setTemporaryTiles([]);
    setSelectedTileId(null);
    setSelectedCell(null);
  };

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
    } catch (e: any) {
      setError(e.message || 'Failed to commit move');
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
    } catch (e: any) {
      setError(e.message || 'Failed to pass turn');
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

  const boardState = gameState?.board_state ?? {};
  const tileBagCount = gameState?.tile_bag_count ?? 0;
  const currentPlayer = gameState?.players.find(p => p.id === gameState?.current_player_id);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800/60 backdrop-blur-sm shrink-0 z-10">
        {/* Left: Logo + connection */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-white">Word<span className="text-amber-400">Battle</span></span>
          <div className={`flex items-center gap-1.5 text-xs ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'Live' : 'Reconnecting...'}
          </div>
        </div>

        {/* Center: Turn banner */}
        <TurnBanner isMyTurn={isMyTurn} currentPlayer={currentPlayer} turnNumber={gameState?.turn_number ?? 1} />

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
            isMyTurn={isMyTurn}
            camera={camera}
          />
          <BoardControls
            onZoomIn={camera.zoomIn}
            onZoomOut={camera.zoomOut}
            onReset={() => {
              const el = document.querySelector('canvas');
              camera.resetCamera(el?.clientWidth ?? window.innerWidth, el?.clientHeight ?? window.innerHeight);
            }}
            scale={camera.scale}
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
          rack={myRack}
          selectedTileId={selectedTileId}
          onSelectTile={handleSelectTile}
          onCancelMove={handleCancelMove}
          onConfirmMove={handleConfirmMove}
          onPassTurn={handlePassTurn}
          isMyTurn={isMyTurn}
          hasTemporaryTiles={temporaryTiles.length > 0}
          isSubmitting={isSubmitting}
          estimatedScore={estimatedScore}
        />
      </div>
    </div>
  );
}
