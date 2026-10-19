// Core types shared by the rules engine, the AI, the UI and (later) the realtime server.
// Everything in /engine is pure TypeScript with no React or DOM dependencies.

export type GameVariant = 'kasadi' | 'lamlameta' | 'kalah';

export type RuleFamily = 'indian' | 'lamlameta' | 'kalah';

export type Player = 0 | 1;

export type TurnPhase = 'SELECT_PIT' | 'SOWING_ANIMATION' | 'ROUND_OVER' | 'MATCH_OVER';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Pasu (cow) rule: a pit that reaches exactly 4 counters mid-sowing is claimed.
 * - off:       no Pasu captures
 * - pit_owner: the owner of the pit's row claims it
 * - sower:     the player currently sowing claims it
 */
export type PasuRule = 'off' | 'pit_owner' | 'sower';

export interface VariantConfig {
  id: GameVariant;
  name: string;
  region: string;
  family: RuleFamily;
  pitsPerSide: number;
  seedsPerPit: number;
  seedsPerPitOptions: number[];
  pasu: PasuRule;
  /** Indian variants play several rounds with dead-pit attrition; Lamlameta is one round. */
  multiRound: boolean;
  description: string;
}

export interface GameOptions {
  variant: GameVariant;
  seedsPerPit?: number;
  pasu?: PasuRule;
  isVsAI: boolean;
  aiDifficulty: AIDifficulty;
  /** Which seat the machine plays. Defaults to 1 (top row). */
  aiPlayer?: Player;
}

export type CaptureReason = 'empty_gap' | 'pasu' | 'sweep' | 'opposite' | 'round_end';

export type HaltReason = 'capture' | 'kada' | 'empty_landing' | 'loop_limit' | 'extra_turn' | 'sown';

/**
 * Emitted just before a capture to explain *why* it happens, so the UI can point at the
 * pits involved. It changes nothing on the board.
 * - gap (Kasadi): the hand ran out at `last`, `gap` is the empty pit, `target` is taken.
 * - sweep (Lamlameta): last seed landed in the mover's empty pit `landing`; `opposite`
 *   held exactly two, and `pairs` (opposite first) are every pit taken.
 * - opposite (Kalah): last seed landed in the mover's empty pit `landing` and `opposite`
 *   has seeds; both are taken (`count` includes the landing seed).
 * - extra_turn (Kalah): last seed landed in `player`'s own store, so they move again.
 *   Not a capture, but announced the same way so it is never missed.
 */
export type RevealEvent =
  | { type: 'reveal'; rule: 'gap'; last: number; gap: number; target: number; count: number }
  | { type: 'reveal'; rule: 'sweep'; landing: number; opposite: number; pairs: number[]; count: number }
  | { type: 'reveal'; rule: 'opposite'; landing: number; opposite: number; count: number }
  | { type: 'reveal'; rule: 'extra_turn'; player: Player };

/** Atomic steps of a move, replayed one by one by the UI to animate sowing. */
export type SowEvent =
  | { type: 'pickup'; pit: number; count: number; relay: boolean }
  | { type: 'drop'; pit: number }
  | { type: 'store_drop'; player: Player }
  | RevealEvent
  | { type: 'capture'; pit: number; count: number; player: Player; reason: CaptureReason }
  | { type: 'halt'; pit: number; reason: HaltReason };

export interface MoveRecord {
  player: Player;
  pit: number;
  round: number;
  /** Counters the mover added to their own store with this move (excludes round-end sweeps). */
  captured: number;
}

export interface RoundResult {
  round: number;
  winner: Player | 'draw';
  stores: [number, number];
}

export interface GameState {
  variant: GameVariant;
  boardSize: number; // 14 for Indian (7x2), 24 for Lamlameta (12x2)
  pitsPerSide: number;
  pits: number[]; // counters per pit; 0..n-1 = Player 1 (bottom), n..2n-1 = Player 2 (top)
  stores: [number, number]; // captured counters [Player 1, Player 2]
  activePlayer: Player;
  turnPhase: TurnPhase;
  roundNumber: number;
  deadPits: boolean[]; // "Andha Ghara" / "Kottai" – pits that could not be refilled
  history: MoveRecord[];
  isVsAI: boolean;
  aiDifficulty: AIDifficulty;
  aiPlayer: Player;
  seedsPerPit: number;
  pasu: PasuRule;
  startingPlayer: Player;
  lastRound: RoundResult | null;
  winner: Player | 'draw' | null;
}

export interface MoveResult {
  state: GameState;
  events: SowEvent[];
  captured: number;
}

/** What the board renders while a move is being animated. */
export interface BoardView {
  pits: number[];
  stores: [number, number];
  hand: number;
  handPit: number | null;
}
