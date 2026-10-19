import { applyHuntMove, goatsInDanger, type HuntMove, type HuntState, legalHuntMoves, type Side, trappedTigers } from './hunt';
import type { AIDifficulty } from './types';

export interface HuntAIOptions {
  timeBudgetMs?: number;
  maxDepth?: number;
  rng?: () => number;
}

const WIN = 10_000;
class SearchTimeout extends Error {}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function chooseHuntMove(s: HuntState, difficulty: AIDifficulty, opts: HuntAIOptions = {}): HuntMove {
  const moves = legalHuntMoves(s);
  if (moves.length === 0) throw new Error('No legal moves');
  const rng = opts.rng ?? Math.random;
  if (moves.length === 1) return moves[0];
  if (difficulty === 'easy') return moves[Math.floor(rng() * moves.length)];
  if (difficulty === 'medium') return greedy(s, moves, rng);
  return search(s, moves, opts, rng);
}

/**
 * Static evaluation from the tigers' point of view (goats negate it): captures matter
 * most, then goats left hanging, tiger freedom, and – the goats' real weapon – trapped tigers.
 */
export function evaluateHunt(s: HuntState): number {
  if (s.winner === 'tiger') return WIN - s.plies;
  if (s.winner === 'goat') return -WIN + s.plies;
  if (s.winner === 'draw') return 0;
  const trapped = trappedTigers(s.board).length;
  const danger = goatsInDanger(s.board).length;
  let mobility = 0;
  for (const m of legalHuntMovesFor(s, 'tiger')) mobility += m.kind === 'jump' ? 2 : 1;
  return s.captured * 120 + danger * 35 + mobility * 3 - trapped * 45;
}

function legalHuntMovesFor(s: HuntState, side: Side): HuntMove[] {
  return s.turn === side ? legalHuntMoves(s) : legalHuntMoves({ ...s, turn: side });
}

const score = (s: HuntState, side: Side) => (side === 'tiger' ? evaluateHunt(s) : -evaluateHunt(s));

/** Medium: one-ply lookahead with the static evaluation (tigers grab captures; goats avoid hanging pieces). */
function greedy(s: HuntState, moves: HuntMove[], rng: () => number): HuntMove {
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const next = applyHuntMove(s, m);
    // Look at the opponent's best immediate reply too, so goats don't walk into a jump.
    let reply = score(next, s.turn);
    if (!next.winner) {
      for (const r of legalHuntMoves(next)) reply = Math.min(reply, score(applyHuntMove(next, r), s.turn));
    }
    const v = reply + rng() * 0.5;
    if (v > bestScore) {
      bestScore = v;
      best = m;
    }
  }
  return best;
}

/** Hard: iterative-deepening negamax with alpha-beta pruning under a time budget. */
function search(s: HuntState, moves: HuntMove[], opts: HuntAIOptions, rng: () => number): HuntMove {
  const deadline = now() + (opts.timeBudgetMs ?? 1200);
  const maxDepth = opts.maxDepth ?? 8;
  // Shuffle once for variety between equal moves; never perturb scores (see ai.ts).
  let order = moves.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.sort((a, b) => (a.kind === 'jump' ? 0 : 1) - (b.kind === 'jump' ? 0 : 1));
  let best = order[0];

  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      let depthBest = best;
      const scored: { m: HuntMove; v: number }[] = [];
      for (const m of order) {
        const v = -negamax(applyHuntMove(s, m), depth - 1, -Infinity, -alpha, deadline);
        scored.push({ m, v });
        if (v > alpha) {
          alpha = v;
          depthBest = m;
        }
      }
      best = depthBest;
      order = scored.sort((a, b) => b.v - a.v).map((x) => x.m);
      if (alpha >= WIN / 2) break;
    } catch (err) {
      if (err instanceof SearchTimeout) break;
      throw err;
    }
  }
  return best;
}

function negamax(s: HuntState, depth: number, alpha: number, beta: number, deadline: number): number {
  if (now() > deadline) throw new SearchTimeout();
  if (depth === 0 || s.winner) return score(s, s.turn);
  let value = -Infinity;
  for (const m of legalHuntMoves(s)) {
    value = Math.max(value, -negamax(applyHuntMove(s, m), depth - 1, -beta, -alpha, deadline));
    alpha = Math.max(alpha, value);
    if (alpha >= beta) break;
  }
  return value;
}
