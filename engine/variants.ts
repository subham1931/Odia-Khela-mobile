import type { GameVariant, VariantConfig } from './types';

// Regional defaults. Counters per pit (Kasadi, Kalah) and the Pasu rule (Kasadi) are user-configurable;
// these are just sensible starting points.
export const VARIANTS: Record<GameVariant, VariantConfig> = {
  kasadi: {
    id: 'kasadi',
    name: 'Kasadi',
    region: 'Odisha · Kasa Kaudi / Sita-Khela',
    family: 'indian',
    pitsPerSide: 7,
    seedsPerPit: 5,
    seedsPerPitOptions: [5, 6],
    pasu: 'off',
    multiRound: true,
    description: 'Relay sowing on a 2×7 board. Capture the pit beyond an empty gap.',
  },
  lamlameta: {
    id: 'lamlameta',
    name: 'Lamlameta',
    region: 'Ethiopia',
    family: 'lamlameta',
    pitsPerSide: 12,
    seedsPerPit: 2,
    seedsPerPitOptions: [2],
    pasu: 'off',
    multiRound: false,
    description: '2×12 board, two seeds a pit. Land in your own empty pit to sweep every pair.',
  },
  kalah: {
    id: 'kalah',
    name: 'Kalah',
    region: 'United States · modern mancala',
    family: 'kalah',
    pitsPerSide: 6,
    seedsPerPit: 4,
    seedsPerPitOptions: [3, 4, 5, 6],
    pasu: 'off',
    multiRound: false,
    description: '2×6 board with stores you sow into. End in your store for a free turn; capture across the board.',
  },
};

export const VARIANT_LIST: VariantConfig[] = Object.values(VARIANTS);

export function getVariantConfig(variant: GameVariant): VariantConfig {
  return VARIANTS[variant];
}
