import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyDashMove,
  createDashState,
  type DashMove,
  type DashState,
  legalDashMoves,
  piecesInDanger,
  type Side,
} from '@odiakhela/engine/dash';
import type { AIDifficulty } from '@odiakhela/engine/types';
import { requestDashMove } from '@/lib/aiClient';
import type { AnimationSpeed } from '@/store/settings';

export interface DashOptions {
  /** Side the human plays against the machine (0 moves first); null = pass-and-play. */
  humanSide: Side | null;
  aiDifficulty: AIDifficulty;
}

export interface DashPiece {
  id: number;
  side: Side;
  at: number;
}

/** The latest capture (or chain of captures), kept on screen until the next one. */
export interface DashCapture {
  by: Side;
  jumps: Extract<DashMove, { kind: 'jump' }>[];
  total: number;
}

const SLIDE_MS: Record<AnimationSpeed, number> = { slow: 600, normal: 380, fast: 200 };
const CAPTURE_HOLD_MS: Record<AnimationSpeed, number> = { slow: 1900, normal: 1400, fast: 800 };
const AI_MIN_THINK_MS = 500;

export function dashPiecesOf(board: DashState['board']): DashPiece[] {
  return board.flatMap((p, at) => (p === null ? [] : [{ id: at, side: p, at }]));
}

export function moveDashPieces(pieces: DashPiece[], m: DashMove): DashPiece[] {
  return pieces
    .filter((p) => !(m.kind === 'jump' && p.at === m.over))
    .map((p) => (p.at === m.from ? { ...p, at: m.to } : p));
}

/**
 * State machine for Dash-guti: tap a piece, then a glowing point. Captures are
 * compulsory, and during a chain the jumping piece stays selected until it can't jump.
 */
export function useDashGame(
  options: DashOptions,
  { speed = 'normal', onMove }: { speed?: AnimationSpeed; onMove?: (m: DashMove, s: DashState) => void } = {},
) {
  const [state, setState] = useState<DashState>(createDashState);
  const [pieces, setPieces] = useState<DashPiece[]>(() => dashPiecesOf(createDashState().board));
  const [selected, setSelected] = useState<number | null>(null);
  const [jumping, setJumping] = useState<Extract<DashMove, { kind: 'jump' }> | null>(null);
  const [lastMove, setLastMove] = useState<DashMove | null>(null);
  const [lastCapture, setLastCapture] = useState<DashCapture | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  const stateRef = useRef(state);
  const busyRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(speed);
  const onMoveRef = useRef(onMove);
  speedRef.current = speed;
  onMoveRef.current = onMove;

  const isHumanTurn = state.winner === null && (options.humanSide === null || state.turn === options.humanSide);

  const play = useCallback((m: DashMove) => {
    const s = stateRef.current;
    if (busyRef.current) return false;
    let next: DashState;
    try {
      next = applyDashMove(s, m);
    } catch {
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    setLastMove(m);
    setPieces((ps) => moveDashPieces(ps, m));
    if (m.kind === 'jump') {
      setJumping(m);
      setLastCapture((cur) =>
        s.chainFrom !== null && cur && cur.by === s.turn
          ? { ...cur, jumps: [...cur.jumps, m], total: next.captured[s.turn] }
          : { by: s.turn, jumps: [m], total: next.captured[s.turn] },
      );
    }
    onMoveRef.current?.(m, next);
    const hold = SLIDE_MS[speedRef.current] + (m.kind === 'jump' ? CAPTURE_HOLD_MS[speedRef.current] : 0);
    timer.current = setTimeout(() => {
      stateRef.current = next;
      setState(next);
      setJumping(null);
      setSelected(next.chainFrom);
      busyRef.current = false;
      setBusy(false);
    }, hold);
    return true;
  }, []);

  const legal = useMemo(() => (isHumanTurn && !busy ? legalDashMoves(state) : []), [state, isHumanTurn, busy]);
  const mustCapture = legal.length > 0 && legal[0].kind === 'jump';
  const selectable = useMemo(() => new Set(legal.map((m) => m.from)), [legal]);
  const targets = useMemo(
    () => new Map(legal.filter((m) => m.from === selected).map((m) => [m.to, m] as const)),
    [legal, selected],
  );

  const tapPoint = useCallback(
    (p: number) => {
      const move = targets.get(p);
      if (move) return play(move);
      if (stateRef.current.chainFrom !== null) return false;
      if (selectable.has(p)) setSelected((cur) => (cur === p ? null : p));
      else setSelected(null);
      return false;
    },
    [targets, selectable, play],
  );

  useEffect(() => {
    if (options.humanSide === null || state.winner !== null || state.turn === options.humanSide || busy) return;
    let cancelled = false;
    const started = Date.now();
    setAiThinking(true);
    requestDashMove(stateRef.current, options.aiDifficulty).then((m) => {
      const wait = Math.max(0, AI_MIN_THINK_MS - (Date.now() - started));
      setTimeout(() => {
        if (cancelled) return;
        setAiThinking(false);
        play(m);
      }, wait);
    });
    return () => {
      cancelled = true;
      setAiThinking(false);
    };
  }, [state, busy, options.humanSide, options.aiDifficulty, play]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const newGame = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const fresh = createDashState();
    stateRef.current = fresh;
    busyRef.current = false;
    setState(fresh);
    setPieces(dashPiecesOf(fresh.board));
    setSelected(null);
    setJumping(null);
    setLastMove(null);
    setLastCapture(null);
    setBusy(false);
    setAiThinking(false);
  }, []);

  const danger = useMemo(
    () => (isHumanTurn && !busy ? piecesInDanger(state.board, state.turn) : []),
    [state, isHumanTurn, busy],
  );

  return {
    state,
    pieces,
    selected,
    targets,
    selectable,
    mustCapture,
    jumping,
    lastMove,
    lastCapture,
    busy,
    aiThinking,
    isHumanTurn,
    danger,
    tapPoint,
    newGame,
  };
}

export type DashGame = ReturnType<typeof useDashGame>;
