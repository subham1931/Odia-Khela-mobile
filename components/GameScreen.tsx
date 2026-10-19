import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RotateCcw, Settings2, Volume2, VolumeX } from 'lucide-react-native';
import type { BoardView, GameOptions, SowEvent } from '@odiakhela/engine/types';
import { VARIANTS } from '@odiakhela/engine/variants';
import { useMancalaGame } from '@/hooks/useMancalaGame';
import { sounds, vibrate } from '@/lib/feedback';
import { colors } from '@/constants/theme';
import { useSettings } from '@/store/settings';
import { Board } from './Board';
import { CaptureExplainer } from './CaptureExplainer';
import { GameOptionsSheet } from './GameOptionsSheet';
import { JuteBackground } from './JuteBackground';

const CAPTURE_TEXT = {
  empty_gap: 'Capture!',
  pasu: 'Pasu!',
  sweep: 'Sweep!',
  opposite: 'Capture!',
  round_end: '',
} as const;

export function GameScreen({ options, onExit }: { options: GameOptions; onExit: () => void }) {
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onEvent = useCallback((e: SowEvent, _v: BoardView) => {
    const { sound, haptics } = settingsRef.current;
    if (!sound && !haptics) return;
    // One sound per sow step — pit drop vs store drop are distinct.
    if (e.type === 'drop' && sound) sounds.drop();
    if (e.type === 'store_drop' && sound) sounds.store();
    if (e.type === 'pickup' && sound) sounds.scoop(e.count);
    if (e.type === 'capture' && e.reason !== 'round_end') {
      if (sound) sounds.capture(e.count);
      if (haptics) void vibrate([30, 40, 60]);
    }
  }, []);

  const g = useMancalaGame(options, { speed: settings.speed, onEvent });
  const { game } = g;
  const cfg = VARIANTS[game.variant];
  const names: [string, string] = game.isVsAI ? ['You', 'Machine'] : ['Player 1', 'Player 2'];

  useEffect(() => {
    if (game.turnPhase !== 'SELECT_PIT') return;
    if (settingsRef.current.haptics) void vibrate(15);
    if (settingsRef.current.sound) sounds.turn();
  }, [game.activePlayer, game.turnPhase]);

  useEffect(() => {
    if (game.turnPhase !== 'MATCH_OVER') return;
    const humanWon = game.isVsAI ? game.winner === 0 : game.winner !== 'draw';
    if (!humanWon) return;
    if (settingsRef.current.sound) sounds.win();
    if (settingsRef.current.haptics) void vibrate([40, 60, 80]);
  }, [game.turnPhase, game.winner, game.isVsAI]);

  const lastEvent = g.activeEvent;
  const banner =
    lastEvent?.type === 'reveal'
      ? lastEvent.rule === 'extra_turn'
        ? `Free turn! ${names[lastEvent.player]} ${names[lastEvent.player] === 'You' ? 'go' : 'goes'} again`
        : `Capture! ${lastEvent.count} to ${names[game.activePlayer]}`
      : lastEvent?.type === 'capture' && lastEvent.reason !== 'round_end'
        ? `${CAPTURE_TEXT[lastEvent.reason]} +${lastEvent.count} to ${names[lastEvent.player]}`
        : lastEvent?.type === 'halt' && lastEvent.reason === 'kada'
          ? 'Kada – two empty pits, no capture'
          : null;

  const status =
    game.turnPhase === 'SOWING_ANIMATION'
      ? game.isVsAI && game.activePlayer === 0
        ? 'Sowing…'
        : `${names[game.activePlayer]} sowing…`
      : g.aiThinking
        ? 'Machine is thinking…'
        : game.turnPhase === 'SELECT_PIT'
          ? game.isVsAI
            ? 'Your move – pick a glowing pit'
            : `${names[game.activePlayer]} to move`
          : '';

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top, 6),
          paddingBottom: Math.max(insets.bottom, 6),
          paddingLeft: Math.max(insets.left, 8),
          paddingRight: Math.max(insets.right, 8),
        },
      ]}
    >
      <JuteBackground />

      <View style={styles.header}>
        <Pressable onPress={onExit} style={styles.iconBtn} accessibilityLabel="Back to games" hitSlop={8}>
          <ChevronLeft color={colors.amber100} size={20} />
        </Pressable>
        <View style={styles.headerCenter} pointerEvents="none">
          <Text style={styles.title}>{cfg.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {cfg.region}
            {cfg.multiRound ? ` · Round ${game.roundNumber}` : ''}
            {banner || status ? ` · ${banner ?? status}` : ''}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setOptionsOpen(true)}
            style={styles.iconBtn}
            accessibilityLabel="Match options"
            hitSlop={8}
          >
            <Settings2 color={colors.amber100} size={18} />
          </Pressable>
          <Pressable
            onPress={() => settings.set({ sound: !settings.sound })}
            style={styles.iconBtn}
            accessibilityLabel={settings.sound ? 'Mute' : 'Unmute'}
            hitSlop={8}
          >
            {settings.sound ? (
              <Volume2 color={colors.amber100} size={18} />
            ) : (
              <VolumeX color={colors.amber100} size={18} />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.boardSlot}>
        <Board
          game={game}
          view={g.view}
          activeEvent={g.activeEvent}
          legalMoves={g.legalMoves}
          onSelect={g.selectPit}
          previewPath={g.previewPath}
          playerNames={names}
          seedStyle={settings.seedStyle}
          showProjection={settings.showProjection}
          rotated={!game.isVsAI && settings.rotateForPlayer2 && game.activePlayer === 1}
          reveal={g.boardReveal}
        />
      </View>

      {g.explanation ? (
        <CaptureExplainer explanation={g.explanation} names={names} onContinue={g.dismissExplanation} />
      ) : null}

      <GameOptionsSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        showRotate={!game.isVsAI}
        canSkip={g.isAnimating}
        onSkip={g.skipAnimation}
      />

      {(game.turnPhase === 'ROUND_OVER' || game.turnPhase === 'MATCH_OVER') && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {game.turnPhase === 'MATCH_OVER'
                ? game.winner === 'draw'
                  ? 'The match is drawn'
                  : `${names[game.winner ?? 0]} ${game.isVsAI && game.winner === 0 ? 'win' : 'wins'} the match`
                : `Round ${game.roundNumber} complete`}
            </Text>
            <View style={styles.scoreRow}>
              {names.map((n, p) => (
                <View key={n} style={styles.scoreCard}>
                  <Text style={styles.scoreName}>{n}</Text>
                  <Text style={styles.scoreValue}>{game.stores[p]}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={styles.brassBtn}
              onPress={game.turnPhase === 'ROUND_OVER' ? g.nextRound : () => g.newGame(options)}
            >
              <RotateCcw color={colors.wood950} size={18} />
              <Text style={styles.brassBtnText}>
                {game.turnPhase === 'ROUND_OVER' ? 'Refill & next round' : 'Play again'}
              </Text>
            </Pressable>
            <Pressable onPress={onExit}>
              <Text style={styles.link}>Choose another game</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  boardSlot: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    zIndex: 2,
  },
  headerCenter: {
    position: 'absolute',
    left: 48,
    right: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
    textAlign: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brassDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 40,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.wood900,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brassDim,
    padding: 22,
    gap: 14,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.amber50, textAlign: 'center' },
  scoreRow: { flexDirection: 'row', gap: 10, width: '100%' },
  scoreCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: 'rgba(18, 10, 8, 0.5)',
    padding: 12,
    alignItems: 'center',
  },
  scoreName: {
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  scoreValue: { fontSize: 28, fontWeight: '800', color: colors.amber100, marginTop: 4 },
  brassBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brass,
    borderRadius: 14,
    paddingVertical: 12,
  },
  brassBtnText: { color: colors.wood950, fontSize: 16, fontWeight: '800' },
  link: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
