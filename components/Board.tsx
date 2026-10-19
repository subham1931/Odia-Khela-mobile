import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { ownerOf, STORE } from '@odiakhela/engine/rules';
import type { BoardView, GameState, Player, RevealEvent, SowEvent } from '@odiakhela/engine/types';
import type { SeedStyle } from '@/store/settings';
import { Pit, type PitFlash, type PitMarker } from './Pit';
import { Store } from './Store';

export interface BoardProps {
  game: GameState;
  view: BoardView;
  activeEvent: SowEvent | null;
  legalMoves: number[];
  onSelect: (pit: number) => void;
  previewPath: (pit: number | null) => number[];
  playerNames: [string, string];
  seedStyle: SeedStyle;
  showProjection: boolean;
  rotated: boolean;
  reveal?: RevealEvent | null;
}

/** Outer brass + dark + brass rings around the face. */
const RIM = 2 + 5 + 1; // each side
const RIM_TOTAL = RIM * 2;

function flashFor(e: SowEvent | null): { pit: number; kind: PitFlash } | null {
  if (!e) return null;
  if (e.type === 'capture') return { pit: e.pit, kind: e.reason };
  if (e.type === 'halt') return { pit: e.pit, kind: e.reason === 'kada' ? 'kada' : 'halt' };
  return null;
}

function markersFor(reveal: RevealEvent | null): Map<number, PitMarker> {
  const m = new Map<number, PitMarker>();
  if (!reveal) return m;
  if (reveal.rule === 'gap') {
    m.set(reveal.last, 'last');
    m.set(reveal.gap, 'gap');
    m.set(reveal.target, 'target');
  } else if (reveal.rule === 'sweep') {
    m.set(reveal.landing, 'landing');
    for (const p of reveal.pairs) m.set(p, p === reveal.opposite ? 'opposite' : 'pair');
  } else if (reveal.rule === 'opposite') {
    m.set(reveal.landing, 'landing');
    m.set(reveal.opposite, 'target');
  }
  return m;
}

function spacingFor(pit: number) {
  if (pit >= 52) return { pad: 16, gap: 10, flank: 12 };
  if (pit >= 40) return { pad: 12, gap: 8, flank: 8 };
  if (pit >= 32) return { pad: 10, gap: 6, flank: 6 };
  return { pad: 8, gap: 4, flank: 4 };
}

function trayWidth(pit: number, n: number, pad: number, gap: number, flank: number) {
  return RIM_TOTAL + 2 * pad + 2 * (pit * 0.95) + 2 * flank + n * pit + (n - 1) * gap;
}

function trayHeight(pit: number, pad: number) {
  // Tallest of: stores (label + capsule) vs mid column (labels + 2 pit rows)
  const storeCol = 16 + pit * 2 + 28; // label + store
  const midCol = 22 + pit + 13 + pit + 22; // top label + pits + divider + pits + bottom label
  return RIM_TOTAL + 2 * pad + Math.max(storeCol, midCol) + 8; // +8 hinge overhang
}

/**
 * Pick the largest pit that fits both available width and height.
 * Always shrinks to the screen — never a fixed oversized board.
 */
function fitLayout(availW: number, availH: number, n: number) {
  const maxByWidth = Math.floor((availW - RIM_TOTAL) / (n + 2.2));
  const start = Math.min(n > 7 ? 56 : 68, Math.max(24, maxByWidth));

  for (let pit = start; pit >= 24; pit--) {
    const { pad, gap, flank } = spacingFor(pit);
    if (trayWidth(pit, n, pad, gap, flank) <= availW + 0.5 && trayHeight(pit, pad) <= availH + 0.5) {
      return { pit, pad, gap, flank };
    }
  }
  const pit = 24;
  return { pit, ...spacingFor(pit) };
}

function BrassHinge({ side, inset }: { side: 'left' | 'right'; inset: number }) {
  return (
    <LinearGradient
      colors={['#f0d48e', '#b48a3a', '#7a5a22']}
      locations={[0, 0.55, 1]}
      style={[styles.hinge, side === 'left' ? { left: inset } : { right: inset }]}
    />
  );
}

