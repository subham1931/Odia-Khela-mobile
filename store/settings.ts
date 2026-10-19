import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AIDifficulty, PasuRule } from '@odiakhela/engine/types';
import type { MobileGameId } from '@/lib/games';

export type SeedStyle = 'cowrie' | 'tamarind' | 'pebble';
export type AnimationSpeed = 'slow' | 'normal' | 'fast';
export type PlayMode = 'ai' | 'local';
export type HuntSide = 'goat' | 'tiger';

interface SettingsState {
  /** Last game opened from the home menu. */
  selectedGame: MobileGameId;
  mode: PlayMode;
  seedsPerPit: number;
  pasu: PasuRule;
  aiDifficulty: AIDifficulty;
  seedStyle: SeedStyle;
  speed: AnimationSpeed;
  sound: boolean;
  haptics: boolean;
  showProjection: boolean;
  rotateForPlayer2: boolean;
  /** Bagha Chheli: side vs AI. */
  huntSide: HuntSide;
  /** Dash-guti: 0 ivory first, 1 ebony. */
  dashSide: 0 | 1;
  /** Chowka Bara seat count. */
  chowkaPlayers: 2 | 3 | 4;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      selectedGame: 'kasadi',
      mode: 'ai',
      seedsPerPit: 5,
      pasu: 'off',
      aiDifficulty: 'medium',
      seedStyle: 'cowrie',
      speed: 'normal',
      sound: true,
      haptics: true,
      showProjection: true,
      rotateForPlayer2: false,
      huntSide: 'goat',
      dashSide: 0,
      chowkaPlayers: 2,
      set: (patch) => set(patch),
    }),
    {
      name: 'odiakhela-mobile-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
