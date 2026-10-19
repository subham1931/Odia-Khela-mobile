import { useCallback, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Dices, Lock, RotateCcw, Unlock, Volume2, VolumeX } from 'lucide-react-native';
import { HOME, OFF, PAWNS, type Seat, SEAT_NAMES } from '@odiakhela/engine/chowka';
import { colors } from '@/constants/theme';
import { type ChowkaNews, type ChowkaOptions, useChowkaGame } from '@/hooks/useChowkaGame';
import { sounds, vibrate } from '@/lib/feedback';
import { useSettings } from '@/store/settings';
import { ChowkaBoard, SEAT_COLOURS, Shells } from './ChowkaBoard';
import { JuteBackground } from './JuteBackground';

export function ChowkaScreen({ options, onExit }: { options: ChowkaOptions; onExit: () => void }) {
  const settings = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const insets = useSafeAreaInsets();

  const onEvent = useCallback((kind: 'step' | 'throw' | 'capture' | 'home') => {
    const { sound, haptics } = settingsRef.current;
    if (!sound && !haptics) return;
    if (kind === 'step' && sound) sounds.drop();
    if (kind === 'throw' && sound) sounds.scoop(4);
    if (kind === 'home' && sound) sounds.turn();
    if (kind === 'capture') {
      if (sound) sounds.capture(4);
      if (haptics) void vibrate([30, 40, 60]);
    }
  }, []);

  const g = useChowkaGame(options, { speed: settings.speed, onEvent });
  const { state } = g;
  const soloVsMachine = options.humanSeats.length === 1;
  const name = (seat: Seat) =>
    soloVsMachine ? (g.isHuman(seat) ? 'You' : `${SEAT_NAMES[seat]} (machine)`) : SEAT_NAMES[seat];

  useEffect(() => {
    if (state.winner === null || state.winner === 'draw') return;
    if (soloVsMachine && !g.isHuman(state.winner)) return;
    if (settingsRef.current.sound) sounds.win();
    if (settingsRef.current.haptics) void vibrate([40, 60, 80]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.winner]);

  const status =
    state.winner !== null
      ? ''
      : g.rolling
        ? `${name(state.turn)} throws the shells…`
        : g.humanTurn
          ? state.phase === 'throw'
            ? `${soloVsMachine ? 'Your' : `${name(state.turn)}’s`} turn – throw the shells`
            : `Move ${state.throwValue}: tap a glowing pawn`
          : g.busy
            ? `${name(state.turn)} moving…`
            : `${name(state.turn)} to play`;

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
          <Text style={styles.title}>Chowka Bara</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Cowrie-shell race · {options.players} players
            {status ? ` · ${status}` : ''}
          </Text>
        </View>
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

      <View style={styles.body}>
        <View style={styles.boardSlot}>
          <ChowkaBoard
            seats={state.seats}
            pawns={g.shown}
            moves={g.moves}
            turn={state.turn}
            gateBlocked={g.gateBlocked}
            reveal={g.reveal}
            onPawn={(pawn) => {
              const m = g.moveForPawn(pawn);
              if (m) g.move(m);
            }}
          />
        </View>

        <ScrollView style={styles.side} contentContainerStyle={styles.sideInner} showsVerticalScrollIndicator={false}>
          <View style={styles.panel}>
            <Shells
              shells={g.shells}
              rolling={g.rolling}
              value={
                g.rolling
                  ? null
                  : state.phase === 'move'
                    ? state.throwValue
                    : g.news?.kind === 'no_move'
                      ? g.news.value
                      : null
              }
            />
            {g.news && g.news.kind !== 'capture' && !g.rolling ? (
              <Text style={styles.news}>{newsLine(g.news, name)}</Text>
            ) : null}
            <Pressable
              disabled={!g.canThrow}
              onPress={g.throwShells}
              style={[styles.brassBtn, !g.canThrow && styles.brassDisabled]}
            >
              <Dices color={g.canThrow ? colors.wood950 : colors.textFaint} size={18} />
              <Text style={[styles.brassBtnText, !g.canThrow && { color: colors.textFaint }]}>Throw shells</Text>
            </Pressable>
          </View>

          <View style={styles.panel}>
            {state.seats.map((seat) => {
              const home = state.pawns[seat].filter((p) => p === HOME).length;
              const waiting = state.pawns[seat].filter((p) => p === OFF).length;
              const turn = state.turn === seat && state.winner === null;
              return (
                <View key={seat} style={[styles.seatRow, turn && styles.seatTurn]}>
                  <View style={[styles.seatDot, { backgroundColor: SEAT_COLOURS[seat].fill }]} />
                  <View style={styles.seatText}>
                    <Text style={styles.seatName} numberOfLines={1}>
                      {name(seat)}
                    </Text>
                    <Text style={styles.seatMeta}>
                      {home}/{PAWNS} home · {waiting} waiting
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.gatePill,
                      state.hasCaptured[seat] ? styles.gateOpen : styles.gateShut,
                    ]}
                  >
                    {state.hasCaptured[seat] ? (
                      <Unlock color={colors.wood900} size={10} />
                    ) : (
                      <Lock color={colors.sky} size={10} />
                    )}
                    <Text
                      style={[
                        styles.gateText,
                        state.hasCaptured[seat] ? { color: colors.wood900 } : { color: colors.sky },
                      ]}
                    >
                      {state.hasCaptured[seat] ? 'open' : 'shut'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {state.winner !== null ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {state.winner === 'draw'
                ? 'The game is drawn'
                : soloVsMachine
                  ? g.isHuman(state.winner)
                    ? 'You win!'
                    : 'The machine wins'
                  : `${SEAT_NAMES[state.winner]} wins!`}
            </Text>
            <Pressable style={styles.brassBtn} onPress={g.newGame}>
              <RotateCcw color={colors.wood950} size={18} />
              <Text style={styles.brassBtnText}>Play again</Text>
            </Pressable>
            <Pressable onPress={onExit}>
              <Text style={styles.link}>Choose another game</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function newsLine(news: ChowkaNews, name: (s: Seat) => string): string {
  if (news.kind === 'bonus') return `${name(news.mover)} throws again (${news.value})`;
  if (news.kind === 'no_move')
    return news.gate
      ? `${name(news.mover)} cannot move – gate still shut`
      : `${name(news.mover)} has no move for ${news.value}`;
  return '';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
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
    right: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
    textAlign: 'center',
  },
  subtitle: { fontSize: 10, color: colors.textMuted, marginTop: 1, textAlign: 'center' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brassDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, flexDirection: 'row', gap: 10, minHeight: 0, marginTop: 4 },
  boardSlot: { flex: 1.35, minWidth: 0, minHeight: 0 },
  side: { flex: 1, minWidth: 160, maxWidth: 280 },
  sideInner: { gap: 8, paddingBottom: 8 },
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: 'rgba(26, 15, 13, 0.7)',
    padding: 12,
    gap: 10,
  },
  news: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  brassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brass,
    borderRadius: 12,
    paddingVertical: 11,
  },
  brassDisabled: { backgroundColor: colors.wood800 },
  brassBtnText: { color: colors.wood950, fontSize: 14, fontWeight: '800' },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  seatTurn: {
    backgroundColor: 'rgba(232, 194, 122, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 194, 122, 0.45)',
  },
  seatDot: { width: 14, height: 14, borderRadius: 7 },
  seatText: { flex: 1, minWidth: 0 },
  seatName: { fontSize: 13, fontWeight: '700', color: colors.amber50 },
  seatMeta: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  gatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  gateOpen: { backgroundColor: colors.emerald },
  gateShut: { backgroundColor: 'rgba(186, 230, 253, 0.2)' },
  gateText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
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
  link: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
