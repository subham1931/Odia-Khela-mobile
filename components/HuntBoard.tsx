import { useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(Math.max(0, Math.floor(Math.min(width, height))));
  }, []);

  const jumpFrom = capture?.from;
  const jumpTo = capture?.to;
  const hit = size > 0 ? size * 0.15 : 0;
  const piece = size > 0 ? size * 0.12 : 0;

  return (
    <View style={styles.slot} onLayout={onLayout}>
      {size > 0 && (
        <View style={[styles.board, { width: size, height: size }]}>
          <LinearGradient
            colors={['#3a2420', '#2a1814', '#1a0f0d']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.hinge, styles.hingeLeft]} />
          <View style={[styles.hinge, styles.hingeRight]} />

          <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
            {LINES.map(([a, b]) => {
              const p = pos(a);
              const q = pos(b);
              return (
                <G key={`${a}-${b}`}>
                  <Line
                    x1={p.x}
                    y1={p.y + 0.35}
                    x2={q.x}
                    y2={q.y + 0.35}
                    stroke="rgba(255,220,170,0.12)"
                    strokeWidth={1.1}
                    strokeLinecap="round"
                  />
                  <Line
                    x1={p.x}
                    y1={p.y}
                    x2={q.x}
                    y2={q.y}
                    stroke="#1a0f0d"
                    strokeWidth={1}
                    strokeLinecap="round"
                  />
                </G>
              );
            })}
            {capture && (
              <Line
                x1={pos(capture.from).x}
                y1={pos(capture.from).y}
                x2={pos(capture.to).x}
                y2={pos(capture.to).y}
                stroke={colors.amber300}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            )}
            {Array.from({ length: POINTS }, (_, p) => (
              <Circle key={p} cx={pos(p).x} cy={pos(p).y} r={1.3} fill={colors.brass} opacity={0.8} />
            ))}
          </Svg>

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
                    left: `${x}%`,
                    top: `${y}%`,
                    marginLeft: -hit / 2,
                    marginTop: -hit / 2,
                  },
                ]}
              >
                {isLast ? <View style={styles.lastMark} /> : null}
                {move ? (
                  <View
                    style={[
                      styles.targetRing,
                      move.kind === 'jump' ? styles.targetJump : styles.targetMove,
                    ]}
                  />
                ) : null}
                {capture?.over === p ? <View style={styles.takenRing} /> : null}
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

          {pieces.map((pc) => {
            const { x, y } = pos(pc.at);
            const isTrapped = pc.side === 'tiger' && trapped.includes(pc.at);
            const isSelected = selected === pc.at;
            const atRisk = pc.side === 'goat' && danger.includes(pc.at);
            return (
              <View
                key={pc.id}
                pointerEvents="none"
                style={[
                  styles.piece,
                  {
                    width: piece,
                    height: piece,
                    left: `${x}%`,
                    top: `${y}%`,
                    marginLeft: -piece / 2,
                    marginTop: -piece / 2,
                    transform: [{ scale: isSelected ? 1.12 : 1 }],
                  },
                ]}
              >
                <Token side={pc.side} id={pc.id} />
                {isSelected ? <View style={styles.selectedRing} /> : null}
                {selectable.has(pc.at) && !isSelected ? <View style={styles.selectableRing} /> : null}
                {isTrapped ? (
                  <>
                    <View style={styles.trappedRing} />
                    <View style={styles.trappedBadge}>
                      <Text style={styles.trappedText}>trapped</Text>
                    </View>
                  </>
                ) : null}
                {atRisk ? (
                  <View style={styles.dangerBadge}>
                    <Text style={styles.dangerText}>!</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
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
    overflow: 'hidden',
    position: 'relative',
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
    position: 'absolute',
    left: '18%',
    right: '18%',
    top: '18%',
    bottom: '18%',
    borderRadius: 999,
    backgroundColor: 'rgba(245, 230, 200, 0.1)',
  },
  targetRing: {
    position: 'absolute',
    left: '16%',
    right: '16%',
    top: '16%',
    bottom: '16%',
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
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '10%',
    bottom: '10%',
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
  piece: {
    position: 'absolute',
    zIndex: 20,
  },
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
