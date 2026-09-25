'use client';

import React from 'react';
import { GameState } from '@/lib/types';

interface GameOverScreenProps {
  gameState: GameState;
  myPlayerId: string | null;
  onHome: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ gameState, myPlayerId, onHome }) => {
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
        onClick={onHome}
        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all"
      >
        Back to Home
      </button>
    </div>
  );
};
