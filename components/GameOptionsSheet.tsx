import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FastForward, X } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { type AnimationSpeed, type SeedStyle, useSettings } from '@/store/settings';
import { Segmented } from './Segmented';

const OPEN_MS = 280;
const CLOSE_MS = 220;

export function GameOptionsSheet({
  visible,
  onClose,
  showCounters = false,
  showPathHints = false,
  showRotate = false,
  canSkip = false,
  onSkip,
}: {
  visible: boolean;
  onClose: () => void;
  /** Mancala: cowrie / tamarind / pebble counters. */
  showCounters?: boolean;
  /** Mancala: projected sow path. */
  showPathHints?: boolean;
  /** Mancala pass-and-play: flip board for player 2. */
  showRotate?: boolean;
  canSkip?: boolean;
  onSkip?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const s = useSettings();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [visible, mounted, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * 320 }],
  }));

  if (!mounted) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 12),
            paddingRight: Math.max(insets.right, 14),
          },
        ]}
      >
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Match options</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8} accessibilityLabel="Close options">
            <X color={colors.amber100} size={16} />
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Speed</Text>
          <Segmented
            value={s.speed}
            options={['slow', 'normal', 'fast'] as AnimationSpeed[]}
            onChange={(speed) => s.set({ speed })}
          />
        </View>

        {showCounters ? (
          <View style={styles.field}>
            <Text style={styles.label}>Counters</Text>
            <Segmented
              value={s.seedStyle}
              options={['cowrie', 'tamarind', 'pebble'] as SeedStyle[]}
              onChange={(seedStyle) => s.set({ seedStyle })}
            />
          </View>
        ) : null}

        {showPathHints ? (
          <Toggle
            label="Path hints"
            on={s.showProjection}
            onChange={(showProjection) => s.set({ showProjection })}
          />
        ) : null}

        <Toggle label="Haptics" on={s.haptics} onChange={(haptics) => s.set({ haptics })} />

        {showRotate ? (
          <Toggle
            label="Rotate for P2"
            on={s.rotateForPlayer2}
            onChange={(rotateForPlayer2) => s.set({ rotateForPlayer2 })}
          />
        ) : null}

        {onSkip ? (
          <Pressable
            onPress={() => {
              onSkip();
              onClose();
            }}
            disabled={!canSkip}
            style={[styles.skipBtn, !canSkip && styles.skipDisabled]}
          >
            <FastForward color={canSkip ? colors.wood950 : colors.textFaint} size={16} />
            <Text style={[styles.skipText, !canSkip && { color: colors.textFaint }]}>Skip animation</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable style={styles.toggle} onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityState={{ selected: on }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.track, on && styles.trackOn]}>
        <View style={[styles.thumb, on ? styles.thumbOn : styles.thumbOff]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: 300,
    maxWidth: '88%',
    height: '100%',
    backgroundColor: colors.wood900,
    borderLeftWidth: 1,
    borderColor: 'rgba(201, 162, 79, 0.4)',
    paddingLeft: 16,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brassDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: 6 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLabel: { color: 'rgba(245, 230, 200, 0.85)', fontSize: 14, fontWeight: '600' },
  track: {
    width: 40,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.wood700,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.brass },
  thumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.amber50 },
  thumbOn: { alignSelf: 'flex-end', marginRight: 3 },
  thumbOff: { alignSelf: 'flex-start', marginLeft: 3 },
  skipBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brass,
    borderRadius: 12,
    paddingVertical: 12,
  },
  skipDisabled: { backgroundColor: colors.wood800 },
  skipText: { color: colors.wood950, fontSize: 14, fontWeight: '800' },
});
