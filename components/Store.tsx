import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/constants/theme';
import type { SeedStyle } from '@/store/settings';
import { hash, Seed } from './Seed';

const MAX_DRAWN = 48;

export function Store({
  count,
  label,
  active,
  glowing,
  seedStyle,
  pitSize,
  projected = 0,
  callout = null,
  hideLabel = false,
}: {
  count: number;
  label: string;
  active: boolean;
  glowing: boolean;
  seedStyle: SeedStyle;
  pitSize: number;
  projected?: number;
  callout?: string | null;
  hideLabel?: boolean;
}) {
  const drawn = Math.min(count, MAX_DRAWN);
  const width = pitSize * 0.95;
  const height = pitSize * 2 + 28; // web: calc(var(--pit) * 2 + 1.75rem)
  const seedSize = Math.max(8, Math.round(width * 0.34));
  const r = width / 2;

  return (
    <View style={[styles.wrap, { width }]}>
      {!hideLabel && (
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.shell,
          { width, height, borderRadius: r },
          glowing && styles.glowing,
          active && !glowing && styles.active,
        ]}
        accessibilityLabel={`${label}: ${count} counters`}
      >
        <LinearGradient
          colors={['#24140f', '#2e1a15', '#3d2520', '#4d302a']}
          locations={[0, 0.45, 0.75, 1]}
          start={{ x: 0.5, y: 0.12 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.hollow, { borderRadius: r }]}
        >
          {Array.from({ length: drawn }, (_, k) => (
            <View
              key={k}
              style={[
                styles.seed,
                {
                  left: `${12 + hash(k * 13 + 1) * 54}%`,
                  bottom: `${4 + (k / MAX_DRAWN) * 78 + hash(k * 7) * 6}%`,
                  marginLeft: -seedSize / 2,
                },
              ]}
            >
              <Seed style={seedStyle} variantSeed={k * 31 + 5} size={seedSize} />
            </View>
          ))}
          <View style={styles.countWrap}>
            <Text style={styles.count}>{count}</Text>
          </View>
          {projected > 0 && (
            <View style={styles.projected} pointerEvents="none">
              <View style={styles.projBadge}>
                <Text style={styles.projText}>+{projected}</Text>
              </View>
            </View>
          )}
          {callout && (
            <View style={styles.callout}>
              <Text style={styles.calloutText}>{callout}</Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: 'rgba(245, 230, 200, 0.5)',
    textAlign: 'center',
  },
  labelActive: { color: '#fde68a' },
  shell: { overflow: 'hidden' },
  hollow: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  active: {
    borderWidth: 2,
    borderColor: 'rgba(253, 230, 138, 0.5)',
  },
  glowing: {
    borderWidth: 4,
    borderColor: colors.amber300,
    shadowColor: colors.amber300,
    shadowOpacity: 0.7,
    shadowRadius: 14,
  },
  seed: { position: 'absolute' },
  countWrap: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 79, 0.7)',
    backgroundColor: 'rgba(44, 27, 24, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    zIndex: 2,
  },
  count: {
    color: colors.amber100,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  projected: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(253, 230, 138, 0.8)',
    borderStyle: 'dashed',
  },
  projBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  projText: {
    backgroundColor: '#fde68a',
    color: colors.wood950,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  callout: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: colors.sky,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  calloutText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: colors.wood950,
  },
});
