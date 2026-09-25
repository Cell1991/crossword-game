'use client';

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { validateMove } from '@/lib/api';
import { BoardCell, CellPosition, GameState, PlacedTile, Tile } from '@/lib/types';
import { cellKey, isBlankLetter, isCellCommitted } from '@/lib/tiles';

/** Wait this long after the last change before asking the server whether the placement is valid. */
const VALIDATE_DEBOUNCE_MS = 400;

interface BlankPickerTarget {
  tileId: string;
  row?: number;
  col?: number;
}

interface UseStagedMoveOptions {
  gameId: string;
  myPlayerId: string | null;
  isMyTurn: boolean;
  canStageMove: boolean;
  boardState: Record<string, BoardCell>;
  sendMessage: (message: Record<string, unknown>) => void;
  setError: (message: string) => void;
}

/**
 * The move being put together on this device: tiles staged on the board (not yet committed),
 * the selected rack tile and cell, letters chosen for blanks, and the server's verdict on the
 * placement. Only the current player's placement is shown to everyone else.
 */
export function useStagedMove({
  gameId,
  myPlayerId,
  isMyTurn,
  canStageMove,
  boardState,
  sendMessage,
  setError,
}: UseStagedMoveOptions) {
  const [temporaryTiles, setTemporaryTiles] = useState<PlacedTile[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [estimatedScore, setEstimatedScore] = useState<number>(0);
  const [validationState, setValidationState] = useState<boolean | null>(null);
  const [validationReason, setValidationReason] = useState('');
  const [blankPickerTarget, setBlankPickerTarget] = useState<BlankPickerTarget | null>(null);
  const [designatedBlankLetters, setDesignatedBlankLetters] = useState<Record<string, string>>({});
  const validationRequestRef = useRef(0);
  const validateTimeout = useRef<NodeJS.Timeout | null>(null);

  const pendingTileIds = useMemo(
    () => new Set(temporaryTiles.map(tile => tile.tile_id)),
    [temporaryTiles]
  );

  // Validate whenever temporary tiles change. Off-turn this is practice: the player sees whether the
  // word works, but only the current player's placement is shown to everyone else.
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
    }, VALIDATE_DEBOUNCE_MS);
    return () => { if (validateTimeout.current) clearTimeout(validateTimeout.current); };
  }, [temporaryTiles, gameId, myPlayerId, isMyTurn, sendMessage, setError]);

  /** Puts a rack tile on a cell, asking for a letter first when it is a blank without one. */
  const stageTile = useCallback((tile: Tile, cell: CellPosition) => {
    let letter = tile.letter;
    let value = tile.value;
    if (isBlankLetter(tile.letter)) {
      const designatedLetter = designatedBlankLetters[tile.id];
      if (!designatedLetter) {
        setBlankPickerTarget({ tileId: tile.id, row: cell.row, col: cell.col });
        return;
      }
      letter = designatedLetter;
      value = 0;
    }
    setTemporaryTiles(previous => [
      ...previous.filter(staged => staged.tile_id !== tile.id),
      { row: cell.row, col: cell.col, tile_id: tile.id, letter, value },
    ]);
    setSelectedTileId(null);
    setSelectedCell(cell);
  }, [designatedBlankLetters]);

  /** Two staged tiles trade places: the dragged one takes the target's cell, the target takes its origin. */
  const swapStagedTiles = useCallback((draggedTileId: string, origin: CellPosition, target: PlacedTile) => {
    setTemporaryTiles(previous => previous.map(tile => {
      if (tile.tile_id === draggedTileId) return { ...tile, row: target.row, col: target.col };
      if (tile.tile_id === target.tile_id) return { ...tile, row: origin.row, col: origin.col };
      return tile;
    }));
    setSelectedTileId(null);
    setSelectedCell({ row: target.row, col: target.col });
  }, []);

  /** Takes a staged tile off the board; its rack seat shows it again. */
  const unstageTile = useCallback((tileId: string) => {
    setTemporaryTiles(previous => previous.filter(tile => tile.tile_id !== tileId));
    setSelectedTileId(null);
    setSelectedCell(null);
  }, []);

  /** A click on a board cell: recalls the staged tile there, or places the selected rack tile. */
  const handleCellClick = useCallback((row: number, col: number, rackTiles: Tile[]) => {
    if (!canStageMove) return;
    if (isCellCommitted(boardState, row, col)) return;

    if (temporaryTiles.some(tile => tile.row === row && tile.col === col)) {
      setTemporaryTiles(previous => previous.filter(tile => !(tile.row === row && tile.col === col)));
      setSelectedTileId(null);
      return;
    }

    if (!selectedTileId) return;
    const tile = rackTiles.find(rackTile => rackTile.id === selectedTileId);
    if (!tile) return;
    if (temporaryTiles.some(staged => staged.tile_id === selectedTileId)) return;
    stageTile(tile, { row, col });
  }, [boardState, canStageMove, selectedTileId, stageTile, temporaryTiles]);

  /** A tap on a rack tile selects it (blanks first ask for their letter). */
  const selectTile = useCallback((tile: Tile) => {
    if (isBlankLetter(tile.letter)) {
      if (selectedTileId === tile.id) {
        setSelectedTileId(null);
      } else {
        setBlankPickerTarget({ tileId: tile.id });
      }
      return;
    }
    setSelectedTileId(previous => previous === tile.id ? null : tile.id);
  }, [selectedTileId]);

  const chooseBlankLetter = useCallback((chosenLetter: string) => {
    if (!blankPickerTarget) return;
    const { tileId, row, col } = blankPickerTarget;
    const upper = chosenLetter.toUpperCase();
    setDesignatedBlankLetters(previous => ({ ...previous, [tileId]: upper }));
    if (row !== undefined && col !== undefined) {
      setTemporaryTiles(previous => [
        ...previous.filter(tile => tile.tile_id !== tileId && !(tile.row === row && tile.col === col)),
        { row, col, tile_id: tileId, letter: upper, value: 0 },
      ]);
      setSelectedTileId(null);
      setSelectedCell({ row, col });
    } else {
      setSelectedTileId(tileId);
    }
    setBlankPickerTarget(null);
  }, [blankPickerTarget]);

  const closeBlankPicker = useCallback(() => setBlankPickerTarget(null), []);

  const clearSelection = useCallback(() => {
    setSelectedTileId(null);
    setSelectedCell(null);
  }, []);

  const deselectTile = useCallback(() => setSelectedTileId(null), []);

  /** Recalls every staged tile (Cancel) or forgets them once the move is committed. */
  const clearStagedMove = useCallback(() => {
    setTemporaryTiles([]);
    setSelectedTileId(null);
    setSelectedCell(null);
    setDesignatedBlankLetters({});
  }, []);

  /**
   * A new turn began. Tiles staged while waiting stay put, so when your turn comes you can confirm
   * them straight away (the new array makes the word check run again, now for real). Only tiles
   * whose cell another player just filled, or that are no longer in your rack (a card took them), go back.
   */
  const handleTurnChange = useCallback((state: GameState) => {
    setSelectedTileId(null);
    setSelectedCell(null);
    setValidationState(null);
    setValidationReason('');
    setEstimatedScore(0);
    const boardCells = state.board_state;
    const myRack = state.players.find(player => player.id === myPlayerId)?.rack;
    const rackTileIds = myRack ? new Set(myRack.map(tile => tile.id)) : null;
    setTemporaryTiles(previous => previous.filter(tile =>
      !boardCells[cellKey(tile.row, tile.col)] && (!rackTileIds || rackTileIds.has(tile.tile_id))
    ));
  }, [myPlayerId]);

  return {
    temporaryTiles,
    pendingTileIds,
    selectedTileId,
    selectedCell,
    estimatedScore,
    validationState,
    validationReason,
    blankPickerTarget,
    stageTile,
    swapStagedTiles,
    unstageTile,
    handleCellClick,
    selectTile,
    chooseBlankLetter,
    closeBlankPicker,
    clearSelection,
    deselectTile,
    clearStagedMove,
    handleTurnChange,
  };
}
