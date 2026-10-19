import type {
  BoardView,
  CaptureReason,
  GameOptions,
  GameState,
  MoveResult,
  Player,
  SowEvent,
} from './types';
import { getVariantConfig } from './variants';

/**
 * Safety valve for relay sowing. Relay chains can, in rare positions, cycle; after this
 * many re-pickups the turn simply ends with whatever is in hand dropped where it is.
 */
export const MAX_RELAY_PICKUPS = 400;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createInitialState(opts: GameOptions): GameState {
  const cfg = getVariantConfig(opts.variant);
  const seedsPerPit =
    cfg.family === 'lamlameta' || opts.seedsPerPit === undefined ? cfg.seedsPerPit : opts.seedsPerPit;
  const boardSize = cfg.pitsPerSide * 2;
  return {
    variant: opts.variant,
    boardSize,
    pitsPerSide: cfg.pitsPerSide,
    pits: new Array(boardSize).fill(seedsPerPit),
    stores: [0, 0],
    activePlayer: 0,
    turnPhase: 'SELECT_PIT',
    roundNumber: 1,
    deadPits: new Array(boardSize).fill(false),
    history: [],
    isVsAI: opts.isVsAI,
    aiDifficulty: opts.aiDifficulty,
    aiPlayer: opts.aiPlayer ?? 1,
    seedsPerPit,
    pasu: cfg.family === 'indian' ? (opts.pasu ?? cfg.pasu) : 'off',
    startingPlayer: 0,
    lastRound: null,
    winner: null,
  };
}

// ---------------------------------------------------------------------------
// Board geometry
// ---------------------------------------------------------------------------

export function ownerOf(state: Pick<GameState, 'pitsPerSide'>, pit: number): Player {
  return pit < state.pitsPerSide ? 0 : 1;
}

/** Pits belonging to a player, in that player's sowing order. */
export function sideOf(state: Pick<GameState, 'pitsPerSide'>, player: Player): number[] {
  const n = state.pitsPerSide;
  const start = player === 0 ? 0 : n;
  return Array.from({ length: n }, (_, k) => start + k);
}

export function oppositePit(state: Pick<GameState, 'boardSize'>, pit: number): number {
  return state.boardSize - 1 - pit;
}

/** Next pit counterclockwise (ascending index, wrapping), skipping dead pits. */
export function nextPit(state: Pick<GameState, 'boardSize' | 'deadPits'>, pit: number): number {
  let p = pit;
  for (let k = 0; k < state.boardSize; k++) {
    p = (p + 1) % state.boardSize;
    if (!state.deadPits[p]) return p;
  }
  return pit;
}

export function opponent(player: Player): Player {
  return player === 0 ? 1 : 0;
}

