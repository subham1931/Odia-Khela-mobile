import { getLegalMoves, opponent, ownerOf, sideOf, simulateMove } from './rules';
import type { AIDifficulty, GameState, MoveResult, Player } from './types';
import { getVariantConfig } from './variants';

export interface AIOptions {
  /** Wall-clock budget for the hard search (iterative deepening stops when it runs out). */
  timeBudgetMs?: number;
  /** Upper bound on search depth; defaults to 7 (Kasadi) / 6 (Lamlameta) / 9 (Kalah). */
  maxDepth?: number;
  rng?: () => number;
}

const WIN_SCORE = 10_000;

class SearchTimeout extends Error {}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function chooseMove(state: GameState, difficulty: AIDifficulty, opts: AIOptions = {}): number {
  const moves = getLegalMoves(state);
  if (moves.length === 0) throw new Error('No legal moves');
  const rng = opts.rng ?? Math.random;
  if (moves.length === 1) return moves[0];

  switch (difficulty) {
    case 'easy':
      return moves[Math.floor(rng() * moves.length)];
    case 'medium':
      return greedyMove(state, moves, rng);
    case 'hard':
      return searchMove(state, moves, opts, rng);
  }
}

/** Medium: maximise this turn's capture, breaking ties by the static evaluation. */
function greedyMove(state: GameState, moves: number[], rng: () => number): number {
  const me = state.activePlayer;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const r = simulateMove(state, m, { fast: true });
    const score = r.captured * 10 + evaluate(r.state, me) * 0.01 + rng() * 0.001;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

interface Child {
  move: number;
  result: MoveResult;
}

function expand(state: GameState): Child[] {
  return getLegalMoves(state)
    .map((move) => ({ move, result: simulateMove(state, move, { fast: true }) }))
    .sort((a, b) => b.result.captured - a.result.captured);
}

/** Hard: iterative-deepening minimax with alpha-beta pruning under a time budget. */
function searchMove(state: GameState, moves: number[], opts: AIOptions, rng: () => number): number {
  const me = state.activePlayer;
  const family = getVariantConfig(state.variant).family;
  // Kalah's 6-pit rows (and free turns) let the search afford more plies.
  const maxDepth = opts.maxDepth ?? (family === 'kalah' ? 9 : family === 'indian' ? 7 : 6);
  const deadline = now() + (opts.timeBudgetMs ?? 1200);

  // Vary play between equal moves by shuffling before the (stable) capture ordering.
  // Never add noise to scores: a pruned move's score is only an upper bound and must
  // not be nudged past the real best.
  let rootChildren = shuffle(expand(state), rng).sort((a, b) => b.result.captured - a.result.captured);
  let best = rootChildren[0]?.move ?? moves[0];

  for (let depth = 1; depth <= maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      let depthBest = best;
      const scored: { child: Child; score: number }[] = [];
      for (const child of rootChildren) {
        const score = minimax(child.result.state, depth - 1, alpha, Infinity, me, deadline);
        scored.push({ child, score });
        if (score > alpha) {
          alpha = score;
          depthBest = child.move;
        }
      }
      best = depthBest;
      // Search the strongest line first on the next iteration for better pruning.
      rootChildren = scored.sort((a, b) => b.score - a.score).map((s) => s.child);
      if (alpha >= WIN_SCORE / 2) break; // forced win found
    } catch (err) {
      if (err instanceof SearchTimeout) break;
      throw err;
    }
  }
  return best;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  me: Player,
  deadline: number,
): number {
  if (now() > deadline) throw new SearchTimeout();
  if (depth === 0 || state.turnPhase !== 'SELECT_PIT') return evaluate(state, me);

  const children = expand(state);
  if (state.activePlayer === me) {
    let value = -Infinity;
    for (const c of children) {
      value = Math.max(value, minimax(c.result.state, depth - 1, alpha, beta, me, deadline));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  let value = Infinity;
  for (const c of children) {
    value = Math.min(value, minimax(c.result.state, depth - 1, alpha, beta, me, deadline));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

/**
 * Static evaluation from `me`'s point of view:
 * store differential, counters still on each row (they return to their owner when the
 * round ends), mobility, and pit security (Lamlameta pairs are sweep targets).
 */
export function evaluate(state: GameState, me: Player): number {
  const opp = opponent(me);
  if (state.turnPhase === 'MATCH_OVER') {
    const diff = state.stores[me] - state.stores[opp];
    if (state.winner === 'draw') return diff;
    return (state.winner === me ? WIN_SCORE : -WIN_SCORE) + diff;
  }

  let score = state.stores[me] - state.stores[opp];
  if (state.turnPhase === 'ROUND_OVER') return score;

  const family = getVariantConfig(state.variant).family;
  const rowWeight = family === 'indian' ? 0.6 : family === 'kalah' ? 0.4 : 0.3;
  let mobility = 0;
  let security = 0;

  for (let p = 0; p < state.boardSize; p++) {
    if (state.deadPits[p]) continue;
    const c = state.pits[p];
    const sign = ownerOf(state, p) === me ? 1 : -1;
    score += sign * c * rowWeight;
    if (c > 0) mobility += sign;
    if (family === 'lamlameta' && c === 2) security -= sign; // pairs can be swept
  }
  // Live pits matter for next round's capacity.
  const live = (pl: Player) => sideOf(state, pl).filter((p) => !state.deadPits[p]).length;
  score += (live(me) - live(opp)) * 0.5;

  return score + mobility * 0.25 + security * 0.8;
}
