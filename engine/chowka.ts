// Chowka Bara (Ashta Chamma) – the cowrie-shell race game, Classic rules.
// A third family alongside mancala and the hunt game: 2–4 players race four pawns round
// a 5×5 board – anticlockwise round the outer ring, clockwise round the inner ring – to
// the centre. Pure TypeScript, no React/DOM.

export type Seat = 0 | 1 | 2 | 3;

export interface ChowkaState {
  /** Seats in play, in turn order (anticlockwise round the board). */
  seats: Seat[];
  /** pawns[seat][i]: OFF before entering, 0–23 along the seat's path, HOME once in the centre. */
  pawns: number[][];
  /** The inner-ring "gate": a seat may go inside only after capturing at least once. */
  hasCaptured: boolean[];
  turn: Seat;
  phase: 'throw' | 'move';
  /** Current throw (set in the move phase). */
  throwValue: number | null;
  /** Bonus throws earned this turn (from a 4, an 8 or a capture). */
  extraThrows: number;
  winner: Seat | 'draw' | null;
  /** Throws taken so far, all seats. */
  throws: number;
}

export type ChowkaMove = { pawn: number; from: number; to: number; enter: boolean; captures: { seat: Seat; pawn: number }[] };

export const SIZE = 5;
export const PAWNS = 4;
export const OFF = -1;
/** Path index of the centre square. */
export const HOME = 24;
/** Last path index of the outer ring; going past it needs the gate open. */
export const OUTER_END = 15;
/** Throws that bring a pawn onto the board and earn another throw. */
export const ENTRY_THROWS = [4, 8];
/** Safety net: if no pawn can get past its gate, the game could stall – call it a draw. */
export const MAX_THROWS = 1500;

export const cell = (r: number, c: number) => r * SIZE + c;

/** Seat 0's path: outer ring anticlockwise from its start square, inner ring clockwise, centre. */
const SEAT0_PATH: [number, number][] = [
  [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3],
  [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1],
  [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2],
  [2, 2],
];

/** Rotate a square a quarter turn anticlockwise about the centre: the bottom start → the right start. */
const rotate = ([r, c]: [number, number]): [number, number] => [SIZE - 1 - c, r];

/** PATHS[seat][i] = board cell (row * 5 + col) of path step i. Seats: 0 bottom, 1 right, 2 top, 3 left. */
export const PATHS: number[][] = [0, 1, 2, 3].map((seat) => {
  let pts = SEAT0_PATH;
  for (let k = 0; k < seat; k++) pts = pts.map(rotate);
  return pts.map(([r, c]) => cell(r, c));
});

export const START_CELLS = PATHS.map((p) => p[0]);
export const CENTRE = cell(2, 2);
/** Crossed squares: the four start squares and the centre. No capturing there. */
export const SAFE_CELLS = new Set([...START_CELLS, CENTRE]);

export function seatsFor(players: 2 | 3 | 4): Seat[] {
  return players === 2 ? [0, 2] : players === 3 ? [0, 1, 2] : [0, 1, 2, 3];
}

export function createChowkaState(players: 2 | 3 | 4): ChowkaState {
  const seats = seatsFor(players);
  return {
    seats,
    pawns: [0, 1, 2, 3].map(() => new Array(PAWNS).fill(OFF)),
    hasCaptured: [false, false, false, false],
    turn: seats[0],
    phase: 'throw',
    throwValue: null,
    extraThrows: 0,
    winner: null,
    throws: 0,
  };
}

/** Four cowries: each lands mouth-up or mouth-down. Ups count 1 each; all four up = 4, none up = 8. */
export function scoreShells(mouthsUp: boolean[]): number {
  const up = mouthsUp.filter(Boolean).length;
  return up === 0 ? 8 : up;
}

export function throwShells(rng: () => number = Math.random): { shells: boolean[]; value: number } {
  const shells = Array.from({ length: 4 }, () => rng() < 0.5);
  return { shells, value: scoreShells(shells) };
}

/** Chance of each throw value with four fair shells. */
export const THROW_ODDS: Record<number, number> = { 1: 4 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16, 8: 1 / 16 };

export const cellOf = (seat: Seat, pos: number) => PATHS[seat][pos];

/** Opposing pawns that would be sent home by `seat` landing on `to`. */
function capturesAt(s: ChowkaState, seat: Seat, to: number): ChowkaMove['captures'] {
  const target = cellOf(seat, to);
  if (SAFE_CELLS.has(target)) return [];
  const out: ChowkaMove['captures'] = [];
  for (const other of s.seats) {
    if (other === seat) continue;
    s.pawns[other].forEach((pos, pawn) => {
      if (pos >= 0 && pos < HOME && cellOf(other, pos) === target) out.push({ seat: other, pawn });
    });
  }
  return out;
}

