import { chooseMove } from '@odiakhela/engine/ai';
import type { ChowkaMove, ChowkaState } from '@odiakhela/engine/chowka';
import { chooseChowkaMove } from '@odiakhela/engine/chowkaAi';
import type { DashMove, DashState } from '@odiakhela/engine/dash';
import { chooseDashMove } from '@odiakhela/engine/dashAi';
import type { HuntMove, HuntState } from '@odiakhela/engine/hunt';
import { chooseHuntMove } from '@odiakhela/engine/huntAi';
import type { AIDifficulty, GameState } from '@odiakhela/engine/types';

/** Main-thread AI (no Web Worker in mobile v1). */
export function requestAIMove(state: GameState, difficulty: AIDifficulty): Promise<number> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(chooseMove(state, difficulty)), 0);
  });
}

/** Bagha Chheli AI on the main thread. */
export function requestHuntMove(state: HuntState, difficulty: AIDifficulty): Promise<HuntMove> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(chooseHuntMove(state, difficulty)), 0);
  });
}

/** Dash-guti AI on the main thread. */
export function requestDashMove(state: DashState, difficulty: AIDifficulty): Promise<DashMove> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(chooseDashMove(state, difficulty)), 0);
  });
}

/** Chowka Bara AI on the main thread. */
export function requestChowkaMove(state: ChowkaState, difficulty: AIDifficulty): Promise<ChowkaMove> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(chooseChowkaMove(state, difficulty)), 0);
  });
}
