import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop } from 'react-native-svg';
import { type DashMove, POINTS, SEGMENTS, type Side } from '@odiakhela/engine/dash';
import { colors } from '@/constants/theme';
import type { DashPiece } from '@/hooks/useDashGame';

/** Board units → % of the square container (the board spans x, y ∈ [-3, 3]). */
const SCALE = 14;
const pos = (p: number) => ({ x: 50 + POINTS[p].x * SCALE, y: 50 + POINTS[p].y * SCALE });

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };
const EXIT_MS = 450;
const LINE_MS = 350;

const AnimatedLine = Animated.createAnimatedComponent(Line);

export const DASH_NAMES: Record<Side, string> = { 0: 'Ivory', 1: 'Ebony' };

export interface DashBoardProps {
  pieces: DashPiece[];
  targets?: Map<number, DashMove>;
  selectable?: Set<number>;
  selected?: number | null;
  jumping?: Extract<DashMove, { kind: 'jump' }> | null;
  lastMove?: DashMove | null;
  chainFrom?: number | null;
  danger?: number[];
  labels?: Record<number, string>;
  onTap?: (p: number) => void;
}

export function DashBoard({
  pieces,
  targets = new Map(),
  selectable = new Set(),
  selected = null,
  jumping = null,
  lastMove = null,
  chainFrom = null,
  danger = [],
  labels = {},
  onTap,
}: DashBoardProps) {
  const [size, setSize] = useState(0);
  const [ghosts, setGhosts] = useState<DashPiece[]>([]);
  const prevPieces = useRef(pieces);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(Math.max(0, Math.floor(Math.min(width, height))));
  }, []);

  // Capture exit ghosts (web AnimatePresence) — piece fades/flies off when taken.
  useEffect(() => {
    const prev = prevPieces.current;
    const gone = prev.filter((p) => !pieces.some((n) => n.id === p.id));
    if (gone.length) {
      setGhosts((cur) => {
        const ids = new Set(cur.map((g) => g.id));
        return [...cur, ...gone.filter((g) => !ids.has(g.id))];
      });
    }
    prevPieces.current = pieces;
  }, [pieces]);

  const dismissGhost = useCallback((id: number) => {
    setGhosts((cur) => cur.filter((g) => g.id !== id));
  }, []);

  const hit = size > 0 ? size * 0.13 : 0;
  const pieceSize = size > 0 ? size * 0.1 : 0;

  const jumpLine = useMemo(() => {
    if (!jumping || size <= 0) return null;
    const a = pos(jumping.from);
    const b = pos(jumping.to);
    return {
      x1: (a.x / 100) * size,
      y1: (a.y / 100) * size,
      x2: (b.x / 100) * size,
      y2: (b.y / 100) * size,
      len: Math.hypot(((b.x - a.x) / 100) * size, ((b.y - a.y) / 100) * size),
    };
  }, [jumping, size]);

  return (
    <View style={styles.slot} onLayout={onLayout}>
      {size > 0 && (
        <View style={[styles.board, { width: size, height: size }]}>
          <View style={styles.boardClip}>
            <LinearGradient
              colors={['#3a2420', '#2a1814', '#1a0f0d']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
            {SEGMENTS.map(([a, b]) => {
              const p = pos(a);
              const q = pos(b);
              const x1 = (p.x / 100) * size;
              const y1 = (p.y / 100) * size;
              const x2 = (q.x / 100) * size;
              const y2 = (q.y / 100) * size;
              const sw = size / 100;
              return (
                <G key={`${a}-${b}`}>
                  <Line
                    x1={x1}
                    y1={y1 + 0.35 * sw}
                    x2={x2}
                    y2={y2 + 0.35 * sw}
                    stroke="rgba(255,220,170,0.12)"
                    strokeWidth={1.1 * sw}
                    strokeLinecap="round"
                  />
                  <Line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#1a0f0d"
                    strokeWidth={1 * sw}
                    strokeLinecap="round"
                  />
                </G>
              );
            })}
            {jumpLine ? <JumpArc line={jumpLine} /> : null}
            {POINTS.map((pt) => {
              const p = pos(pt.id);
              return (
                <Circle
                  key={pt.id}
                  cx={(p.x / 100) * size}
                  cy={(p.y / 100) * size}
                  r={(size / 100) * 1.3}
                  fill={colors.brass}
                  opacity={0.8}
                />
              );
            })}
            </Svg>
          </View>
          <View style={[styles.hinge, styles.hingeLeft]} />
          <View style={[styles.hinge, styles.hingeRight]} />

          {POINTS.map(({ id: p }) => {
            const move = targets.get(p);
            const label =
              labels[p] ??
              (jumping?.over === p
                ? 'taken'
                : jumping?.to === p
                  ? 'landed'
                  : jumping?.from === p
                    ? 'jumped'
                    : move?.kind === 'jump'
                      ? 'jump'
                      : null);
            const isLast = lastMove && !jumping && (lastMove.to === p || lastMove.from === p);
            const { x, y } = pos(p);
            const disabled = !onTap || (!move && !selectable.has(p) && selected === null);

            return (
              <Pressable
                key={p}
                disabled={disabled}
                onPress={() => onTap?.(p)}
                accessibilityLabel={`Point ${p}${
                  move
                    ? move.kind === 'jump'
                      ? ': jump here and capture'
                      : ': move here'
                    : selectable.has(p)
                      ? ': pick up'
                      : ''
                }`}
                style={[
                  styles.hit,
                  {
                    width: hit,
                    height: hit,
                    left: (x / 100) * size - hit / 2,
                    top: (y / 100) * size - hit / 2,
                  },
                ]}
              >
                {isLast ? <View style={styles.lastMark} /> : null}
                {move ? <PulseTarget jump={move.kind === 'jump'} /> : null}
                {jumping?.over === p ? <PulseTaken /> : null}
                {label ? (
                  <View
                    style={[
                      styles.label,
                      label === 'taken'
                        ? styles.labelTaken
                        : label === 'jump'
                          ? styles.labelJump
                          : styles.labelInfo,
                    ]}
                  >
                    <Text style={styles.labelText}>{label}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          {pieces.map((pc) => (
            <AnimatedPiece
              key={pc.id}
              piece={pc}
              size={pieceSize}
              boardSize={size}
              selected={selected === pc.at}
              canPick={selectable.has(pc.at)}
              chain={chainFrom === pc.at}
              danger={danger.includes(pc.at)}
            />
          ))}

          {ghosts.map((pc) => (
            <ExitingPiece
              key={`ghost-${pc.id}`}
              piece={pc}
              size={pieceSize}
              boardSize={size}
              onDone={() => dismissGhost(pc.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** Web: motion.line pathLength 0→1 over 0.35s. */
function JumpArc({ line }: { line: { x1: number; y1: number; x2: number; y2: number; len: number } }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: LINE_MS, easing: Easing.out(Easing.cubic) });
  }, [line.x1, line.y1, line.x2, line.y2, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: line.len * (1 - progress.value),
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 1, 1]),
  }));

  return (
    <AnimatedLine
      x1={line.x1}
      y1={line.y1}
      x2={line.x2}
      y2={line.y2}
      stroke={colors.amber300}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeDasharray={[line.len, line.len]}
      animatedProps={animatedProps}
    />
  );
}

/** Web: target pulse scale [1, 1.12, 1]. */
function PulseTarget({ jump }: { jump: boolean }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 550, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 550, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[styles.targetRing, jump ? styles.targetJump : styles.targetMove, style]}
      pointerEvents="none"
    />
  );
}

/** Web: taken ring pulse scale + opacity. */
function PulseTaken() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.6, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.12]) }],
  }));

  return <Animated.View style={[styles.takenRing, style]} pointerEvents="none" />;
}

