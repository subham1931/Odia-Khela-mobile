import type { GameVariant } from '@odiakhela/engine/types';
import { VARIANTS } from '@odiakhela/engine/variants';

export type MobileGameId = GameVariant | 'bagha_chheli' | 'chowka_bara' | 'dash_guti';

export type GameKind = 'mancala' | 'hunt' | 'race' | 'capture';

export interface MobileGameInfo {
  id: MobileGameId;
  name: string;
  region: string;
  description: string;
  section: 'odia' | 'videshi';
  kind: GameKind;
  cover: number; // require() asset
  /** Playable in the mobile app right now. */
  available: boolean;
}

const COVERS = {
  kasadi: require('@/assets/games/kasadi.jpg'),
  lamlameta: require('@/assets/games/lamlameta.jpg'),
  kalah: require('@/assets/games/kalah.jpg'),
  bagha_chheli: require('@/assets/games/bagha-chheli.jpg'),
  chowka_bara: require('@/assets/games/chowka-bara.jpg'),
  dash_guti: require('@/assets/games/dash-guti.jpg'),
} as const;

export const GAME_LIST: MobileGameInfo[] = [
  {
    id: 'kasadi',
    name: VARIANTS.kasadi.name,
    region: VARIANTS.kasadi.region,
    description: VARIANTS.kasadi.description,
    section: 'odia',
    kind: 'mancala',
    cover: COVERS.kasadi,
    available: true,
  },
  {
    id: 'bagha_chheli',
    name: 'Bagha Chheli',
    region: 'Odisha · tigers & goats',
    description: 'A hunt game: 4 tigers jump to capture, 20 goats close in to trap them.',
    section: 'odia',
    kind: 'hunt',
    cover: COVERS.bagha_chheli,
    available: true,
  },
  {
    id: 'chowka_bara',
    name: 'Chowka Bara',
    region: 'Odisha · Ashta Chamma',
    description: 'A race for 2–4 players: throw cowries, knock rivals home, reach the centre.',
    section: 'odia',
    kind: 'race',
    cover: COVERS.chowka_bara,
    available: true,
  },
  {
    id: 'dash_guti',
    name: 'Dash-guti',
    region: 'Odisha · Dosh guti',
    description: 'Ten pieces a side on an hourglass board. Jump to capture – and you must.',
    section: 'odia',
    kind: 'capture',
    cover: COVERS.dash_guti,
    available: true,
  },
  {
    id: 'lamlameta',
    name: VARIANTS.lamlameta.name,
    region: VARIANTS.lamlameta.region,
    description: VARIANTS.lamlameta.description,
    section: 'videshi',
    kind: 'mancala',
    cover: COVERS.lamlameta,
    available: true,
  },
  {
    id: 'kalah',
    name: VARIANTS.kalah.name,
    region: VARIANTS.kalah.region,
    description: VARIANTS.kalah.description,
    section: 'videshi',
    kind: 'mancala',
    cover: COVERS.kalah,
    available: true,
  },
];

export const isMancalaVariant = (id: string): id is GameVariant =>
  id === 'kasadi' || id === 'lamlameta' || id === 'kalah';

export const gameInfo = (id: MobileGameId) => GAME_LIST.find((g) => g.id === id)!;
