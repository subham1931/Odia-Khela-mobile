// Dash-guti ("ten pieces") – a capture game of the alquerque family, played on a
// Lau kata kati board (two triangles meeting at a centre point) with an extra arm out
// to each side: 21 points. Rules as described by Wikipedia after Murray (1952):
// compulsory captures by jumping, chained while possible. Pure TypeScript.

export type Side = 0 | 1;
export type Piece = Side | null;

export type DashMove = { kind: 'step'; from: number; to: number } | { kind: 'jump'; from: number; over: number; to: number };

export interface DashState {
  board: Piece[];
  turn: Side;
  /** Set mid-chain: this piece has just jumped and must jump again. */
  chainFrom: number | null;
  /** Pieces each side has captured. */
  captured: [number, number];
  plies: number;
  /** Moves since the last capture; at QUIET_LIMIT the game is decided on pieces. */
  quiet: number;
  winner: Side | 'draw' | null;
  /** Why the game ended (for the result screen). */
  reason: 'wipeout' | 'blocked' | 'quiet' | null;
}

export const PIECES = 10;
/**
 * "If neither player can capture any more, the player with more pieces wins." Spotting that
 * exactly is impractical, so: this many moves in a row with no capture ends the game.
 */
export const QUIET_LIMIT = 40;

// ---------------------------------------------------------------------------
// Board geometry
// ---------------------------------------------------------------------------

export interface DashPoint {
  id: number;
  /** Position for drawing, in board units: x across, y down; the centre is (0, 0). */
  x: number;
  y: number;
}

const pts: DashPoint[] = [];
const add = (x: number, y: number) => {
  pts.push({ id: pts.length, x, y });
  return pts.length - 1;
};

export const CENTRE = add(0, 0);
/** tri[side][rank 1–3][ray: 0 left, 1 middle, 2 right]. Side 0's triangle is the bottom one. */
const tri: number[][][] = [0, 1].map((side) => {
  const dir = side === 0 ? 1 : -1;
  return [0, 1, 2, 3].map((d) => (d === 0 ? [] : [-1, 0, 1].map((k) => add(k * d, dir * d))));
});
export const LEFT_ARM = add(-1.4, 0);
export const RIGHT_ARM = add(1.4, 0);
export const POINTS: DashPoint[] = pts;

/** Straight lines through the board, as ordered runs of points. Steps join neighbours; jumps take three in a row. */
export const LINES: number[][] = [
  // the vertical through the centre
  [tri[1][3][1], tri[1][2][1], tri[1][1][1], CENTRE, tri[0][1][1], tri[0][2][1], tri[0][3][1]],
  // the two long diagonals crossing at the centre (the triangles' sides)
  [tri[1][3][0], tri[1][2][0], tri[1][1][0], CENTRE, tri[0][1][2], tri[0][2][2], tri[0][3][2]],
  [tri[1][3][2], tri[1][2][2], tri[1][1][2], CENTRE, tri[0][1][0], tri[0][2][0], tri[0][3][0]],
  // the ranks across each triangle
  ...[0, 1].flatMap((side) => [1, 2, 3].map((d) => tri[side][d])),
  // the side arms
  [LEFT_ARM, CENTRE, RIGHT_ARM],
];

export const NEIGHBORS: number[][] = POINTS.map(() => []);
export const JUMPS: { over: number; to: number }[][] = POINTS.map(() => []);
for (const line of LINES) {
  for (let i = 0; i < line.length; i++) {
    for (const dir of [1, -1]) {
      const a = line[i + dir];
      const b = line[i + 2 * dir];
      if (a !== undefined && !NEIGHBORS[line[i]].includes(a)) NEIGHBORS[line[i]].push(a);
      if (a !== undefined && b !== undefined) JUMPS[line[i]].push({ over: a, to: b });
    }
  }
}

/** Every line segment once, for drawing. */
export const SEGMENTS: [number, number][] = LINES.flatMap((l) => l.slice(1).map((p, i) => [l[i], p] as [number, number]));

