/** Static How-to-play copy for Chowka Bara (mirrors the web guide’s rules tab). */

export const CHOWKA_TAGLINE = 'The cowrie-shell race to the centre';

export const CHOWKA_FACTS = [
  { k: 'Board', v: '5 × 5 squares' },
  { k: 'Players', v: '2 to 4 · 4 pawns each' },
  { k: 'Dice', v: '4 cowrie shells' },
  { k: 'Throws', v: '1, 2, 3, 4 or 8' },
] as const;

export const CHOWKA_KEY_RULE = {
  title: 'How capturing works – and the gate',
  intro: 'Capturing sends an opponent back to start – and you must capture once before your pawns may go inside.',
  conditions: [
    'Your pawn ends its move on a square holding an opponent’s pawn',
    'That square is a plain one, not a crossed safe square',
  ],
  result:
    'The opponent’s pawn goes back to start and must re-enter with a 4 or 8. You throw again – and your gate to the inner ring opens.',
  safe: [
    'Crossed squares – the four start squares and the centre – are safe: pawns share them, no capture.',
    'Passing over a pawn does nothing; only the square you stop on counts.',
    'Until you have captured once, none of your pawns may enter the inner ring.',
  ],
} as const;

export const CHOWKA_RULES = [
  'Each player has four pawns, waiting beside the board by their own crossed start square.',
  'Throw the four cowries and count the mouths facing up: 1, 2 or 3 move that many squares. All four up (chamma) is 4; all four down (ashta) is 8.',
  'A 4 or an 8 earns another throw – and only a 4 or 8 can bring a waiting pawn onto your start square.',
  'Pawns go anticlockwise round the outer ring, then clockwise round the inner ring, and finish in the centre.',
  'Use each throw to move one pawn. If no pawn can use it, the turn passes.',
  'Landing on an opponent’s pawn on a plain square captures it: it goes back to start, and you throw again. Crossed squares are safe.',
  'Your pawns may enter the inner ring only after you have captured at least once.',
  'A pawn must reach the centre with an exact throw. The first player with all four pawns home wins.',
] as const;