export function Board(props: BoardProps) {
  const {
    game,
    view,
    activeEvent,
    legalMoves,
    onSelect,
    previewPath,
    playerNames,
    seedStyle,
    showProjection,
    rotated,
    reveal = null,
  } = props;
  const n = game.pitsPerSide;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    }
  }, []);

  const layout = useMemo(() => {
    if (box.w <= 0 || box.h <= 0) return { pit: 36, pad: 10, gap: 6, flank: 6 };
    return fitLayout(box.w, box.h, n);
  }, [box.w, box.h, n]);

  const { pit: pitSize, pad, gap, flank } = layout;

  const legal = useMemo(() => new Set(legalMoves), [legalMoves]);
  const projection = useMemo(() => {
    const counts = new Map<number, number>();
    if (!showProjection || hovered === null || !legal.has(hovered)) return counts;
    for (const p of previewPath(hovered)) counts.set(p, (counts.get(p) ?? 0) + 1);
    return counts;
  }, [hovered, legal, previewPath, showProjection]);

  const markers = useMemo(() => markersFor(reveal), [reveal]);
  const flash = flashFor(activeEvent);
  const storeGlow: Player | null =
    activeEvent?.type === 'capture' && activeEvent.reason !== 'round_end'
      ? activeEvent.player
      : activeEvent?.type === 'store_drop'
        ? activeEvent.player
        : reveal?.rule === 'extra_turn'
          ? reveal.player
          : null;
  const freeTurn: Player | null = reveal?.rule === 'extra_turn' ? reveal.player : null;
  const storeProjected = projection.get(STORE) ?? 0;

  const handleSelect = useCallback(
    (pit: number) => {
      setHovered(null);
      onSelect(pit);
    },
    [onSelect],
  );

  const topRow = Array.from({ length: n }, (_, k) => 2 * n - 1 - k);
  const bottomRow = Array.from({ length: n }, (_, k) => k);
  const active = game.activePlayer;

  const renderPit = (i: number) => (
    <Pit
      key={i}
      index={i}
      count={view.pits[i]}
      owner={ownerOf(game, i)}
      dead={game.deadPits[i]}
      legal={legal.has(i)}
      projected={projection.get(i) ?? 0}
      hand={view.handPit === i && view.hand > 0 ? view.hand : null}
      flash={flash?.pit === i ? flash.kind : null}
      marker={markers.get(i) ?? null}
      seedStyle={seedStyle}
      size={pitSize}
      label={`${playerNames[ownerOf(game, i)]} pit ${(i % n) + 1}`}
      onSelect={handleSelect}
      onPreview={setHovered}
    />
  );

  const hingeInset = pad + 8;
  const hideStoreLabel = pitSize < 34;

  return (
    <View style={styles.shell} onLayout={onLayout}>
      {box.w > 0 && (
        <View style={[styles.boardOuter, rotated && { transform: [{ rotate: '180deg' }] }]}>
          <View style={styles.rimBrassOuter}>
            <View style={styles.rimDark}>
              <View style={styles.rimBrassInner}>
                <LinearGradient
                  colors={['#5a3832', '#3b2320', '#2c1b18']}
                  locations={[0, 0.55, 1]}
                  style={[styles.boardFace, { padding: pad }]}
                >
                  <View style={styles.warmWash} pointerEvents="none" />
                  {Array.from({ length: 24 }, (_, i) => (
                    <View
                      key={i}
                      pointerEvents="none"
                      style={[
                        styles.grainLine,
                        {
                          left: 4 + i * 17,
                          backgroundColor: i % 2 === 0 ? 'rgba(0,0,0,0.14)' : 'rgba(255,220,180,0.035)',
                          width: i % 2 === 0 ? 1 : 2,
                        },
                      ]}
                    />
                  ))}

                  <BrassHinge side="left" inset={hingeInset} />
                  <BrassHinge side="right" inset={hingeInset} />

                  <View style={[styles.row, { gap: flank }]}>
                    <Store
                      count={view.stores[1]}
                      label={playerNames[1]}
                      active={active === 1}
                      glowing={storeGlow === 1}
                      seedStyle={seedStyle}
                      pitSize={pitSize}
                      projected={active === 1 ? storeProjected : 0}
                      callout={freeTurn === 1 ? 'free turn' : null}
                      hideLabel={hideStoreLabel}
                    />

                    <View style={{ gap: 4, flexShrink: 1 }}>
                      <RowLabel active={active === 1} name={playerNames[1]} direction="left" compact={pitSize < 36} />
                      <View style={[styles.pitsRow, { gap }]}>{topRow.map(renderPit)}</View>
                      <LinearGradient
                        colors={['transparent', 'rgba(201, 162, 79, 0.5)', 'transparent']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.divider}
                      />
                      <View style={[styles.pitsRow, { gap }]}>{bottomRow.map(renderPit)}</View>
                      <RowLabel active={active === 0} name={playerNames[0]} direction="right" compact={pitSize < 36} />
                    </View>

                    <Store
                      count={view.stores[0]}
                      label={playerNames[0]}
                      active={active === 0}
                      glowing={storeGlow === 0}
                      seedStyle={seedStyle}
                      pitSize={pitSize}
                      projected={active === 0 ? storeProjected : 0}
                      callout={freeTurn === 0 ? 'free turn' : null}
                      hideLabel={hideStoreLabel}
                    />
                  </View>
                </LinearGradient>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function RowLabel({
  active,
  name,
  direction,
  compact,
}: {
  active: boolean;
  name: string;
  direction: 'left' | 'right';
  compact?: boolean;
}) {
  const Arrow = direction === 'left' ? ArrowLeft : ArrowRight;
  const size = compact ? 9 : 11;
  return (
    <View
      style={[
        styles.rowLabel,
        direction === 'left' ? styles.rowLabelTop : styles.rowLabelBottom,
        compact && { marginTop: 4, marginBottom: 4 },
      ]}
    >
      <Text style={[styles.rowLabelText, { fontSize: size }, active && styles.rowLabelTextOn]} numberOfLines={1}>
        {name}
      </Text>
      <Arrow color={active ? '#fde68a' : 'rgba(245, 230, 200, 0.35)'} size={compact ? 12 : 14} />
      <View style={[styles.rowLine, active && styles.rowLineOn]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardOuter: {
    borderRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.75,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  rimBrassOuter: {
    borderRadius: 32,
    padding: 2,
    backgroundColor: 'rgba(201, 162, 79, 0.55)',
  },
  rimDark: {
    borderRadius: 30,
    padding: 5,
    backgroundColor: '#2c1b18',
  },
  rimBrassInner: {
    borderRadius: 26,
    padding: 1,
    backgroundColor: 'rgba(201, 162, 79, 0.25)',
    overflow: 'hidden',
  },
  boardFace: {
    borderRadius: 25,
    overflow: 'visible',
    position: 'relative',
  },
  grainLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    transform: [{ rotate: '2deg' }],
  },
  warmWash: {
    position: 'absolute',
    top: '10%',
    left: '-10%',
    width: '70%',
    height: '80%',
    borderRadius: 999,
    backgroundColor: 'rgba(110, 66, 50, 0.35)',
  },
  hinge: {
    position: 'absolute',
    top: -6,
    width: 34,
    height: 12,
    borderRadius: 4,
    zIndex: 5,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  pitsRow: { flexDirection: 'row' },
  divider: {
    height: 1,
    marginVertical: 6,
    width: '100%',
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  rowLabelTop: { flexDirection: 'row-reverse', marginBottom: 8 },
  rowLabelBottom: { marginTop: 8 },
  rowLabelText: {
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(245, 230, 200, 0.35)',
  },
  rowLabelTextOn: { color: '#fde68a' },
  rowLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(245, 230, 200, 0.35)',
    opacity: 0.3,
  },
  rowLineOn: { backgroundColor: '#fde68a', opacity: 0.3 },
});
