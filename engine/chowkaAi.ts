import {
  cellOf,
  type ChowkaMove,
  type ChowkaState,
  HOME,
  legalChowkaMoves,
  OFF,
  OUTER_END,
  SAFE_CELLS,
  type Seat,
  THROW_ODDS,
} from './chowka';
import type { AIDifficulty } from './types';

/**
 * Picks a move for the current throw. Chowka Bara is mostly luck, so instead of a deep
 * search the AI scores each move: Easy is random; Medium grabs captures, entries and
 * progress; Hard also weighs the odds of being hit next turn (from the shell odds) and
 * runs pawns out of danger.
 */
export function chooseChowkaMove(s: ChowkaState, difficulty: AIDifficulty, rng: () => number = Math.random): ChowkaMove {
  const moves = legalChowkaMoves(s);
  if (moves.length === 0) throw new Error('No legal moves');
  if (moves.length === 1 || difficulty === 'easy') return moves[Math.floor(rng() * moves.length)];
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const v = (difficulty === 'hard' ? hardScore(s, m) : mediumScore(m)) + rng() * 0.01;
    if (v > bestScore) {
      bestScore = v;
      best = m;
    }
  }
  return best;
}

function mediumScore(m: ChowkaMove): number {
  return m.captures.length * 100 + (m.to === HOME ? 60 : 0) + (m.enter ? 30 : 0) + (m.to - Math.max(m.from, 0));
}

/** Chance that a pawn of `seat` standing on board cell `cell` is hit before its next turn. */
export function riskAt(s: ChowkaState, seat: Seat, cell: number): number {
  if (SAFE_CELLS.has(cell)) return 0;
  let risk = 0;
  for (const o of s.seats) {
    if (o === seat) continue;
    for (const p of s.pawns[o]) {
      if (p === OFF || p === HOME) continue;
      for (const d of [1, 2, 3, 4, 8]) {
        const to = p + d;
        if (to >= HOME || (to > OUTER_END && !s.hasCaptured[o])) continue;
        if (cellOf(o, to) === cell) risk += THROW_ODDS[d];
      }
    }
  }
  return Math.min(1, risk);
}

function hardScore(s: ChowkaState, m: ChowkaMove): number {
  const me = s.turn;
  // What a pawn is worth grows with how far it has come (losing it costs that progress).
  const worth = (pos: number) => 15 + Math.max(pos, 0) * 2;
  let score = m.captures.reduce((sum, c) => sum + 80 + s.pawns[c.seat][c.pawn] * 3, 0);
  if (m.captures.length && !s.hasCaptured[me]) score += 60; // opens our gate to the inner ring
  if (m.to === HOME) score += 90;
  if (m.enter) score += 35;
  score += (m.to - Math.max(m.from, 0)) * 1.5;
  // Leave danger behind; don't step into it. Nothing can hit a pawn in the centre.
  const fromRisk = m.from === OFF ? 0 : riskAt(s, me, cellOf(me, m.from));
  const toRisk = m.to === HOME ? 0 : riskAt(s, me, cellOf(me, m.to));
  score += fromRisk * worth(m.from) - toRisk * worth(m.to);
  if (m.to !== HOME && SAFE_CELLS.has(cellOf(me, m.to))) score += 8;
  // Before our gate opens, a pawn parked at the gate is wasted; prefer keeping hunters behind.
  if (!s.hasCaptured[me] && m.to >= OUTER_END - 2) score -= 6;
  return score;
}
