import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyEvent,
  createInitialState,
  getLegalMoves,
  isLegalMove,
  projectPath,
  simulateMove,
  startNextRound,
  viewOf,
} from '@odiakhela/engine/rules';
import type { BoardView, GameOptions, GameState, MoveResult, Player, RevealEvent, SowEvent } from '@odiakhela/engine/types';
import { requestAIMove } from '@/lib/aiClient';
import type { AnimationSpeed } from '@/store/settings';

const SPEED_MS: Record<AnimationSpeed, number> = { slow: 320, normal: 170, fast: 70 };
const LONG_MOVE_EVENTS = 90;
const MIN_STEP_MS = 14;
const REVEAL_MS: Record<AnimationSpeed, number> = { slow: 2800, normal: 2200, fast: 1500 };
const AI_MIN_THINK_MS = 650;

function stepDelay(e: SowEvent, base: number): number {
  switch (e.type) {
    case 'pickup':
      return base * 2.2;
    case 'capture':
      return base * (e.reason === 'round_end' ? 1.2 : 3);
    case 'halt':
      return base * 1.5;
    default:
      return base;
  }
}

export interface UseMancalaGameOptions {
  speed?: AnimationSpeed;
  onEvent?: (event: SowEvent, view: BoardView) => void;
}

export function useMancalaGame(initial: GameOptions, { speed = 'normal', onEvent }: UseMancalaGameOptions = {}) {
  const [game, setGame] = useState<GameState>(() => createInitialState(initial));
  const [view, setView] = useState<BoardView>(() => viewOf(game));
  const [activeEvent, setActiveEvent] = useState<SowEvent | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [explanation, setExplanation] = useState<{ reveal: RevealEvent; mover: Player } | null>(null);

  const gameRef = useRef(game);
  const pendingRef = useRef<MoveResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Continues sowing after a reveal hold — used when the player taps Continue. */
  const resumeAfterRevealRef = useRef<(() => void) | null>(null);
  const speedRef = useRef(speed);
  const onEventRef = useRef(onEvent);
  speedRef.current = speed;
  onEventRef.current = onEvent;

  const commit = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const finish = useCallback(
    (final: GameState) => {
      clearTimer();
      resumeAfterRevealRef.current = null;
      pendingRef.current = null;
      commit(final);
      setView(viewOf(final));
      setActiveEvent(null);
    },
    [commit],
  );

  const playMove = useCallback(
    (pit: number): boolean => {
      const g = gameRef.current;
      if (pendingRef.current || !isLegalMove(g, pit)) return false;
      const result = simulateMove(g, pit);
      pendingRef.current = result;
      commit({ ...g, turnPhase: 'SOWING_ANIMATION' });
      setExplanation(null);

      const { events } = result;
      const scale = Math.min(1, LONG_MOVE_EVENTS / events.length);
      let v = viewOf(g);
      let i = 0;
      const step = () => {
        if (pendingRef.current !== result) return;
        if (i >= events.length) {
          finish(result.state);
          return;
        }
        const e = events[i++];
        v = applyEvent(v, e);
        setView(v);
        setActiveEvent(e);
        onEventRef.current?.(e, v);
        if (e.type === 'reveal') {
          setExplanation({ reveal: e, mover: g.activePlayer });
          const hold = REVEAL_MS[speedRef.current] * (e.rule === 'extra_turn' ? 0.55 : 1);
          const resume = () => {
            resumeAfterRevealRef.current = null;
            step();
          };
          resumeAfterRevealRef.current = resume;
          timerRef.current = setTimeout(resume, hold);
          return;
        }
        timerRef.current = setTimeout(step, Math.max(MIN_STEP_MS, stepDelay(e, SPEED_MS[speedRef.current]) * scale));
      };
      timerRef.current = setTimeout(step, 60);
      return true;
    },
    [commit, finish],
  );

  const isHumanTurn = !(game.isVsAI && game.activePlayer === game.aiPlayer);

  const selectPit = useCallback(
    (pit: number) => {
      const g = gameRef.current;
      if (g.isVsAI && g.activePlayer === g.aiPlayer) return false;
      return playMove(pit);
    },
    [playMove],
  );

  useEffect(() => {
    if (!game.isVsAI || game.turnPhase !== 'SELECT_PIT' || game.activePlayer !== game.aiPlayer) return;
    let cancelled = false;
    const started = Date.now();
    setAiThinking(true);
    requestAIMove(game, game.aiDifficulty).then((pit) => {
      const wait = Math.max(0, AI_MIN_THINK_MS - (Date.now() - started));
      setTimeout(() => {
        if (cancelled) return;
        setAiThinking(false);
        playMove(pit);
      }, wait);
    });
    return () => {
      cancelled = true;
      setAiThinking(false);
    };
  }, [game, playMove]);

  useEffect(() => clearTimer, []);

  const skipAnimation = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    resumeAfterRevealRef.current = null;
    const reveal = pending.events.find((e): e is RevealEvent => e.type === 'reveal');
    if (reveal) setExplanation({ reveal, mover: gameRef.current.activePlayer });
    finish(pending.state);
  }, [finish]);

  /** Dismiss the tip; if sowing is paused on a reveal, resume immediately. */
  const dismissExplanation = useCallback(() => {
    setExplanation(null);
    const resume = resumeAfterRevealRef.current;
    if (!resume) return;
    clearTimer();
    resume();
  }, []);

  const nextRound = useCallback(() => {
    const g = gameRef.current;
    if (g.turnPhase !== 'ROUND_OVER') return;
    const next = startNextRound(g);
    commit(next);
    setView(viewOf(next));
    setExplanation(null);
  }, [commit]);

  const newGame = useCallback(
    (opts: GameOptions) => {
      clearTimer();
      pendingRef.current = null;
      const next = createInitialState(opts);
      commit(next);
      setView(viewOf(next));
      setActiveEvent(null);
      setExplanation(null);
    },
    [commit],
  );

  const legalMoves = useMemo(() => (isHumanTurn ? getLegalMoves(game) : []), [game, isHumanTurn]);

  const previewPath = useCallback(
    (pit: number | null) => (pit !== null && isLegalMove(gameRef.current, pit) ? projectPath(gameRef.current, pit) : []),
    [],
  );

  const isAnimating = game.turnPhase === 'SOWING_ANIMATION';

  return {
    game,
    view,
    activeEvent,
    aiThinking,
    isHumanTurn,
    isAnimating,
    explanation,
    boardReveal: isAnimating ? (explanation?.reveal ?? null) : null,
    legalMoves,
    selectPit,
    previewPath,
    skipAnimation,
    dismissExplanation,
    nextRound,
    newGame,
  };
}

export type MancalaGame = ReturnType<typeof useMancalaGame>;