export function totalCounters(state: Pick<GameState, 'pits' | 'stores'>): number {
  return state.pits.reduce((a, b) => a + b, 0) + state.stores[0] + state.stores[1];
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export function isLegalMove(state: GameState, pit: number): boolean {
  return (
    state.turnPhase === 'SELECT_PIT' &&
    Number.isInteger(pit) &&
    pit >= 0 &&
    pit < state.boardSize &&
    ownerOf(state, pit) === state.activePlayer &&
    !state.deadPits[pit] &&
    state.pits[pit] > 0
  );
}

export function getLegalMoves(state: GameState): number[] {
  if (state.turnPhase !== 'SELECT_PIT') return [];
  return sideOf(state, state.activePlayer).filter((p) => !state.deadPits[p] && state.pits[p] > 0);
}

/** Stand-in for "the mover's store" in Kalah sowing order. */
export const STORE = -1;

/**
 * Next stop when sowing in Kalah: after your last pit comes your own store, and after
 * your store the opponent's first pit. The opponent's store is never sown into.
 */
export function kalahNext(state: Pick<GameState, 'pitsPerSide'>, mover: Player, pos: number): number {
  const n = state.pitsPerSide;
  if (pos === STORE) return mover === 0 ? n : 0;
  if (pos === (mover === 0 ? n - 1 : 2 * n - 1)) return STORE;
  return (pos + 1) % (2 * n);
}

/**
 * Pits that receive a counter from the initial handful – used for hover path projection.
 * In Kalah the mover's store is reported as STORE (-1).
 */
export function projectPath(state: GameState, pit: number): number[] {
  const path: number[] = [];
  const kalah = getVariantConfig(state.variant).family === 'kalah';
  let pos = pit;
  for (let k = 0; k < state.pits[pit]; k++) {
    pos = kalah ? kalahNext(state, state.activePlayer, pos) : nextPit(state, pos);
    path.push(pos);
  }
  return path;
}

export interface SimulateOptions {
  /** Skip event and history recording – used by the AI search. */
  fast?: boolean;
}

/**
 * Plays one complete turn (including all relay laps and captures) and resolves the
 * end of round/match if the next player is left without a move. Pure: never mutates
 * the input state. Throws on illegal moves so servers can use it for validation.
 */
export function simulateMove(state: GameState, pit: number, opts: SimulateOptions = {}): MoveResult {
  if (!isLegalMove(state, pit)) {
    throw new Error(`Illegal move: pit ${pit} for player ${state.activePlayer}`);
  }
  const cfg = getVariantConfig(state.variant);
  const pits = state.pits.slice();
  const stores: [number, number] = [state.stores[0], state.stores[1]];
  const events: SowEvent[] = [];
  const emit = opts.fast ? () => {} : (e: SowEvent) => events.push(e);
  const me = state.activePlayer;
  let captured = 0;

  const capture = (p: number, reason: CaptureReason, to: Player = me) => {
    const count = pits[p];
    if (count === 0) return;
    pits[p] = 0;
    stores[to] += count;
    if (to === me) captured += count;
    emit({ type: 'capture', pit: p, count, player: to, reason });
  };

  let hand = pits[pit];
  pits[pit] = 0;
  emit({ type: 'pickup', pit, count: hand, relay: false });
  let pos = pit;
  let pickups = 0;

  if (cfg.family === 'indian') {
    for (;;) {
      while (hand > 0) {
        pos = nextPit(state, pos);
        pits[pos]++;
        hand--;
        emit({ type: 'drop', pit: pos });
        if (state.pasu !== 'off' && pits[pos] === 4) {
          capture(pos, 'pasu', state.pasu === 'pit_owner' ? ownerOf(state, pos) : me);
        }
      }
      const n1 = nextPit(state, pos);
      if (pits[n1] > 0) {
        // Relay: lift the following pit and keep sowing.
        if (++pickups > MAX_RELAY_PICKUPS) {
          emit({ type: 'halt', pit: pos, reason: 'loop_limit' });
          break;
        }
        hand = pits[n1];
        pits[n1] = 0;
        emit({ type: 'pickup', pit: n1, count: hand, relay: true });
        pos = n1;
        continue;
      }
      const n2 = nextPit(state, n1);
      if (pits[n2] > 0) {
        emit({ type: 'reveal', rule: 'gap', last: pos, gap: n1, target: n2, count: pits[n2] });
        capture(n2, 'empty_gap');
        emit({ type: 'halt', pit: n2, reason: 'capture' });
      } else {
        emit({ type: 'halt', pit: n1, reason: 'kada' });
      }
      break;
    }
  } else if (cfg.family === 'kalah') {
    // Sow through your own store (never the opponent's), one seed per stop.
    let inStore = false;
    while (hand > 0) {
      const next = kalahNext(state, me, inStore ? STORE : pos);
      inStore = next === STORE;
      if (inStore) {
        stores[me]++;
        captured++;
        emit({ type: 'store_drop', player: me });
      } else {
        pos = next;
        pits[pos]++;
        emit({ type: 'drop', pit: pos });
      }
      hand--;
    }
    const opp = oppositePit(state, pos);
    if (inStore) {
      emit({ type: 'reveal', rule: 'extra_turn', player: me });
      emit({ type: 'halt', pit: pos, reason: 'extra_turn' });
    } else if (ownerOf(state, pos) === me && pits[pos] === 1 && pits[opp] > 0) {
      // Last seed in your own empty pit, opposite pit occupied: take both.
      emit({ type: 'reveal', rule: 'opposite', landing: pos, opposite: opp, count: pits[opp] + 1 });
      capture(opp, 'opposite');
      capture(pos, 'opposite');
      emit({ type: 'halt', pit: pos, reason: 'capture' });
    } else {
      emit({ type: 'halt', pit: pos, reason: 'sown' });
    }
    const afterKalah: GameState = {
      ...state,
      pits,
      stores,
      activePlayer: inStore ? me : opponent(me),
      history: opts.fast
        ? state.history
        : [...state.history, { player: me, pit, round: state.roundNumber, captured }],
    };
    return { state: resolveEndOfTurn(afterKalah, emit), events, captured };
  } else {
    for (;;) {
      while (hand > 0) {
        pos = nextPit(state, pos);
        pits[pos]++;
        hand--;
        emit({ type: 'drop', pit: pos });
      }
      if (pits[pos] > 1) {
        // Landed on an occupied pit: lift everything there and continue.
        if (++pickups > MAX_RELAY_PICKUPS) {
          emit({ type: 'halt', pit: pos, reason: 'loop_limit' });
          break;
        }
        hand = pits[pos];
        pits[pos] = 0;
        emit({ type: 'pickup', pit: pos, count: hand, relay: true });
        continue;
      }
      const opp = oppositePit(state, pos);
      if (ownerOf(state, pos) === me && pits[opp] === 2) {
        // The Sweep: take the opposite pair and every other pair in the opponent's row.
        const pairs = [opp, ...sideOf(state, opponent(me)).filter((p) => p !== opp && pits[p] === 2)];
        emit({ type: 'reveal', rule: 'sweep', landing: pos, opposite: opp, pairs, count: pairs.length * 2 });
        for (const p of pairs) capture(p, 'sweep');
        emit({ type: 'halt', pit: pos, reason: 'capture' });
      } else {
        emit({ type: 'halt', pit: pos, reason: 'empty_landing' });
      }
      break;
    }
  }

  const afterMove: GameState = {
    ...state,
    pits,
    stores,
    activePlayer: opponent(me),
    history: opts.fast
      ? state.history
      : [...state.history, { player: me, pit, round: state.roundNumber, captured }],
  };
  return { state: resolveEndOfTurn(afterMove, emit), events, captured };
}

/**
 * If the player to move has no legal pit, the round ends: every counter left on the
 * board goes to the owner of its row. Indian variants then go to ROUND_OVER (or
 * MATCH_OVER if someone cannot refill a single pit); Lamlameta ends the match.
 * Kalah instead ends as soon as either row is empty, with the same banking of seeds.
 */
function resolveEndOfTurn(state: GameState, emit: (e: SowEvent) => void): GameState {
  if (getVariantConfig(state.variant).family === 'kalah') {
    // Kalah ends as soon as either row is empty, whoever is to move.
    const rowEmpty = (pl: Player) => sideOf(state, pl).every((p) => state.pits[p] === 0);
    if (!rowEmpty(0) && !rowEmpty(1)) return state;
  } else if (getLegalMoves(state).length > 0) {
    return state;
  }

  const pits = state.pits.slice();
  const stores: [number, number] = [state.stores[0], state.stores[1]];
  for (let p = 0; p < pits.length; p++) {
    if (pits[p] > 0) {
      const owner = ownerOf(state, p);
      emit({ type: 'capture', pit: p, count: pits[p], player: owner, reason: 'round_end' });
      stores[owner] += pits[p];
      pits[p] = 0;
    }
  }
  const leader: Player | 'draw' = stores[0] === stores[1] ? 'draw' : stores[0] > stores[1] ? 0 : 1;
  const lastRound = { round: state.roundNumber, winner: leader, stores };
  const base = { ...state, pits, stores, lastRound };

  if (!getVariantConfig(state.variant).multiRound) {
    return { ...base, turnPhase: 'MATCH_OVER', winner: leader };
  }
  const canRefill = [stores[0] >= state.seedsPerPit, stores[1] >= state.seedsPerPit];
  if (!canRefill[0] || !canRefill[1]) {
    const winner: Player | 'draw' = canRefill[0] === canRefill[1] ? leader : canRefill[0] ? 0 : 1;
    return { ...base, turnPhase: 'MATCH_OVER', winner };
  }
  return { ...base, turnPhase: 'ROUND_OVER' };
}

/**
 * Round attrition ("Andha Ghara" / "Kottai"): each player refills their pits from
 * their store in sowing order. Pits they cannot fill completely become dead for the
 * next round; any remainder stays in the store as reserve.
 */
export function startNextRound(state: GameState): GameState {
  if (state.turnPhase !== 'ROUND_OVER') throw new Error('Round is not over');
  const pits = new Array(state.boardSize).fill(0);
  const deadPits = new Array(state.boardSize).fill(true);
  const stores: [number, number] = [state.stores[0], state.stores[1]];
  for (const player of [0, 1] as const) {
    const side = sideOf(state, player);
    const fill = Math.min(side.length, Math.floor(stores[player] / state.seedsPerPit));
    for (let k = 0; k < fill; k++) {
      pits[side[k]] = state.seedsPerPit;
      deadPits[side[k]] = false;
    }
    stores[player] -= fill * state.seedsPerPit;
  }
  const startingPlayer = opponent(state.startingPlayer);
  return {
    ...state,
    pits,
    stores,
    deadPits,
    roundNumber: state.roundNumber + 1,
    activePlayer: startingPlayer,
    startingPlayer,
    turnPhase: 'SELECT_PIT',
  };
}

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

export function viewOf(state: GameState): BoardView {
  return { pits: state.pits.slice(), stores: [state.stores[0], state.stores[1]], hand: 0, handPit: null };
}

/** Applies one SowEvent to a board view; replaying all events of a move reproduces its result. */
export function applyEvent(view: BoardView, e: SowEvent): BoardView {
  const pits = view.pits.slice();
  const stores: [number, number] = [view.stores[0], view.stores[1]];
  switch (e.type) {
    case 'pickup':
      pits[e.pit] -= e.count;
      return { pits, stores, hand: view.hand + e.count, handPit: e.pit };
    case 'drop':
      pits[e.pit] += 1;
      return { pits, stores, hand: view.hand - 1, handPit: e.pit };
    case 'store_drop':
      stores[e.player] += 1;
      return { pits, stores, hand: view.hand - 1, handPit: null };
    case 'capture':
      pits[e.pit] -= e.count;
      stores[e.player] += e.count;
      return { pits, stores, hand: view.hand, handPit: view.handPit };
    case 'halt':
      return { pits, stores, hand: 0, handPit: null };
    case 'reveal':
      return view;
  }
}