/** Legal moves for the current throw. Pawns in the same place give the same move, so only one is listed. */
export function legalChowkaMoves(s: ChowkaState): ChowkaMove[] {
  if (s.phase !== 'move' || s.throwValue === null || s.winner !== null) return [];
  const v = s.throwValue;
  const seat = s.turn;
  const seen = new Set<number>();
  const out: ChowkaMove[] = [];
  s.pawns[seat].forEach((pos, pawn) => {
    if (pos === HOME || seen.has(pos)) return;
    let to: number;
    if (pos === OFF) {
      if (!ENTRY_THROWS.includes(v)) return;
      to = 0;
    } else {
      to = pos + v;
      if (to > HOME) return; // the centre needs an exact throw
      if (to > OUTER_END && !s.hasCaptured[seat]) return; // the gate: capture first
    }
    seen.add(pos);
    out.push({ pawn, from: pos, to, enter: pos === OFF, captures: capturesAt(s, seat, to) });
  });
  return out;
}

/** Would this pawn's move be refused only because the gate is still closed? (For hints.) */
export function blockedByGate(s: ChowkaState): number[] {
  if (s.phase !== 'move' || s.throwValue === null || s.hasCaptured[s.turn]) return [];
  return s.pawns[s.turn].flatMap((pos, pawn) =>
    pos >= 0 && pos <= OUTER_END && pos + s.throwValue! > OUTER_END && pos + s.throwValue! <= HOME ? [pawn] : [],
  );
}

/** Records a throw. A 4 or 8 banks a bonus throw. With no legal move the turn simply moves on. */
export function applyThrow(s: ChowkaState, value: number): ChowkaState {
  if (s.phase !== 'throw' || s.winner !== null) throw new Error('Not time to throw');
  if (![1, 2, 3, 4, 8].includes(value)) throw new Error(`Impossible throw ${value}`);
  const next: ChowkaState = {
    ...s,
    phase: 'move',
    throwValue: value,
    extraThrows: s.extraThrows + (ENTRY_THROWS.includes(value) ? 1 : 0),
    throws: s.throws + 1,
  };
  return legalChowkaMoves(next).length ? next : endMove(next);
}

export function applyChowkaMove(s: ChowkaState, m: ChowkaMove): ChowkaState {
  const legal = legalChowkaMoves(s).find((l) => l.from === m.from && l.to === m.to);
  if (!legal) throw new Error(`Illegal move ${JSON.stringify(m)}`);
  const pawns = s.pawns.map((p) => p.slice());
  pawns[s.turn][m.pawn] = legal.to;
  for (const c of legal.captures) pawns[c.seat][c.pawn] = OFF;
  const captured = legal.captures.length > 0;
  const hasCaptured = s.hasCaptured.slice();
  if (captured) hasCaptured[s.turn] = true;
  const winner = pawns[s.turn].every((p) => p === HOME) ? s.turn : null;
  return endMove({ ...s, pawns, hasCaptured, winner, extraThrows: s.extraThrows + (captured ? 1 : 0) });
}

/** After a move (or a throw with no move): use a banked bonus throw, or pass to the next seat. */
function endMove(s: ChowkaState): ChowkaState {
  const base = { ...s, phase: 'throw' as const, throwValue: null };
  if (s.winner !== null) return { ...base, extraThrows: 0 };
  if (s.throws >= MAX_THROWS || isDeadlocked(s)) return { ...base, extraThrows: 0, winner: 'draw' };
  if (s.extraThrows > 0) return { ...base, extraThrows: s.extraThrows - 1 };
  const i = s.seats.indexOf(s.turn);
  return { ...base, extraThrows: 0, turn: s.seats[(i + 1) % s.seats.length] };
}

/**
 * True when no pawn on the board can ever move again: every pawn is home or parked at a gate
 * its owner can't pass (and none is waiting to enter). Nobody can capture, so the game is drawn.
 * Happens mostly with two players, who start opposite each other.
 */
export function isDeadlocked(s: ChowkaState): boolean {
  return s.seats.every((seat) =>
    s.pawns[seat].every((pos) => pos === HOME || (pos !== OFF && pos + 1 > (s.hasCaptured[seat] ? HOME : OUTER_END))),
  );
}

/** Pawns still to travel for a seat (lower is better) – used by the AI and for progress bars. */
export function distanceLeft(s: ChowkaState, seat: Seat): number {
  return s.pawns[seat].reduce((sum, pos) => sum + (pos === OFF ? HOME + 1 : HOME - pos), 0);
}

export const SEAT_NAMES = ['Crimson', 'Emerald', 'Indigo', 'Saffron'] as const;
