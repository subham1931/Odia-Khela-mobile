import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyHuntMove,
  createHuntState,
  goatsInDanger,
  type HuntMove,
  type HuntState,
  legalHuntMoves,
  POINTS,
  type Side,
  trappedTigers,
} from '@odiakhela/engine/hunt';
import type { AIDifficulty } from '@odiakhela/engine/types';
import { requestHuntMove } from '@/lib/aiClient';
import type { AnimationSpeed } from '@/store/settings';

export interface HuntOptions {
  /** Side the human plays against the machine; null = pass-and-play. */
  humanSide: Side | null;
  aiDifficulty: AIDifficulty;
}

/** A piece with a stable id, so the board can animate it sliding from point to point. */
export interface HuntPiece {
  id: number;
  side: Side;
  at: number;
}

const CAPTURE_HOLD_MS: Record<AnimationSpeed, number> = { slow: 2400, normal: 1800, fast: 1100 };
const SLIDE_MS: Record<AnimationSpeed, number> = { slow: 650, normal: 420, fast: 220 };
const AI_MIN_THINK_MS = 550;
/** Undo uses left per match (clearing a selection does not spend one). */
export const HUNT_UNDO_LIMIT = 5;

export function piecesOf(board: HuntState['board']): HuntPiece[] {
  const out: HuntPiece[] = [];
  board.forEach((p, at) => p && out.push({ id: at, side: p === 'T' ? 'tiger' : 'goat', at }));
  return out;
}

type HuntSnapshot = { state: HuntState; pieces: HuntPiece[] };

