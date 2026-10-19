// Web Worker entry: runs the AI search off the main thread so animations never stutter.
import { chooseMove } from './ai';
import type { HuntMove, HuntState } from './hunt';
import { chooseHuntMove } from './huntAi';
import type { AIDifficulty, GameState } from './types';

export type AIRequest =
  | { id: number; kind?: 'mancala'; state: GameState; difficulty: AIDifficulty }
  | { id: number; kind: 'hunt'; state: HuntState; difficulty: AIDifficulty };

export interface AIResponse {
  id: number;
  pit?: number;
  move?: HuntMove;
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<AIRequest>) => void) | null;
  postMessage: (msg: AIResponse) => void;
};

ctx.onmessage = (e) => {
  const req = e.data;
  try {
    if (req.kind === 'hunt') ctx.postMessage({ id: req.id, move: chooseHuntMove(req.state, req.difficulty) });
    else ctx.postMessage({ id: req.id, pit: chooseMove(req.state, req.difficulty) });
  } catch (err) {
    ctx.postMessage({ id: req.id, error: err instanceof Error ? err.message : String(err) });
  }
};