/** Web: spring between board points; scale up when selected. */
function AnimatedPiece({
  piece,
  size,
  boardSize,
  selected,
  canPick,
  chain,
  danger,
}: {
  piece: DashPiece;
  size: number;
  boardSize: number;
  selected: boolean;
  canPick: boolean;
  chain: boolean;
  danger: boolean;
}) {
  const { x, y } = pos(piece.at);
  const px = (x / 100) * boardSize - size / 2;
  const py = (y / 100) * boardSize - size / 2;
  const left = useSharedValue(px);
  const top = useSharedValue(py);
  const scale = useSharedValue(selected ? 1.12 : 1);
  const appear = useSharedValue(1);
  const booted = useRef(false);

  useEffect(() => {
    if (!booted.current) {
      booted.current = true;
      left.value = px;
      top.value = py;
      appear.value = 0;
      appear.value = withSpring(1, SPRING);
      return;
    }
    left.value = withSpring(px, SPRING);
    top.value = withSpring(py, SPRING);
  }, [px, py, left, top, appear]);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.12 : 1, SPRING);
  }, [selected, scale]);

  const style = useAnimatedStyle(() => ({
    left: left.value,
    top: top.value,
    opacity: appear.value,
    transform: [{ scale: scale.value * appear.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.piece, { width: size, height: size }, style]}
    >
      <Guti side={piece.side} id={piece.id} />
      {selected ? <View style={styles.selectedRing} /> : null}
      {canPick && !selected ? <View style={styles.selectableRing} /> : null}
      {chain ? (
        <View style={styles.chainBadge}>
          <Text style={styles.chainText}>jump again</Text>
        </View>
      ) : null}
      {danger ? (
        <View style={styles.dangerBadge}>
          <Text style={styles.dangerText}>!</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Web exit: scale 0.2, opacity 0, y -24 over 0.45s. */
function ExitingPiece({
  piece,
  size,
  boardSize,
  onDone,
}: {
  piece: DashPiece;
  size: number;
  boardSize: number;
  onDone: () => void;
}) {
  const { x, y } = pos(piece.at);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) {
        // runOnJS not imported — call via setTimeout from JS by scheduling done
      }
    });
    const t = setTimeout(onDone, EXIT_MS);
    return () => clearTimeout(t);
  }, [progress, onDone]);

  const style = useAnimatedStyle(() => ({
    left: (x / 100) * boardSize - size / 2,
    top: (y / 100) * boardSize - size / 2 + interpolate(progress.value, [0, 1], [0, -24]),
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.2]) }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.piece, { width: size, height: size }, style]}>
      <Guti side={piece.side} id={piece.id + 1000} />
    </Animated.View>
  );
}

