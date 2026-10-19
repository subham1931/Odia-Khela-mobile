// Bagha Chheli – Odisha's tiger-and-goats hunt game (the Bagh-Chal rule set).
// A different family from the mancala games: pieces move along the lines of a 5×5
// board of points. Pure TypeScript, no React/DOM, like the rest of /engine.

export type Side = 'goat' | 'tiger';
export type Piece = 'T' | 'G' | null;

export type HuntMove =
  | { kind: 'place'; to: number }
  | { kind: 'move'; from: number; to: number }
  | { kind: 'jump'; from: number; over: number; to: number };

export interface HuntState {
  /** 25 points, index = row * 5 + col, row 0 at the top. */
  board: Piece[];
  turn: Side;
  /** Goats not yet placed. While any remain, the goat player must place, not move. */
  goatsInHand: number;
  captured: number;
  /** Moves played by both sides; the game is drawn at MAX_PLIES. */
  plies: number;
  winner: Side | 'draw' | null;
}

export const SIZE = 5;
export const POINTS = SIZE * SIZE;
export const GOATS = 20;
export const TIGER_START = [0, 4, 20, 24];
/** Tigers win on their fifth capture. */
export const TIGERS_TO_WIN = 5;
/** No result after this many moves (both sides) is a draw – the game can otherwise cycle forever. */
export const MAX_PLIES = 200;

const row = (p: number) => Math.floor(p / SIZE);
const col = (p: number) => p % SIZE;
const at = (r: number, c: number) => (r >= 0 && r < SIZE && c >= 0 && c < SIZE ? r * SIZE + c : -1);

/** Diagonal lines run only through points whose row + col is even (the alquerque pattern). */
export const hasDiagonals = (p: number) => (row(p) + col(p)) % 2 === 0;

const ORTHO = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
] as const;
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

function directions(p: number) {
  return hasDiagonals(p) ? [...ORTHO, ...DIAG] : [...ORTHO];
}

/** Points joined to each point by a line. */
export const NEIGHBORS: number[][] = Array.from({ length: POINTS }, (_, p) =>
  directions(p)
    .map(([dr, dc]) => at(row(p) + dr, col(p) + dc))
    .filter((q) => q >= 0),
);

/** Straight-line jumps from each point: over the next point to the one beyond. */
export const JUMPS: { over: number; to: number }[][] = Array.from({ length: POINTS }, (_, p) =>
  directions(p)
    .map(([dr, dc]) => ({ over: at(row(p) + dr, col(p) + dc), to: at(row(p) + 2 * dr, col(p) + 2 * dc) }))
    .filter((j) => j.over >= 0 && j.to >= 0),
);

/** Every line segment on the board once, for drawing. */
export const LINES: [number, number][] = NEIGHBORS.flatMap((ns, p) => ns.filter((q) => q > p).map((q) => [p, q] as [number, number]));

export function createHuntState(): HuntState {
  const board: Piece[] = new Array(POINTS).fill(null);
  for (const p of TIGER_START) board[p] = 'T';
  return { board, turn: 'goat', goatsInHand: GOATS, captured: 0, plies: 0, winner: null };
}

function tigerMoves(board: Piece[], p: number): HuntMove[] {
  const out: HuntMove[] = [];
  for (const { over, to } of JUMPS[p]) {
    if (board[over] === 'G' && board[to] === null) out.push({ kind: 'jump', from: p, over, to });
  }
  for (const q of NEIGHBORS[p]) if (board[q] === null) out.push({ kind: 'move', from: p, to: q });
  return out;
}

/** Legal moves for the side to play (jumps listed first). Empty once the game is over. */
export function legalHuntMoves(s: HuntState): HuntMove[] {
  if (s.winner) return [];
  return movesFor(s, s.turn);
}

function movesFor(s: Pick<HuntState, 'board' | 'goatsInHand'>, side: Side): HuntMove[] {
  const out: HuntMove[] = [];
  if (side === 'tiger') {
    for (let p = 0; p < POINTS; p++) if (s.board[p] === 'T') out.push(...tigerMoves(s.board, p));
    return out.sort((a, b) => (a.kind === 'jump' ? 0 : 1) - (b.kind === 'jump' ? 0 : 1));
  }
  if (s.goatsInHand > 0) {
    for (let p = 0; p < POINTS; p++) if (s.board[p] === null) out.push({ kind: 'place', to: p });
    return out;
  }
  for (let p = 0; p < POINTS; p++) {
    if (s.board[p] !== 'G') continue;
    for (const q of NEIGHBORS[p]) if (s.board[q] === null) out.push({ kind: 'move', from: p, to: q });
  }
  return out;
}

/** Tigers with no move and no jump – the goats' whole aim is to trap all of them. */
export function trappedTigers(board: Piece[]): number[] {
  const out: number[] = [];
  for (let p = 0; p < POINTS; p++) if (board[p] === 'T' && tigerMoves(board, p).length === 0) out.push(p);
  return out;
}

/** Goats a tiger could take right now (the goat in the middle of an open jump). */
export function goatsInDanger(board: Piece[]): number[] {
  const out = new Set<number>();
  for (let p = 0; p < POINTS; p++) {
    if (board[p] !== 'T') continue;
    for (const m of tigerMoves(board, p)) if (m.kind === 'jump') out.add(m.over);
  }
  return [...out];
}

export function sameMove(a: HuntMove, b: HuntMove): boolean {
  if (a.kind !== b.kind || a.to !== b.to) return false;
  return a.kind === 'place' || (a as { from: number }).from === (b as { from: number }).from;
}

export function isLegalHuntMove(s: HuntState, m: HuntMove): boolean {
  return legalHuntMoves(s).some((l) => sameMove(l, m));
}

/** Plays one move and settles the result. Pure; throws on illegal moves (server-safe). */
export function applyHuntMove(s: HuntState, m: HuntMove): HuntState {
  if (!isLegalHuntMove(s, m)) throw new Error(`Illegal ${s.turn} move: ${JSON.stringify(m)}`);
  const board = s.board.slice();
  let { goatsInHand, captured } = s;
  if (m.kind === 'place') {
    board[m.to] = 'G';
    goatsInHand--;
  } else {
    board[m.to] = board[m.from];
    board[m.from] = null;
    if (m.kind === 'jump') {
      board[m.over] = null;
      captured++;
    }
  }
  const turn: Side = s.turn === 'goat' ? 'tiger' : 'goat';
  const next: HuntState = { board, turn, goatsInHand, captured, plies: s.plies + 1, winner: null };
  return { ...next, winner: decideWinner(next) };
}

function decideWinner(s: HuntState): HuntState['winner'] {
  if (s.captured >= TIGERS_TO_WIN) return 'tiger';
  // Whoever is to move but cannot, loses: trapped tigers lose; boxed-in goats lose.
  if (movesFor(s, s.turn).length === 0) return s.turn === 'tiger' ? 'goat' : 'tiger';
  if (s.plies >= MAX_PLIES) return 'draw';
  return null;
}

/** "Row 3, column 2"-style name for screen readers and captions. */
export function pointName(p: number): string {
  return `row ${row(p) + 1}, column ${col(p) + 1}`;
}

export { row as pointRow, col as pointCol };
