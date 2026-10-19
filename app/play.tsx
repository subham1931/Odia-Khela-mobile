import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { seatsFor } from '@odiakhela/engine/chowka';
import type { GameOptions, GameVariant } from '@odiakhela/engine/types';
import { VARIANTS } from '@odiakhela/engine/variants';
import { ChowkaScreen } from '@/components/ChowkaScreen';
import { DashScreen } from '@/components/DashScreen';
import { GameScreen } from '@/components/GameScreen';
import { HuntScreen } from '@/components/HuntScreen';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/constants/theme';
import type { ChowkaOptions } from '@/hooks/useChowkaGame';
import type { DashOptions } from '@/hooks/useDashGame';
import type { HuntOptions } from '@/hooks/useHuntGame';
import { prepareSounds } from '@/lib/feedback';
import { landscape, portraitUp, unlockOrientation } from '@/lib/orientation';
import { GAME_LIST, isMancalaVariant, type MobileGameId } from '@/lib/games';
import { useSettings } from '@/store/settings';

function parseGame(raw: string | string[] | undefined): MobileGameId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && GAME_LIST.some((g) => g.id === v)) return v as MobileGameId;
  return 'kasadi';
}

export default function PlayScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const params = useLocalSearchParams<{ game?: string }>();
  const gameId = parseGame(params.game);
  const s = useSettings();
  const info = GAME_LIST.find((g) => g.id === gameId)!;

  // Bagha / Chowka / Dash: start upright; rotate only if the user turns the phone.
  // Mancala stays landscape-locked for the board layout.
  const freeRotate =
    gameId === 'bagha_chheli' || gameId === 'chowka_bara' || gameId === 'dash_guti';

  useFocusEffect(
    useCallback(() => {
      prepareSounds();
      let cancelled = false;
      const timer = setTimeout(() => {
        if (cancelled) return;
        if (freeRotate) {
          // Start upright, then unlock so the user can still rotate.
          void (async () => {
            await portraitUp();
            if (!cancelled) await unlockOrientation();
          })();
        } else {
          void landscape();
        }
      }, 400);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [freeRotate]),
  );

  const mancalaOptions = useMemo<GameOptions | null>(() => {
    if (!isMancalaVariant(gameId)) return null;
    const cfg = VARIANTS[gameId as GameVariant];
    return {
      variant: gameId as GameVariant,
      seedsPerPit: cfg.seedsPerPitOptions.includes(s.seedsPerPit) ? s.seedsPerPit : cfg.seedsPerPit,
      pasu: cfg.id === 'kasadi' ? s.pasu : 'off',
      isVsAI: s.mode === 'ai',
      aiDifficulty: s.aiDifficulty,
      aiPlayer: 1,
    };
  }, [gameId, s.seedsPerPit, s.pasu, s.mode, s.aiDifficulty]);

  const huntOptions = useMemo<HuntOptions | null>(() => {
    if (gameId !== 'bagha_chheli') return null;
    return {
      humanSide: s.mode === 'ai' ? s.huntSide : null,
      aiDifficulty: s.aiDifficulty,
    };
  }, [gameId, s.mode, s.huntSide, s.aiDifficulty]);

  const dashOptions = useMemo<DashOptions | null>(() => {
    if (gameId !== 'dash_guti') return null;
    return {
      humanSide: s.mode === 'ai' ? s.dashSide : null,
      aiDifficulty: s.aiDifficulty,
    };
  }, [gameId, s.mode, s.dashSide, s.aiDifficulty]);

  const chowkaOptions = useMemo<ChowkaOptions | null>(() => {
    if (gameId !== 'chowka_bara') return null;
    const players = s.chowkaPlayers;
    const seats = seatsFor(players);
    return {
      players,
      // Pass & play: every seated colour is human (2p uses opposite seats 0+2, not 0+1).
      humanSeats: s.mode === 'ai' ? [0] : seats,
      aiDifficulty: s.aiDifficulty,
    };
  }, [gameId, s.chowkaPlayers, s.mode, s.aiDifficulty]);

  const exit = () => {
    void (async () => {
      // Unlock + portrait BEFORE leaving so home never paints in landscape.
      await portraitUp();
      if (router.canGoBack()) router.back();
      else router.replace('/');
    })();
  };

  if (status === 'unauthenticated') {
    return <Redirect href="/login" />;
  }
  if (status === 'loading') {
    return null;
  }

  if (mancalaOptions) {
    return <GameScreen key={JSON.stringify(mancalaOptions)} options={mancalaOptions} onExit={exit} />;
  }
  if (huntOptions) {
    return <HuntScreen key={JSON.stringify(huntOptions)} options={huntOptions} onExit={exit} />;
  }
  if (dashOptions) {
    return <DashScreen key={JSON.stringify(dashOptions)} options={dashOptions} onExit={exit} />;
  }
  if (chowkaOptions) {
    return <ChowkaScreen key={JSON.stringify(chowkaOptions)} options={chowkaOptions} onExit={exit} />;
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ color: colors.amber50, fontSize: 18 }}>{info.name}</Text>
      <Text style={{ color: colors.textMuted, marginTop: 8 }}>Coming soon on mobile</Text>
      <Text style={{ color: colors.brass, marginTop: 16 }} onPress={exit}>
        Back to games
      </Text>
    </View>
  );
}
