'use client';

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { GameState } from '@/lib/types';

interface GameOverScreenProps {
  gameState: GameState;
  myPlayerId: string | null;
  onHome: () => void;
  /** Leave out for spectators: they hold no seat to carry into another round. */
  onPlayAgain?: () => Promise<void>;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ gameState, myPlayerId, onHome, onPlayAgain }) => {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const sorted = [...(gameState.players ?? [])].sort((a, b) => b.score - a.score);
  // The server decides the winner: knocked-out players and players who left cannot win,
  // so the top score is not necessarily the winner.
  const winner = gameState.players.find(p => p.id === gameState.winner_id);
  const rematchPin = gameState.rematch_pin;

  const handlePlayAgain = async () => {
    if (!onPlayAgain) return;
    setJoining(true);
    setError('');
    try {
      await onPlayAgain();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start a new game');
      setJoining(false);
    }
  };

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
      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        {onPlayAgain && rematchPin && (
          <p className="text-center text-sm text-emerald-300">
            A new lobby is open (PIN <span className="font-mono font-bold">{rematchPin}</span>). Play again to join it.
          </p>
        )}
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          {onPlayAgain && (
            <button
              onClick={handlePlayAgain}
              disabled={joining}
              className="flex flex-1 items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold rounded-2xl transition-all"
            >
              <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
              {joining ? (rematchPin ? 'Joining...' : 'Starting...') : 'Play Again'}
            </button>
          )}
          <button
            onClick={onHome}
            disabled={joining}
            className={`flex-1 px-8 py-3 font-bold rounded-2xl transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              onPlayAgain
                ? 'border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