/** Starting points: each side's triangle (ranks 1–3) plus one arm. Only the centre is empty. */
export const START: Record<Side, number[]> = {
  0: [...tri[0][1], ...tri[0][2], ...tri[0][3], LEFT_ARM],
  1: [...tri[1][1], ...tri[1][2], ...tri[1][3], RIGHT_ARM],
};

export function createDashState(): DashState {
  const board: Piece[] = new Array(POINTS.length).fill(null);
  for (const side of [0, 1] as const) for (const p of START[side]) board[p] = side;
  return { board, turn: 0, chainFrom: null, captured: [0, 0], plies: 0, quiet: 0, winner: null, reason: null };
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

function jumpsFrom(board: Piece[], p: number): DashMove[] {
  const side = board[p];
  if (side === null) return [];
  return JUMPS[p].filter((j) => board[j.over] === 1 - side && board[j.to] === null).map((j) => ({ kind: 'jump', from: p, ...j }));
}

function movesFor(board: Piece[], side: Side): DashMove[] {
  const jumps: DashMove[] = [];
  const steps: DashMove[] = [];
  board.forEach((piece, p) => {
    if (piece !== side) return;
    jumps.push(...jumpsFrom(board, p));
    for (const q of NEIGHBORS[p]) if (board[q] === null) steps.push({ kind: 'step', from: p, to: q });
  });
  // Captures are compulsory: if any jump exists, only jumps are legal.
  return jumps.length ? jumps : steps;
}

export function legalDashMoves(s: DashState): DashMove[] {
  if (s.winner !== null) return [];
  if (s.chainFrom !== null) return jumpsFrom(s.board, s.chainFrom);
  return movesFor(s.board, s.turn);
}

export const sameDashMove = (a: DashMove, b: DashMove) => a.kind === b.kind && a.from === b.from && a.to === b.to;

/** Plays one step or one jump. After a jump the same piece keeps the turn while it can jump again. */
export function applyDashMove(s: DashState, m: DashMove): DashState {
  if (!legalDashMoves(s).some((l) => sameDashMove(l, m))) throw new Error(`Illegal move ${JSON.stringify(m)}`);
  const board = s.board.slice();
  board[m.to] = board[m.from];
  board[m.from] = null;
  const captured: [number, number] = [s.captured[0], s.captured[1]];
  let chainFrom: number | null = null;
  if (m.kind === 'jump') {
    board[m.over] = null;
    captured[s.turn]++;
    if (jumpsFrom(board, m.to).length) chainFrom = m.to;
  }
  const turn: Side = chainFrom !== null ? s.turn : s.turn === 0 ? 1 : 0;
  const next: DashState = {
    board,
    turn,
    chainFrom,
    captured,
    plies: s.plies + 1,
    quiet: m.kind === 'jump' ? 0 : s.quiet + 1,
    winner: null,
    reason: null,
  };
  return settle(next);
}

export const piecesOf = (board: Piece[], side: Side) => board.filter((p) => p === side).length;

function settle(s: DashState): DashState {
  if (s.chainFrom !== null) return s; // mid-chain: nothing is decided yet
  const left: [number, number] = [piecesOf(s.board, 0), piecesOf(s.board, 1)];
  if (left[0] === 0) return { ...s, winner: 1, reason: 'wipeout' };
  if (left[1] === 0) return { ...s, winner: 0, reason: 'wipeout' };
  if (movesFor(s.board, s.turn).length === 0) return { ...s, winner: s.turn === 0 ? 1 : 0, reason: 'blocked' };
  if (s.quiet >= QUIET_LIMIT) return { ...s, winner: left[0] === left[1] ? 'draw' : left[0] > left[1] ? 0 : 1, reason: 'quiet' };
  return s;
}

/** Pieces of `side` that an enemy could jump right now (warning markers). */
export function piecesInDanger(board: Piece[], side: Side): number[] {
  const out = new Set<number>();
  board.forEach((piece, p) => {
    if (piece === 1 - side) for (const j of jumpsFrom(board, p)) if (j.kind === 'jump') out.add(j.over);
  });
  return [...out];
}
