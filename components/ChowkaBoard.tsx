import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock } from 'lucide-react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import {
  CENTRE,
  cellOf,
  type ChowkaMove,
  HOME,
  OFF,
  SAFE_CELLS,
  type Seat,
  SEAT_NAMES,
  START_CELLS,
} from '@odiakhela/engine/chowka';
import { colors } from '@/constants/theme';

/** Per-shell tumble length (web uses 0.6s). Hook waits a touch longer for stagger. */
export const ROLL_MS = 620;
const STAGGER_MS = 18;
const ROLL_EASE = Easing.bezier(0.16, 1, 0.3, 1);

export const SEAT_COLOURS: Record<Seat, { fill: string; rim: string; soft: string }> = {
  0: { fill: '#d6455d', rim: '#7a1626', soft: 'rgba(214,69,93,0.22)' },
  1: { fill: '#2fa36b', rim: '#0f4d30', soft: 'rgba(47,163,107,0.22)' },
  2: { fill: '#5b6ee0', rim: '#1f2a78', soft: 'rgba(91,110,224,0.22)' },
  3: { fill: '#f0a020', rim: '#7a4a05', soft: 'rgba(240,160,32,0.25)' },
};

/** Layout in % of the square container: yards in the margins, the 5×5 board in the middle. */
const M = 12;
const B = 100 - 2 * M;
const CELL = B / 5;
const centreOf = (cell: number) => ({
  x: M + ((cell % 5) + 0.5) * CELL,
  y: M + (Math.floor(cell / 5) + 0.5) * CELL,
});

function yardSpot(seat: Seat, i: number) {
  const along = (i - 1.5) * 6.5;
  const edge = M / 2;
  return [
    { x: 50 + along, y: 100 - edge },
    { x: 100 - edge, y: 50 - along },
    { x: 50 - along, y: edge },
    { x: edge, y: 50 + along },
  ][seat];
}

/** Offsets so several pawns on one square stay visible. */
function cluster(j: number, n: number) {
  if (n === 1) return { dx: 0, dy: 0 };
  if (n === 2) return { dx: j === 0 ? -2.8 : 2.8, dy: 0 };
  if (n <= 4) return { dx: j % 2 ? 2.8 : -2.8, dy: j < 2 ? -2.8 : 2.8 };
  return { dx: ((j % 4) - 1.5) * 3, dy: (Math.floor(j / 4) - 1.5) * 3 };
}

export interface ChowkaBoardProps {
  seats: Seat[];
  /** pawns[seat][i] positions as drawn. */
  pawns: number[][];
  /** Legal moves for the seat to play (only when a person is choosing). */
  moves?: ChowkaMove[];
  turn?: Seat;
  /** Pawns of the seat to play held back by the closed gate. */
  gateBlocked?: number[];
  reveal?: { cell: number; captured: { seat: Seat; pawn: number }[] } | null;
  labels?: Record<number, string>;
  onPawn?: (pawn: number) => void;
}

