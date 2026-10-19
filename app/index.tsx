import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { HeroHeader } from '@/components/HeroHeader';
import { JuteBackground } from '@/components/JuteBackground';
import { ProfileAvatarButton } from '@/components/ProfileAvatarButton';
import { SetupModal } from '@/components/SetupModal';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import { GAME_LIST, type MobileGameId } from '@/lib/games';
import { portraitUp } from '@/lib/orientation';
import { useSettings } from '@/store/settings';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const settings = useSettings();
  const { status } = useAuth();
  const [setupGame, setSetupGame] = useState<MobileGameId | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const run = async () => {
        // After blur→focus from landscape play, wait a tick then force portrait.
        await new Promise((r) => setTimeout(r, 50));
        if (!cancelled) await portraitUp();
      };
      void run();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (status === 'loading') {
    return (
      <View style={[styles.root, styles.loading]}>
        <JuteBackground />
        <ActivityIndicator color={colors.brass} size="large" />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/login" />;
  }

  const odia = GAME_LIST.filter((g) => g.section === 'odia');
  const videshi = GAME_LIST.filter((g) => g.section === 'videshi');

  const openGame = (id: MobileGameId, available: boolean) => {
    if (!available) return;
    settings.set({ selectedGame: id });
    setSetupGame(id);
  };

  const startMatch = () => {
    if (!setupGame) return;
    const id = setupGame;
    setSetupGame(null);
    setTimeout(() => router.push({ pathname: '/play', params: { game: id } }), 280);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <JuteBackground />
      <ProfileAvatarButton />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <HeroHeader />

        <Text style={styles.sectionTitle}>Odia Khela</Text>
        <Text style={styles.sectionSub}>Games of Odisha</Text>
        {odia.map((g) =>
          g.available ? (
            <Pressable
              key={g.id}
              style={({ pressed }) => [styles.card, styles.cardLive, pressed && styles.cardPressed]}
              onPress={() => openGame(g.id, true)}
            >
              <Image source={g.cover} style={styles.icon} contentFit="cover" transition={150} />
              <View style={styles.cardText}>
                <Text style={styles.cardRegion}>{g.region}</Text>
                <Text style={styles.cardName}>{g.name}</Text>
              </View>
            </Pressable>
          ) : (
            <View key={g.id} style={[styles.card, styles.cardLocked]}>
              <Image source={g.cover} style={[styles.icon, styles.iconMuted]} contentFit="cover" />
              <View style={styles.cardText}>
                <View style={styles.lockRow}>
                  <Lock color={colors.textFaint} size={14} />
                  <Text style={styles.soon}>Coming soon</Text>
                </View>
                <Text style={styles.cardRegionMuted}>{g.region}</Text>
                <Text style={styles.cardNameMuted}>{g.name}</Text>
              </View>
            </View>
          ),
        )}

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Videshi Khela</Text>
        <Text style={styles.sectionSub}>Games from beyond</Text>
        {videshi.map((g) =>
          g.available ? (
            <Pressable
              key={g.id}
              style={({ pressed }) => [styles.card, styles.cardLive, pressed && styles.cardPressed]}
              onPress={() => openGame(g.id, true)}
            >
              <Image source={g.cover} style={styles.icon} contentFit="cover" transition={150} />
              <View style={styles.cardText}>
                <Text style={styles.cardRegion}>{g.region}</Text>
                <Text style={styles.cardName}>{g.name}</Text>
              </View>
            </Pressable>
          ) : (
            <View key={g.id} style={[styles.card, styles.cardLocked]}>
              <Image source={g.cover} style={[styles.icon, styles.iconMuted]} contentFit="cover" />
              <View style={styles.cardText}>
                <View style={styles.lockRow}>
                  <Lock color={colors.textFaint} size={14} />
                  <Text style={styles.soon}>Coming soon</Text>
                </View>
                <Text style={styles.cardRegionMuted}>{g.region}</Text>
                <Text style={styles.cardNameMuted}>{g.name}</Text>
              </View>
            </View>
          ),
        )}
      </ScrollView>

      {setupGame && (
        <SetupModal
          visible={!!setupGame}
          gameId={setupGame}
          onClose={() => setSetupGame(null)}
          onStart={startMatch}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  loading: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  sectionSub: {
    marginTop: 2,
    marginBottom: 14,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  cardLive: {
    borderColor: colors.brass,
    backgroundColor: colors.wood900,
    shadowColor: colors.brass,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  cardLocked: {
    borderColor: 'rgba(201, 162, 79, 0.15)',
    backgroundColor: 'rgba(26, 15, 13, 0.55)',
    opacity: 0.72,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.wood950,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 79, 0.35)',
  },
  iconMuted: { opacity: 0.85, borderColor: 'rgba(201, 162, 79, 0.18)' },
  cardText: { flex: 1, minWidth: 0 },
  cardRegion: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.brass,
  },
  cardRegionMuted: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  cardName: { marginTop: 4, fontSize: 24, fontWeight: '700', color: colors.amber50 },
  cardNameMuted: { marginTop: 2, fontSize: 18, fontWeight: '700', color: colors.textMuted },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  soon: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
});
