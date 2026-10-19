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
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import {
  LINES,
  type HuntMove,
  pointCol,
  pointName,
  pointRow,
  POINTS,
  type Side,
} from '@odiakhela/engine/hunt';
import { colors } from '@/constants/theme';
import type { HuntPiece } from '@/hooks/useHuntGame';

const PAD = 9;
const STEP = (100 - 2 * PAD) / 4;
const pos = (p: number) => ({ x: PAD + pointCol(p) * STEP, y: PAD + pointRow(p) * STEP });

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };
const EXIT_MS = 500;
const LINE_MS = 400;

const AnimatedLine = Animated.createAnimatedComponent(Line);

export interface HuntBoardProps {
  pieces: HuntPiece[];
  targets?: Map<number, HuntMove>;
  selectable?: Set<number>;
  selected?: number | null;
  capture?: Extract<HuntMove, { kind: 'jump' }> | null;
  lastMove?: HuntMove | null;
  trapped?: number[];
  danger?: number[];
  onTap?: (point: number) => void;
  labels?: Record<number, string>;
}

export function HuntBoard({
  pieces,
  targets = new Map(),
  selectable = new Set(),
  selected = null,
  capture = null,
  lastMove = null,
  trapped = [],
  danger = [],
  onTap,
  labels = {},
}: HuntBoardProps) {
  const [size, setSize] = useState(0);
  const [ghosts, setGhosts] = useState<HuntPiece[]>([]);
  const prevPieces = useRef(pieces);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(Math.max(0, Math.floor(Math.min(width, height))));
  }, []);

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

  const jumpFrom = capture?.from;
  const jumpTo = capture?.to;
  const hit = size > 0 ? size * 0.15 : 0;
  const pieceSize = size > 0 ? size * 0.12 : 0;

  const jumpLine = useMemo(() => {
    if (!capture || size <= 0) return null;
    const a = pos(capture.from);
    const b = pos(capture.to);
    return {
      x1: (a.x / 100) * size,
      y1: (a.y / 100) * size,
      x2: (b.x / 100) * size,
      y2: (b.y / 100) * size,
      len: Math.hypot(((b.x - a.x) / 100) * size, ((b.y - a.y) / 100) * size),
    };
  }, [capture, size]);

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
              {LINES.map(([a, b]) => {
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
              {Array.from({ length: POINTS }, (_, p) => {
                const pt = pos(p);
                return (
                  <Circle
                    key={p}
                    cx={(pt.x / 100) * size}
                    cy={(pt.y / 100) * size}
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

          {Array.from({ length: POINTS }, (_, p) => {
            const move = targets.get(p);
            const canPick = selectable.has(p);
            const label =
              labels[p] ??
              (capture?.over === p
                ? 'taken'
                : jumpTo === p
                  ? 'landed'
                  : jumpFrom === p
                    ? 'jumped'
                    : move?.kind === 'jump'
                      ? 'jump'
                      : null);
            const isLast =
              lastMove && !capture && (lastMove.to === p || ('from' in lastMove && lastMove.from === p));
            const { x, y } = pos(p);
            const disabled = !onTap || (!move && !canPick && selected === null);

            return (
              <Pressable
                key={p}
                disabled={disabled}
                onPress={() => onTap?.(p)}
                accessibilityLabel={`${pointName(p)}${
                  move
                    ? move.kind === 'jump'
                      ? ': jump here and capture'
                      : ': move here'
                    : canPick
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
                {capture?.over === p ? <PulseTaken /> : null}
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
              trapped={pc.side === 'tiger' && trapped.includes(pc.at)}
              danger={pc.side === 'goat' && danger.includes(pc.at)}
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

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View
      style={[styles.targetRing, jump ? styles.targetJump : styles.targetMove, style]}
      pointerEvents="none"
    />
  );
}

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

function AnimatedPiece({
  piece,
  size,
  boardSize,
  selected,
  canPick,
  trapped,
  danger,
}: {
  piece: HuntPiece;
  size: number;
  boardSize: number;
  selected: boolean;
  canPick: boolean;
  trapped: boolean;
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
    <Animated.View pointerEvents="none" style={[styles.piece, { width: size, height: size }, style]}>
      <Token side={piece.side} id={piece.id} />
      {selected ? <View style={styles.selectedRing} /> : null}
      {canPick && !selected ? <View style={styles.selectableRing} /> : null}
      {trapped ? (
        <>
          <View style={styles.trappedRing} />
          <View style={styles.trappedBadge}>
            <Text style={styles.trappedText}>trapped</Text>
          </View>
        </>
      ) : null}
      {danger ? (
        <View style={styles.dangerBadge}>
          <Text style={styles.dangerText}>!</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function ExitingPiece({
  piece,
  size,
  boardSize,
  onDone,
}: {
  piece: HuntPiece;
  size: number;
  boardSize: number;
  onDone: () => void;
}) {
  const { x, y } = pos(piece.at);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
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
      <Token side={piece.side} id={piece.id + 1000} />
    </Animated.View>
  );
}

/** Tiger (Bagha) and goat (Chheli) tokens as SVG. */
export function Token({ side, id = 0, size = '100%' }: { side: Side; id?: number; size?: number | string }) {
  const gid = `tok-${side}-${id}`;
  if (side === 'tiger') {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Defs>
          <RadialGradient id={gid} cx="40%" cy="35%" r="70%">
            <Stop offset="0%" stopColor="#ffc46b" />
            <Stop offset="60%" stopColor="#e8862a" />
            <Stop offset="100%" stopColor="#a8501a" />
          </RadialGradient>
        </Defs>
        <Circle cx={20} cy={20} r={18} fill={`url(#${gid})`} stroke="#5a2a10" strokeWidth={1.2} />
        <Circle cx={9} cy={9} r={4} fill="#e8862a" stroke="#5a2a10" strokeWidth={1} />
        <Circle cx={31} cy={9} r={4} fill="#e8862a" stroke="#5a2a10" strokeWidth={1} />
        {['M6 18 Q10 17 12 20', 'M34 18 Q30 17 28 20', 'M8 25 Q12 24 13 27', 'M32 25 Q28 24 27 27', 'M17 6 Q20 10 23 6', 'M18 11 Q20 13 22 11'].map(
          (d) => (
            <Path key={d} d={d} stroke="#2a140a" strokeWidth={1.8} fill="none" strokeLinecap="round" />
          ),
        )}
        <Circle cx={15} cy={18} r={1.8} fill="#2a140a" />
        <Circle cx={25} cy={18} r={1.8} fill="#2a140a" />
        <Ellipse cx={20} cy={26} rx={6} ry={4.5} fill="#fff4dc" />
        <Path d="M18 24 L22 24 L20 26.5 Z" fill="#2a140a" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Defs>
        <RadialGradient id={gid} cx="40%" cy="35%" r="70%">
          <Stop offset="0%" stopColor="#ffffff" />
          <Stop offset="65%" stopColor="#ece2cf" />
          <Stop offset="100%" stopColor="#b9a888" />
        </RadialGradient>
      </Defs>
      <Path d="M12 9 Q8 2 4 5" stroke="#6b5636" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M28 9 Q32 2 36 5" stroke="#6b5636" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Circle cx={20} cy={21} r={16} fill={`url(#${gid})`} stroke="#8a7350" strokeWidth={1.2} />
      <Ellipse cx={5.5} cy={19} rx={4} ry={2.2} fill="#ddd0b6" stroke="#8a7350" strokeWidth={0.8} />
      <Ellipse cx={34.5} cy={19} rx={4} ry={2.2} fill="#ddd0b6" stroke="#8a7350" strokeWidth={0.8} />
      <Circle cx={15} cy={19} r={1.7} fill="#3a2a18" />
      <Circle cx={25} cy={19} r={1.7} fill="#3a2a18" />
      <Ellipse cx={20} cy={27} rx={4.5} ry={3.2} fill="#d9c9aa" />
      <Circle cx={18.4} cy={27} r={0.8} fill="#3a2a18" />
      <Circle cx={21.6} cy={27} r={0.8} fill="#3a2a18" />
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
  trappedRing: {
    ...StyleSheet.absoluteFill,
    margin: -4,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.sky,
  },
  trappedBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -22 }],
    backgroundColor: colors.sky,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  trappedText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.wood900,
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