export function useHuntGame(
  options: HuntOptions,
  { speed = 'normal', onMove }: { speed?: AnimationSpeed; onMove?: (m: HuntMove, s: HuntState) => void } = {},
) {
  const [state, setState] = useState<HuntState>(createHuntState);
  const [pieces, setPieces] = useState<HuntPiece[]>(() => piecesOf(createHuntState().board));
  const [selected, setSelected] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<HuntMove | null>(null);
  const [capture, setCapture] = useState<Extract<HuntMove, { kind: 'jump' }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [canBack, setCanBack] = useState(false);
  const [undosLeft, setUndosLeft] = useState(HUNT_UNDO_LIMIT);

  const stateRef = useRef(state);
  const piecesRef = useRef(pieces);
  const historyRef = useRef<HuntSnapshot[]>([]);
  const undosLeftRef = useRef(HUNT_UNDO_LIMIT);
  const busyRef = useRef(false);
  const nextId = useRef(100);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(speed);
  const onMoveRef = useRef(onMove);
  speedRef.current = speed;
  onMoveRef.current = onMove;
  piecesRef.current = pieces;

  const isHumanTurn = !state.winner && (options.humanSide === null || state.turn === options.humanSide);

  const play = useCallback((m: HuntMove) => {
    const s = stateRef.current;
    if (busyRef.current) return false;
    let next: HuntState;
    try {
      next = applyHuntMove(s, m);
    } catch {
      return false;
    }
    historyRef.current.push({ state: s, pieces: piecesRef.current });
    setCanBack(undosLeftRef.current > 0);
    busyRef.current = true;
    setBusy(true);
    setSelected(null);
    setLastMove(m);
    setPieces((ps) => {
      const nextPieces = movePieces(ps, m, nextId.current++);
      piecesRef.current = nextPieces;
      return nextPieces;
    });
    if (m.kind === 'jump') setCapture(m);
    onMoveRef.current?.(m, next);
    const hold = SLIDE_MS[speedRef.current] + (m.kind === 'jump' ? CAPTURE_HOLD_MS[speedRef.current] : 0);
    timer.current = setTimeout(() => {
      stateRef.current = next;
      setState(next);
      setCapture(null);
      busyRef.current = false;
      setBusy(false);
    }, hold);
    return true;
  }, []);

  const legal = useMemo(() => (isHumanTurn && !busy ? legalHuntMoves(state) : []), [state, isHumanTurn, busy]);

  const targets = useMemo(() => {
    const t = new Map<number, HuntMove>();
    for (const m of legal) {
      if (m.kind === 'place') t.set(m.to, m);
      else if (m.from === selected) t.set(m.to, m);
    }
    return t;
  }, [legal, selected]);

  const selectable = useMemo(() => new Set(legal.flatMap((m) => (m.kind === 'place' ? [] : [m.from]))), [legal]);

  const tapPoint = useCallback(
    (p: number) => {
      const move = targets.get(p);
      if (move) return play(move);
      if (selectable.has(p)) setSelected((cur) => (cur === p ? null : p));
      else setSelected(null);
      return false;
    },
    [targets, selectable, play],
  );

  useEffect(() => {
    if (options.humanSide === null || state.winner || state.turn === options.humanSide || busy) return;
    let cancelled = false;
    const started = Date.now();
    setAiThinking(true);
    requestHuntMove(state, options.aiDifficulty).then((m) => {
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
    const fresh = createHuntState();
    const freshPieces = piecesOf(fresh.board);
    stateRef.current = fresh;
    piecesRef.current = freshPieces;
    historyRef.current = [];
    undosLeftRef.current = HUNT_UNDO_LIMIT;
    busyRef.current = false;
    setState(fresh);
    setPieces(freshPieces);
    setSelected(null);
    setLastMove(null);
    setCapture(null);
    setBusy(false);
    setAiThinking(false);
    setUndosLeft(HUNT_UNDO_LIMIT);
    setCanBack(false);
  }, []);

  const back = useCallback(() => {
    if (selected !== null) {
      setSelected(null);
      return true;
    }
    if (historyRef.current.length === 0 || undosLeftRef.current <= 0) return false;
    if (timer.current) clearTimeout(timer.current);
    busyRef.current = false;
    setBusy(false);
    setCapture(null);
    setAiThinking(false);
    setLastMove(null);
    setSelected(null);

    const restoreOne = () => {
      const snap = historyRef.current.pop();
      if (!snap) return;
      stateRef.current = snap.state;
      piecesRef.current = snap.pieces;
      setState(snap.state);
      setPieces(snap.pieces);
    };

    restoreOne();
    if (options.humanSide !== null) {
      while (
        historyRef.current.length > 0 &&
        !stateRef.current.winner &&
        stateRef.current.turn !== options.humanSide
      ) {
        restoreOne();
      }
    }
    undosLeftRef.current -= 1;
    setUndosLeft(undosLeftRef.current);
    setCanBack(historyRef.current.length > 0 && undosLeftRef.current > 0);
    return true;
  }, [selected, options.humanSide]);

  useEffect(() => {
    setCanBack(selected !== null || (historyRef.current.length > 0 && undosLeftRef.current > 0));
  }, [selected, state, undosLeft]);

  const trapped = useMemo(() => trappedTigers(state.board), [state.board]);
  const danger = useMemo(() => goatsInDanger(state.board), [state.board]);

  return {
    state,
    pieces,
    selected,
    targets,
    selectable,
    lastMove,
    capture,
    busy,
    aiThinking,
    isHumanTurn,
    trapped,
    danger,
    canBack,
    undosLeft,
    undoLimit: HUNT_UNDO_LIMIT,
    tapPoint,
    back,
    newGame,
    points: POINTS,
  };
}

export type HuntGame = ReturnType<typeof useHuntGame>;

export function movePieces(pieces: HuntPiece[], m: HuntMove, newId: number): HuntPiece[] {
  if (m.kind === 'place') return [...pieces, { id: newId, side: 'goat', at: m.to }];
  return pieces
    .filter((p) => !(m.kind === 'jump' && p.at === m.over))
    .map((p) => (p.at === m.from ? { ...p, at: m.to } : p));
}
