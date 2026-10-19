import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Hand, X } from 'lucide-react-native';
import type { CaptureReason, Player } from '@odiakhela/engine/types';
import { colors } from '@/constants/theme';
import type { SeedStyle } from '@/store/settings';
import { hash, Seed } from './Seed';

export type PitFlash = CaptureReason | 'halt' | 'kada' | null;
export type PitMarker = 'last' | 'gap' | 'target' | 'landing' | 'opposite' | 'pair';

const MAX_DRAWN = 28;

export interface PitProps {
  index: number;
  count: number;
  owner: Player;
  dead: boolean;
  legal: boolean;
  projected: number;
  hand: number | null;
  flash: PitFlash;
  marker?: PitMarker | null;
  seedStyle: SeedStyle;
  size: number;
  label: string;
  onSelect: (pit: number) => void;
  onPreview: (pit: number | null) => void;
}

function seedSpot(pit: number, k: number, drawn: number) {
  const r = 33 * Math.sqrt((k + 0.5) / Math.max(drawn, 7));
  const a = k * 2.39996 + hash(pit) * 6.283;
  return { left: `${50 + r * Math.cos(a)}%` as const, top: `${50 + r * Math.sin(a)}%` as const };
}

const MARKER_LABEL: Record<PitMarker, string> = {
  last: 'last',
  gap: 'empty',
  target: 'take',
  landing: 'landed',
  opposite: 'opposite',
  pair: 'pair',
};

export const Pit = memo(function Pit(props: PitProps) {
  const {
    index,
    count,
    owner,
    dead,
    legal,
    projected,
    hand,
    flash,
    marker,
    seedStyle,
    size,
    label,
    onSelect,
    onPreview,
  } = props;
  const drawn = Math.min(count, MAX_DRAWN);
  const seedSize = Math.max(8, Math.round(size * 0.3));
  const pulse = marker === 'target' || marker === 'opposite' || marker === 'pair';
  const r = size / 2;

  return (
    <Pressable
      accessibilityLabel={`${label}: ${dead ? 'dead pit' : `${count} counters`}${legal ? ', playable' : ''}`}
      disabled={!legal}
      onPress={() => onSelect(index)}
      onPressIn={() => onPreview(index)}
      onPressOut={() => onPreview(null)}
      style={({ pressed }) => [
        styles.wrap,
        { width: size, height: size, borderRadius: r },
        legal && !flash && styles.legal,
        flash === 'pasu'
          ? styles.flashPasu
          : flash === 'empty_gap' || flash === 'sweep' || flash === 'opposite'
            ? styles.flashCapture
            : flash === 'kada'
              ? styles.flashKada
              : flash
                ? styles.flashHalt
                : null,
        pressed && legal && { transform: [{ scale: 0.95 }] },
      ]}
    >
      {/* Carved hollow — matches web .pit radial */}
      <LinearGradient
        colors={dead ? ['#1d110e', '#241511'] : ['#24140f', '#2e1a15', '#3d2520', '#4d302a']}
        locations={dead ? [0, 1] : [0, 0.45, 0.75, 1]}
        start={{ x: 0.5, y: 0.15 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.hollow, { borderRadius: r }, dead && styles.dead]}
      >
        {dead ? (
          <X color="rgba(120,113,108,0.6)" size={size * 0.33} />
        ) : (
          Array.from({ length: drawn }, (_, k) => {
            const spot = seedSpot(index, k, drawn);
            return (
              <View
                key={k}
                style={[
                  styles.seed,
                  {
                    left: spot.left,
                    top: spot.top,
                    marginLeft: -seedSize / 2,
                    marginTop: -seedSize / 2,
                    shadowColor: '#000',
                    shadowOpacity: 0.55,
                    shadowRadius: 1,
                    shadowOffset: { width: 0, height: 2 },
                  },
                ]}
              >
                <Seed style={seedStyle} variantSeed={index * 97 + k} size={seedSize} />
              </View>
            );
          })
        )}
      </LinearGradient>

      {marker && (
        <View style={[styles.markerWrap, pulse && styles.markerPulse]} pointerEvents="none">
          <View
            style={[
              styles.markerRing,
              { borderRadius: r },
              marker === 'gap' || marker === 'landing' ? styles.markerGap : styles.markerTarget,
              marker === 'last' && styles.markerLast,
            ]}
          />
          <View style={[styles.markerTag, marker === 'gap' || marker === 'landing' ? styles.tagSky : styles.tagAmber]}>
            <Text style={styles.markerText}>{MARKER_LABEL[marker]}</Text>
          </View>
        </View>
      )}

      {projected > 0 && (
        <View style={[styles.projected, { borderRadius: r }]} pointerEvents="none">
          <View style={styles.projBadge}>
            <Text style={styles.projText}>+{projected}</Text>
          </View>
        </View>
      )}

      {!dead && (
        <View style={[styles.badge, owner === 0 ? styles.badgeBottom : styles.badgeTop]} pointerEvents="none">
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}

      {hand !== null && (
        <View style={styles.hand} pointerEvents="none">
          <Hand color={colors.wood950} size={12} />
          <Text style={styles.handText}>{hand}</Text>
        </View>
      )}
    </Pressable>
  );
});

const fill = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

const styles = StyleSheet.create({
  wrap: {
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hollow: {
    ...fill,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    // Carved depth
    shadowColor: '#000',
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dead: { opacity: 0.7 },
  legal: {
    shadowColor: '#fde68a',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    borderWidth: 2,
    borderColor: 'rgba(253, 230, 138, 0.7)',
  },
  flashCapture: {
    borderWidth: 4,
    borderColor: colors.amber300,
    shadowColor: colors.amber300,
    shadowOpacity: 0.75,
    shadowRadius: 12,
  },
  flashPasu: {
    borderWidth: 4,
    borderColor: colors.emerald,
    shadowColor: colors.emerald,
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  flashKada: { borderWidth: 2, borderColor: 'rgba(253, 164, 175, 0.7)' },
  flashHalt: { borderWidth: 2, borderColor: 'rgba(201, 162, 79, 0.7)' },
  seed: { position: 'absolute' },
  markerWrap: { ...fill, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  markerPulse: { opacity: 0.95 },
  markerRing: { ...fill, borderWidth: 2, margin: -3 },
  markerLast: { borderColor: 'rgba(255, 250, 240, 0.7)' },
  markerGap: { borderColor: colors.sky, borderStyle: 'dashed' },
  markerTarget: {
    borderColor: colors.amber300,
    borderWidth: 3,
    shadowColor: colors.amber300,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  markerTag: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  tagSky: { backgroundColor: colors.sky },
  tagAmber: { backgroundColor: colors.amber300 },
  markerText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.wood950,
    textTransform: 'uppercase',
  },
  projected: {
    ...fill,
    borderWidth: 2,
    borderColor: 'rgba(253, 230, 138, 0.8)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(253, 230, 138, 0.1)',
  },
  projBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    backgroundColor: '#fde68a',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  projText: { fontSize: 10, fontWeight: '700', color: colors.wood950 },
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 79, 0.6)',
    backgroundColor: 'rgba(44, 27, 24, 0.9)',
  },
  badgeBottom: { bottom: -10 },
  badgeTop: { top: -10 },
  badgeText: { color: colors.amber100, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  hand: {
    position: 'absolute',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  handText: { color: colors.wood950, fontSize: 11, fontWeight: '700' },
});