/** A turned wooden piece: ivory (moves first) or ebony. */
export function Guti({ side, id = 0, size = '100%' }: { side: Side; id?: number; size?: number | string }) {
  const gid = `guti-${side}-${id}`;
  const [hi, mid, lo, rim] =
    side === 0 ? ['#fffaf0', '#efe2c4', '#c7ad80', '#8a7350'] : ['#7a5a48', '#3a2620', '#1a0f0d', '#c9a24f'];
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel={DASH_NAMES[side]}>
      <Defs>
        <RadialGradient id={gid} cx="38%" cy="32%" r="72%">
          <Stop offset="0%" stopColor={hi} />
          <Stop offset="55%" stopColor={mid} />
          <Stop offset="100%" stopColor={lo} />
        </RadialGradient>
      </Defs>
      <Circle cx={20} cy={20} r={18} fill={`url(#${gid})`} stroke={rim} strokeWidth={1.6} />
      <Circle cx={20} cy={20} r={11} fill="none" stroke={rim} strokeWidth={1} opacity={0.6} />
      <Circle cx={20} cy={20} r={3} fill={rim} opacity={0.55} />
    </Svg>
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
  board: {
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.brassDim,
    overflow: 'visible',
    position: 'relative',
  },
  boardClip: {
    ...StyleSheet.absoluteFill,
    borderRadius: 26,
    overflow: 'hidden',
  },
  hinge: {
    position: 'absolute',
    top: -4,
    width: 18,
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.brass,
    zIndex: 5,
  },
  hingeLeft: { left: 28 },
  hingeRight: { right: 28 },
  hit: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastMark: {
    ...StyleSheet.absoluteFill,
    margin: '18%',
    borderRadius: 999,
    backgroundColor: 'rgba(245, 230, 200, 0.1)',
  },
  targetRing: {
    ...StyleSheet.absoluteFill,
    margin: '16%',
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  targetJump: {
    borderColor: colors.amber300,
    backgroundColor: 'rgba(252, 211, 77, 0.25)',
  },
  targetMove: {
    borderColor: 'rgba(232, 194, 122, 0.8)',
    backgroundColor: 'rgba(232, 194, 122, 0.1)',
  },
  takenRing: {
    ...StyleSheet.absoluteFill,
    margin: '10%',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.rose,
  },
  label: {
    position: 'absolute',
    bottom: -2,
    zIndex: 30,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  labelTaken: { backgroundColor: colors.rose },
  labelJump: { backgroundColor: colors.amber300 },
  labelInfo: { backgroundColor: colors.sky },
  labelText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.wood950,
  },
  piece: { position: 'absolute', zIndex: 20 },
  selectedRing: {
    ...StyleSheet.absoluteFill,
    margin: -4,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.amber200,
  },
  selectableRing: {
    ...StyleSheet.absoluteFill,
    margin: -2,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(232, 194, 122, 0.6)',
  },
  chainBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -28 }],
    backgroundColor: colors.amber300,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  chainText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.wood950,
  },
  dangerBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fb7185',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: { color: '#fff', fontSize: 10, fontWeight: '900' },
});