export function ChowkaBoard({
  seats,
  pawns,
  moves = [],
  turn,
  gateBlocked = [],
  reveal = null,
  labels = {},
  onPawn,
}: ChowkaBoardProps) {
  const [size, setSize] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(Math.max(0, Math.floor(Math.min(width, height))));
  }, []);

  const movable = (seat: Seat, i: number) => seat === turn && moves.some((m) => m.from === pawns[seat][i]);
  const hovered = hover !== null && turn !== undefined ? moves.find((m) => m.from === pawns[turn][hover]) : undefined;
  const hoverCell = hovered && turn !== undefined ? cellOf(turn, hovered.to) : null;

  const groups = useMemo(() => {
    const map = new Map<number, { seat: Seat; i: number }[]>();
    for (const seat of seats) {
      pawns[seat].forEach((pos, i) => {
        if (pos === OFF) return;
        const c = pos === HOME ? CENTRE : cellOf(seat, pos);
        map.set(c, [...(map.get(c) ?? []), { seat, i }]);
      });
    }
    return map;
  }, [seats, pawns]);

  const pawnSize = size > 0 ? size * 0.056 : 0;
  const boardLeft = (M / 100) * size;
  const boardTop = (M / 100) * size;
  const boardSize = (B / 100) * size;
  const cellPx = boardSize / 5;

  return (
    <View style={styles.slot} onLayout={onLayout}>
      {size > 0 && (
        <View style={[styles.frame, { width: size, height: size }]}>
          <View
            style={[
              styles.carved,
              {
                left: ((M - 1.5) / 100) * size,
                top: ((M - 1.5) / 100) * size,
                width: ((B + 3) / 100) * size,
                height: ((B + 3) / 100) * size,
              },
            ]}
          >
            <LinearGradient
              colors={['#3a2420', '#2a1814', '#1a0f0d']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {Array.from({ length: 25 }, (_, c) => {
            const r = Math.floor(c / 5);
            const col = c % 5;
            const inner = r >= 1 && r <= 3 && col >= 1 && col <= 3;
            const startSeat = START_CELLS.indexOf(c) as Seat | -1;
            const active = startSeat >= 0 && seats.includes(startSeat as Seat);
            const label =
              labels[c] ??
              (reveal?.cell === c
                ? 'capture'
                : hoverCell === c
                  ? hovered?.captures.length
                    ? 'capture'
                    : hovered?.to === HOME
                      ? 'home'
                      : 'here'
                  : null);
            const left = boardLeft + col * cellPx;
            const top = boardTop + r * cellPx;
            return (
              <View
                key={c}
                style={[
                  styles.cell,
                  {
                    left,
                    top,
                    width: cellPx,
                    height: cellPx,
                    backgroundColor: active
                      ? SEAT_COLOURS[startSeat as Seat].soft
                      : c === CENTRE
                        ? 'rgba(232, 194, 122, 0.15)'
                        : inner
                          ? 'rgba(26, 15, 13, 0.35)'
                          : 'rgba(58, 36, 32, 0.3)',
                  },
                ]}
              >
                {SAFE_CELLS.has(c) ? (
                  <Svg width="76%" height="76%" viewBox="0 0 10 10" style={styles.safeX}>
                    <Line
                      x1={0}
                      y1={0}
                      x2={10}
                      y2={10}
                      stroke={c === CENTRE ? '#e8c97f' : '#c9a24f'}
                      strokeWidth={0.7}
                      opacity={0.75}
                    />
                    <Line
                      x1={10}
                      y1={0}
                      x2={0}
                      y2={10}
                      stroke={c === CENTRE ? '#e8c97f' : '#c9a24f'}
                      strokeWidth={0.7}
                      opacity={0.75}
                    />
                  </Svg>
                ) : null}
                {c === CENTRE ? <Text style={styles.homeLabel}>home</Text> : null}
                {hoverCell === c || reveal?.cell === c ? (
                  <View
                    style={[
                      styles.cellHighlight,
                      reveal?.cell === c || hovered?.captures.length
                        ? styles.cellCapture
                        : styles.cellTarget,
                    ]}
                  />
                ) : null}
                {label ? (
                  <View
                    style={[
                      styles.cellTag,
                      label === 'capture'
                        ? styles.tagCapture
                        : label === 'safe'
                          ? styles.tagSafe
                          : styles.tagInfo,
                    ]}
                  >
                    <Text style={styles.tagText}>{label}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          {seats.flatMap((seat) =>
            pawns[seat].map((pos, i) => {
              let x: number;
              let y: number;
              if (pos === OFF) ({ x, y } = yardSpot(seat, i));
              else {
                const c = pos === HOME ? CENTRE : cellOf(seat, pos);
                const group = groups.get(c)!;
                const j = group.findIndex((g) => g.seat === seat && g.i === i);
                const { dx, dy } = cluster(j, group.length);
                ({ x, y } = centreOf(c));
                x += dx;
                y += dy;
              }
              const canMove = movable(seat, i);
              const locked = seat === turn && gateBlocked.includes(i);
              const doomed = reveal?.captured.some((c) => c.seat === seat && c.pawn === i);
              const colour = SEAT_COLOURS[seat];
              return (
                <Pressable
                  key={`${seat}-${i}`}
                  disabled={!canMove || !onPawn}
                  onPress={() => onPawn?.(i)}
                  onPressIn={() => canMove && setHover(i)}
                  onPressOut={() => setHover(null)}
                  accessibilityLabel={`${SEAT_NAMES[seat]} pawn ${i + 1}${
                    pos === OFF ? ' (waiting to enter)' : pos === HOME ? ' (home)' : ''
                  }${canMove ? ', can move' : ''}`}
                  style={[
                    styles.pawn,
                    {
                      width: pawnSize,
                      height: pawnSize,
                      left: `${x}%`,
                      top: `${y}%`,
                      marginLeft: -pawnSize / 2,
                      marginTop: -pawnSize / 2,
                      transform: [{ scale: doomed ? 1.15 : 1 }],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.55)', colour.fill, colour.rim]}
                    locations={[0, 0.45, 1]}
                    start={{ x: 0.35, y: 0.3 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.pawnFill}
                  />
                  {canMove ? <View style={styles.movableRing} /> : null}
                  {doomed ? <View style={styles.doomedRing} /> : null}
                  {locked ? (
                    <View style={styles.lockBadge}>
                      <Lock color={colors.wood900} size={8} />
                    </View>
                  ) : null}
                </Pressable>
              );
            }),
          )}
        </View>
      )}
    </View>
  );
}

/** Four cowries. Mouth up = the toothed opening shows; mouth down = the smooth humped back. */
export function Shells({
  shells,
  rolling,
  value,
}: {
  shells: boolean[] | null;
  rolling: boolean;
  value: number | null;
}) {
  const faces = shells ?? [true, false, true, false];
  const name = value === 4 ? 'Chamma' : value === 8 ? 'Ashta' : null;
  const showValue = value !== null && !rolling;
  return (
    <View style={styles.shellsWrap}>
      <View style={styles.shellsRow}>
        {faces.map((up, k) => (
          <RollingShell
            key={k}
            index={k}
            rolling={rolling}
            up={rolling ? k % 2 === 0 : up}
            dim={!shells && !rolling}
          />
        ))}
      </View>
      <View style={styles.valueSlot}>
        {showValue ? (
          <ValuePill
            text={name ? `${name} – ${value}, throw again!` : `Move ${value}`}
            bonus={!!name}
          />
        ) : null}
      </View>
    </View>
  );
}

function ValuePill({ text, bonus }: { text: string; bonus: boolean }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 220, easing: ROLL_EASE });
  }, [text, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(opacity.value, [0, 1], [0.88, 1]) }],
  }));

  return (
    <Animated.View style={[styles.valuePill, bonus ? styles.valueBonus : styles.valueNormal, style]}>
      <Text style={[styles.valueText, bonus ? styles.valueBonusText : null]}>{text}</Text>
    </Animated.View>
  );
}

/**
 * Web keyframes on one progress (UI thread): rotate + bounce + light scale.
 * Tiny stagger only — still one animation per shell, so it stays smooth.
 */
function RollingShell({
  index,
  rolling,
  up,
  dim,
}: {
  index: number;
  rolling: boolean;
  up: boolean;
  dim: boolean;
}) {
  const restDeg = index * 9 - 13;
  const midDeg = 200 + index * 60;
  const endDeg = 360 + index * 90;
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    if (rolling) {
      progress.value = 0;
      progress.value = withDelay(
        index * STAGGER_MS,
        withTiming(1, { duration: ROLL_MS, easing: ROLL_EASE }),
      );
      return;
    }
    // Snap to rest — don't rewind mid-spin.
    progress.value = 0;
  }, [rolling, index, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    if (p <= 0.001) {
      return { transform: [{ translateY: 0 }, { rotate: `${restDeg}deg` }, { scale: 1 }] };
    }
    return {
      transform: [
        { translateY: interpolate(p, [0, 0.45, 1], [0, -16, 0]) },
        { rotate: `${interpolate(p, [0, 0.45, 1], [0, midDeg, endDeg])}deg` },
        { scale: interpolate(p, [0, 0.45, 1], [1, 1.1, 1]) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.shellSlot, style]}>
      <Cowrie up={up} dim={dim} />
    </Animated.View>
  );
}

function Cowrie({ up, dim }: { up: boolean; dim: boolean }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 32 40" opacity={dim ? 0.4 : 1} accessibilityLabel={up ? 'mouth up' : 'mouth down'}>
      <Ellipse cx={16} cy={20} rx={13} ry={18} fill={up ? '#f5ead2' : '#e9d6ad'} stroke="#8a7350" strokeWidth={1} />
      {up ? (
        <>
          <Path d="M16 4 Q13 20 16 36" stroke="#5e4a2e" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          {[9, 14, 19, 24, 29].map((y) => (
            <GLines key={y} y={y} />
          ))}
        </>
      ) : (
        <>
          <Ellipse cx={16} cy={20} rx={9} ry={13} fill="#d8bf8e" opacity={0.7} />
          {[
            [12, 12],
            [19, 15],
            [14, 23],
            [20, 27],
            [11, 29],
          ].map(([x, y]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="#a07a44" opacity={0.7} />
          ))}
          <Ellipse cx={12} cy={11} rx={4} ry={2} fill="#fff" opacity={0.5} />
        </>
      )}
    </Svg>
  );
}

function GLines({ y }: { y: number }) {
  return (
    <>
      <Line x1={12.6} y1={y} x2={15} y2={y} stroke="#6b5636" strokeWidth={0.9} />
      <Line x1={17} y1={y} x2={19.4} y2={y} stroke="#6b5636" strokeWidth={0.9} />
    </>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: { position: 'relative' },
  carved: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.brassDim,
    overflow: 'hidden',
  },
  cell: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 15, 13, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeX: { position: 'absolute' },
  homeLabel: {
    position: 'absolute',
    bottom: 2,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(232, 194, 122, 0.7)',
  },
  cellHighlight: {
    ...StyleSheet.absoluteFill,
    margin: '6%',
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  cellCapture: {
    borderColor: colors.rose,
    backgroundColor: 'rgba(253, 164, 175, 0.15)',
  },
  cellTarget: {
    borderColor: colors.amber200,
    backgroundColor: 'rgba(232, 194, 122, 0.1)',
  },
  cellTag: {
    position: 'absolute',
    top: -8,
    zIndex: 30,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagCapture: { backgroundColor: colors.rose },
  tagSafe: { backgroundColor: colors.emerald },
  tagInfo: { backgroundColor: colors.amber200 },
  tagText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.wood950,
  },
  pawn: { position: 'absolute', zIndex: 20 },
  pawnFill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  movableRing: {
    ...StyleSheet.absoluteFill,
    margin: -4,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.amber200,
  },
  doomedRing: {
    ...StyleSheet.absoluteFill,
    margin: -4,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.rose,
  },
  lockBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shellsWrap: { alignItems: 'center', gap: 4, height: 76, justifyContent: 'center' },
  shellsRow: { flexDirection: 'row', gap: 8, height: 48, alignItems: 'center', overflow: 'visible' },
  shellSlot: { width: 32, height: 40 },
  valueSlot: { height: 28, justifyContent: 'center', alignItems: 'center' },
  valuePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  valueBonus: { backgroundColor: colors.amber300 },
  valueNormal: { backgroundColor: colors.wood950 },
  valueText: { fontSize: 13, fontWeight: '700', color: colors.amber100 },
  valueBonusText: { color: colors.wood950 },
});
