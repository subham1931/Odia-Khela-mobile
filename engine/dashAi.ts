import { applyDashMove, type DashMove, type DashState, legalDashMoves, piecesInDanger, piecesOf, QUIET_LIMIT, type Side } from './dash';
import type { AIDifficulty } from './types';

export interface DashAIOptions {
  timeBudgetMs?: number;
  maxDepth?: number;
  rng?: () => number;
}

const WIN = 10_000;
class SearchTimeout extends Error {}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Static score for `side`: material first, then pieces left hanging and freedom to move. */
export function evaluateDash(s: DashState, side: Side): number {
  const other: Side = side === 0 ? 1 : 0;
  if (s.winner === side) return WIN - s.plies;
  if (s.winner === other) return -WIN + s.plies;
  if (s.winner === 'draw') return 0;
  const material = piecesOf(s.board, side) - piecesOf(s.board, other);
  const hanging = piecesInDanger(s.board, other).length - piecesInDanger(s.board, side).length;
  // Near the quiet-move limit, material decides the game: make it count for more.
  const urgency = s.quiet > QUIET_LIMIT - 10 ? 1.5 : 1;
  return material * 100 * urgency + hanging * (s.turn === side ? 30 : 12);
}

export function chooseDashMove(s: DashState, difficulty: AIDifficulty, opts: DashAIOptions = {}): DashMove {
  const moves = legalDashMoves(s);
  if (moves.length === 0) throw new Error('No legal moves');
  const rng = opts.rng ?? Math.random;
  if (moves.length === 1 || difficulty === 'easy') return moves[Math.floor(rng() * moves.length)];
  const depth = difficulty === 'medium' ? 2 : (opts.maxDepth ?? 9);
  return search(s, moves, depth, difficulty === 'medium' ? 200 : (opts.timeBudgetMs ?? 1000), rng);
}

function search(s: DashState, moves: DashMove[], maxDepth: number, budget: number, rng: () => number): DashMove {
  const deadline = now() + budget;
  const me = s.turn;
  let order = moves.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let best = order[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      let depthBest = best;
      const scored: { m: DashMove; v: number }[] = [];
      for (const m of order) {
        const v = value(applyDashMove(s, m), me, depth - 1, alpha, Infinity, deadline);
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

/**
 * Minimax value for `me`. A chain jump leaves the turn with the same side, so we
 * maximise or minimise by whose turn it actually is rather than alternating blindly.
 * Chain continuations don't use up depth – a half-finished chain is never scored.
 */
function value(s: DashState, me: Side, depth: number, alpha: number, beta: number, deadline: number): number {
  if (now() > deadline) throw new SearchTimeout();
  if (s.winner !== null || (depth <= 0 && s.chainFrom === null)) return evaluateDash(s, me);
  const next = s.chainFrom !== null ? depth : depth - 1;
  const moves = legalDashMoves(s);
  if (s.turn === me) {
    let v = -Infinity;
    for (const m of moves) {
      v = Math.max(v, value(applyDashMove(s, m), me, next, alpha, beta, deadline));
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  }
  let v = Infinity;
  for (const m of moves) {
    v = Math.min(v, value(applyDashMove(s, m), me, next, alpha, beta, deadline));
    beta = Math.min(beta, v);
    if (alpha >= beta) break;
  }
  return v;
}
