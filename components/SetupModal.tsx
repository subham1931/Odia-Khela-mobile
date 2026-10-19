import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Bot, Play, Users, Wifi } from 'lucide-react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AIDifficulty, GameVariant, PasuRule } from '@odiakhela/engine/types';
import { VARIANTS } from '@odiakhela/engine/variants';
import { colors } from '@/constants/theme';
import { gameInfo, type MobileGameId } from '@/lib/games';
import { type HuntSide, type PlayMode, useSettings } from '@/store/settings';
import { Segmented } from './Segmented';

const PASU_LABEL: Record<PasuRule, string> = {
  off: 'Off',
  pit_owner: 'Pit owner',
  sower: 'Sower',
};

const OPEN_MS = 320;
const CLOSE_MS = 240;

export function SetupModal({
  visible,
  gameId,
  onClose,
  onStart,
}: {
  visible: boolean;
  gameId: MobileGameId;
  onClose: () => void;
  onStart: () => void;
}) {
  const insets = useSafeAreaInsets();
  const s = useSettings();
  const info = gameInfo(gameId);
  const isMancala = info.kind === 'mancala';
  const cfg = isMancala ? VARIANTS[gameId as GameVariant] : null;
  const seeds =
    cfg && cfg.seedsPerPitOptions.includes(s.seedsPerPit) ? s.seedsPerPit : (cfg?.seedsPerPit ?? 5);

  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [visible, mounted, progress]);

  const requestClose = () => {
    if (!visible) return;
    onClose();
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 420 }],
    opacity: 0.55 + progress.value * 0.45,
  }));

  if (!mounted) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={requestClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <Animated.View
        style={[styles.sheet, sheetStyle, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <View style={styles.handle} />

        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Image source={info.cover} style={styles.heroIcon} contentFit="cover" />
            <View style={styles.heroText}>
              <Text style={styles.region}>{info.region}</Text>
              <Text style={styles.name}>{info.name}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Opponent</Text>
            <View style={styles.modeRow}>
              {(
                [
                  { id: 'ai' as PlayMode, label: 'Machine', Icon: Bot },
                  { id: 'local' as PlayMode, label: 'Pass & play', Icon: Users },
                ] as const
              ).map(({ id, label, Icon }) => (
                <Pressable
                  key={id}
                  onPress={() => s.set({ mode: id })}
                  style={[styles.choice, s.mode === id && styles.choiceOn]}
                >
                  <Icon color={s.mode === id ? colors.amber100 : colors.textMuted} size={13} />
                  <Text style={[styles.choiceText, s.mode === id && styles.choiceTextOn]}>{label}</Text>
                </Pressable>
              ))}
              <View style={[styles.choice, styles.choiceDisabled]}>
                <Wifi color={colors.textFaint} size={13} />
                <Text style={[styles.choiceText, { color: colors.textFaint }]}>Online</Text>
              </View>
            </View>
          </View>

          {s.mode === 'ai' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Difficulty</Text>
              <Segmented
                value={s.aiDifficulty}
                options={['easy', 'medium', 'hard'] as AIDifficulty[]}
                onChange={(aiDifficulty) => s.set({ aiDifficulty })}
              />
            </View>
          )}

          {info.kind === 'hunt' && s.mode === 'ai' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>You play</Text>
              <Segmented
                value={s.huntSide}
                options={['goat', 'tiger'] as HuntSide[]}
                format={(v) => (v === 'goat' ? 'Goats' : 'Tigers')}
                onChange={(huntSide) => s.set({ huntSide })}
              />
            </View>
          )}

          {info.kind === 'capture' && s.mode === 'ai' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>You play</Text>
              <Segmented
                value={s.dashSide}
                options={[0, 1] as const}
                format={(v) => (v === 0 ? 'Ivory (first)' : 'Ebony')}
                onChange={(dashSide) => s.set({ dashSide })}
              />
            </View>
          )}

          {info.kind === 'race' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Players</Text>
              <Segmented
                value={s.chowkaPlayers}
                options={[2, 3, 4] as const}
                onChange={(chowkaPlayers) => s.set({ chowkaPlayers })}
              />
            </View>
          )}

          {cfg && cfg.seedsPerPitOptions.length > 1 && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Counters per pit</Text>
              <Segmented
                value={seeds}
                options={cfg.seedsPerPitOptions}
                onChange={(seedsPerPit) => s.set({ seedsPerPit })}
              />
            </View>
          )}

          {cfg?.id === 'kasadi' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Pasu (four) rule</Text>
              <Segmented
                value={s.pasu}
                options={['off', 'pit_owner', 'sower'] as PasuRule[]}
                format={(p) => PASU_LABEL[p]}
                onChange={(pasu) => s.set({ pasu })}
              />
            </View>
          )}

          <Pressable style={styles.brassBtn} onPress={onStart}>
            <Play color={colors.wood950} size={16} />
            <Text style={styles.brassBtnText}>Begin match</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.wood900,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(201, 162, 79, 0.45)',
    overflow: 'hidden',
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(201, 162, 79, 0.35)',
    marginTop: 10,
    marginBottom: 4,
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: colors.wood950,
    borderBottomWidth: 1,
    borderBottomColor: colors.brassDim,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 79, 0.4)',
    backgroundColor: colors.wood900,
  },
  heroText: { flex: 1, minWidth: 0 },
  region: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.brass,
  },
  name: { marginTop: 3, fontSize: 24, fontWeight: '700', color: colors.amber50 },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 12 },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: {
    flexGrow: 1,
    minWidth: '28%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: colors.wood950,
  },
  choiceOn: {
    borderColor: colors.brass,
    backgroundColor: 'rgba(201, 162, 79, 0.2)',
  },
  choiceDisabled: { opacity: 0.45 },
  choiceText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  choiceTextOn: { color: colors.amber100 },
  brassBtn: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.brass,
    borderRadius: 12,
    paddingVertical: 12,
  },
  brassBtnText: { color: colors.wood950, fontSize: 15, fontWeight: '800' },
});
