import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronLeft,
  Dices,
  HelpCircle,
  Lock,
  RotateCcw,
  Settings2,
  Sparkles,
  Unlock,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import { HOME, OFF, PAWNS, type Seat, SEAT_NAMES } from '@odiakhela/engine/chowka';
import { colors } from '@/constants/theme';
import { type ChowkaNews, type ChowkaOptions, useChowkaGame } from '@/hooks/useChowkaGame';
import { CHOWKA_FACTS, CHOWKA_KEY_RULE, CHOWKA_RULES, CHOWKA_TAGLINE } from '@/lib/chowkaRules';
import { prepareSounds, sounds, vibrate } from '@/lib/feedback';
import { useSettings } from '@/store/settings';
import { ChowkaBoard, SEAT_COLOURS, Shells } from './ChowkaBoard';
import { GameOptionsSheet } from './GameOptionsSheet';
import { JuteBackground } from './JuteBackground';

export function ChowkaScreen({ options, onExit }: { options: ChowkaOptions; onExit: () => void }) {
  const settings = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [guideOpen, setGuideOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);

  // Sound map mirrors the web Chowka screen, with a longer cowrie roll for throw:
  //   throw → shell tumble (web scoop + roll through the animation)
  //   land  → soft settle when the shells stop
  //   step  → pawn walks one square
  //   home  → pawn reaches the centre
  //   capture → opponent sent back
  const onEvent = useCallback((kind: 'throw' | 'land' | 'step' | 'capture' | 'home') => {
    const { sound, haptics } = settingsRef.current;
    if (!sound && !haptics) return;
    if (kind === 'throw' && sound) sounds.roll();
    if (kind === 'land' && sound) sounds.land();
    if (kind === 'step' && sound) sounds.drop();
    if (kind === 'home' && sound) sounds.turn();
    if (kind === 'capture') {
      if (sound) sounds.capture(4);
      if (haptics) void vibrate([30, 40, 60]);
    }
  }, []);

  useEffect(() => {
    prepareSounds();
  }, []);

  const g = useChowkaGame(options, { speed: settings.speed, onEvent });
  const { state } = g;
  const soloVsMachine = options.humanSeats.length === 1;
  const name = (seat: Seat) =>
    soloVsMachine ? (g.isHuman(seat) ? 'You' : `${SEAT_NAMES[seat]} (machine)`) : SEAT_NAMES[seat];
  const you = (seat: Seat) => soloVsMachine && g.isHuman(seat);

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
        ? `${name(state.turn)} ${you(state.turn) ? 'throw' : 'throws'} the shells…`
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
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setGuideOpen(true)}
            style={styles.iconBtn}
            accessibilityLabel="How to play"
            hitSlop={8}
          >
            <HelpCircle color={colors.amber100} size={18} />
          </Pressable>
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

      {/* Compact seats + gates — tap for full details (frees board space). */}
      <Pressable
        style={styles.seatStrip}
        onPress={() => setPlayersOpen(true)}
        accessibilityLabel="Players and gates"
        accessibilityHint="Opens full player status"
      >
        {state.seats.map((seat) => {
          const home = state.pawns[seat].filter((p) => p === HOME).length;
          const turn = state.turn === seat && state.winner === null;
          return (
            <View key={seat} style={[styles.seatChip, turn && styles.seatChipTurn]}>
              <View style={[styles.seatDot, { backgroundColor: SEAT_COLOURS[seat].fill }]} />
              <Text style={styles.seatChipText}>
                {home}/{PAWNS}
              </Text>
              {state.hasCaptured[seat] ? (
                <Unlock color={colors.emerald} size={11} />
              ) : (
                <Lock color={colors.sky} size={11} />
              )}
            </View>
          );
        })}
      </Pressable>

      <View style={[styles.body, landscape ? styles.bodyLandscape : styles.bodyPortrait]}>
        <View style={[styles.boardSlot, !landscape && styles.boardSlotPortrait]}>
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

        <View style={[styles.side, landscape ? styles.sideLandscape : styles.sidePortrait]}>
          {/* Fixed-height throw panel so news / capture / value pills don’t resize the board. */}
          <View style={styles.panel}>
            <View style={styles.statusSlot}>
              <Text style={styles.status} numberOfLines={2}>
                {status || ' '}
              </Text>
            </View>
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
            <View style={styles.noteSlot}>
              {g.news && g.news.kind !== 'capture' && !g.rolling ? (
                <NewsLine news={g.news} name={name} />
              ) : g.lastCapture ? (
                <CaptureBanner news={g.lastCapture} name={name} />
              ) : null}
            </View>
            <Pressable
              disabled={!g.canThrow}
              onPress={g.throwShells}
              style={[styles.brassBtn, !g.canThrow && styles.brassDisabled]}
            >
              <Dices color={g.canThrow ? colors.wood950 : colors.textFaint} size={18} />
              <Text style={[styles.brassBtnText, !g.canThrow && { color: colors.textFaint }]}>Throw shells</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <GameOptionsSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)} />
      <HowToPlayModal visible={guideOpen} onClose={() => setGuideOpen(false)} />
      <PlayersSheet
        visible={playersOpen}
        onClose={() => setPlayersOpen(false)}
        seats={state.seats}
        pawns={state.pawns}
        hasCaptured={state.hasCaptured}
        turn={state.winner === null ? state.turn : null}
        name={name}
      />

      {state.winner !== null ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {state.winner !== 'draw' ? (
              <View
                style={[styles.winnerDot, { backgroundColor: SEAT_COLOURS[state.winner].fill }]}
              />
            ) : null}
            <Text style={styles.modalTitle}>
              {state.winner === 'draw'
                ? 'The game is drawn'
                : you(state.winner)
                  ? 'You win!'
                  : `${name(state.winner)} wins`}
            </Text>
            <Text style={styles.modalBody}>
              {state.winner === 'draw'
                ? 'Every pawn left is parked at a gate that can’t open, so no one can move again.'
                : 'All four pawns reached the centre first.'}
            </Text>
            <Pressable style={styles.brassBtn} onPress={g.newGame}>
              <RotateCcw color={colors.wood950} size={18} />
              <Text style={styles.brassBtnText}>Play again</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={onExit} accessibilityLabel="Back to all games">
              <ChevronLeft color={colors.amber100} size={18} />
              <Text style={styles.secondaryBtnText}>All games</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Wording for every kind of news, shared by the card and the one-line note. */
function describe(news: ChowkaNews, name: (s: Seat) => string) {
  const mover = name(news.mover);
  const isYou = mover === 'You';
  if (news.kind === 'capture') {
    const n = news.captured.length;
    return {
      title: 'Captured!',
      stat: `${n} pawn${n > 1 ? 's' : ''} sent back`,
      why: [
        `${isYou ? 'Your' : `${mover}’s`} pawn landed on a square holding ${news.captured.map((c) => name(c.seat)).join(' & ')}’s pawn`,
        'It is a plain square, not a crossed safe one',
      ],
      result: `So the pawn${n > 1 ? 's go' : ' goes'} back to start and must re-enter with a 4 or 8 – and ${isYou ? 'you throw' : `${mover} throws`} again.`,
      note: news.gateOpened
        ? `That was ${isYou ? 'your' : 'their'} first capture: the gate to the inner ring is now OPEN.`
        : 'Crossed squares (the four starts and the centre) are safe – no capturing there.',
    };
  }
  if (news.kind === 'bonus') {
    return {
      title: news.value === 8 ? 'Ashta!' : 'Chamma!',
      stat: `${news.value} – throw again`,
      why: [news.value === 8 ? 'All four shells landed mouth-down' : 'All four shells landed mouth-up'],
      result: `${isYou ? 'You get' : `${mover} gets`} another throw.`,
      note: 'A 4 or an 8 is also the only throw that can bring a new pawn onto the board.',
    };
  }
  const bonus = news.value === 4 || news.value === 8;
  return {
    title: 'No move',
    stat: `threw ${news.value}`,
    why: news.gate
      ? [
          'The only pawns that could move would cross into the inner ring',
          `${isYou ? 'You haven’t' : `${mover} hasn’t`} captured yet, so the gate is shut`,
        ]
      : [
          bonus
            ? 'No pawn could use it'
            : 'Waiting pawns need a 4 or 8 to enter, and no pawn on the board could move that far',
        ],
    result: `${isYou ? 'You' : mover} threw ${news.value} but nothing could move.${bonus ? ' The bonus throw still stands.' : ''}`,
    note: 'The centre needs an exact throw, too.',
  };
}

function NewsLine({ news, name }: { news: ChowkaNews; name: (s: Seat) => string }) {
  const d = describe(news, name);
  return (
    <View style={styles.newsBlock}>
      <Text style={styles.news} numberOfLines={2}>
        <Text style={styles.newsTitle}>{d.title}</Text> {d.result}
      </Text>
    </View>
  );
}

/** Compact capture note — full teaching lives in How to play. */
function CaptureBanner({
  news,
  name,
}: {
  news: Extract<ChowkaNews, { kind: 'capture' }>;
  name: (s: Seat) => string;
}) {
  const d = describe(news, name);
  return (
    <View style={styles.captureBanner} accessibilityLiveRegion="polite">
      <Sparkles color={colors.amber300} size={14} />
      <Text style={styles.captureBannerText} numberOfLines={2}>
        <Text style={styles.newsTitle}>{d.title}</Text> {d.stat}
        {news.gateOpened ? ' · gate open' : ''}
      </Text>
    </View>
  );
}

/** Full seat / gate details — opened from the compact strip so the board can stay large. */
function PlayersSheet({
  visible,
  onClose,
  seats,
  pawns,
  hasCaptured,
  turn,
  name,
}: {
  visible: boolean;
  onClose: () => void;
  seats: Seat[];
  pawns: number[][];
  hasCaptured: boolean[];
  turn: Seat | null;
  name: (s: Seat) => string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.playersSheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.playersHeader}>
            <Text style={styles.playersTitle}>Players</Text>
            <Pressable onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close" hitSlop={8}>
              <X color={colors.amber100} size={16} />
            </Pressable>
          </View>
          {seats.map((seat) => {
            const home = pawns[seat].filter((p) => p === HOME).length;
            const waiting = pawns[seat].filter((p) => p === OFF).length;
            const isTurn = turn === seat;
            return (
              <View key={seat} style={[styles.seatRow, isTurn && styles.seatTurn]}>
                <View style={[styles.seatDotLg, { backgroundColor: SEAT_COLOURS[seat].fill }]} />
                <View style={styles.seatText}>
                  <Text style={styles.seatName} numberOfLines={1}>
                    {name(seat)}
                  </Text>
                  <Text style={styles.seatMeta}>
                    {home}/{PAWNS} home · {waiting} waiting
                  </Text>
                </View>
                <View style={[styles.gatePill, hasCaptured[seat] ? styles.gateOpen : styles.gateShut]}>
                  {hasCaptured[seat] ? (
                    <Unlock color={colors.wood900} size={10} />
                  ) : (
                    <Lock color={colors.sky} size={10} />
                  )}
                  <Text
                    style={[
                      styles.gateText,
                      hasCaptured[seat] ? { color: colors.wood900 } : { color: colors.sky },
                    ]}
                  >
                    {hasCaptured[seat] ? 'gate open' : 'gate shut'}
                  </Text>
                </View>
              </View>
            );
          })}
          <Text style={styles.playersHint}>
            Gate opens after your first capture — then your pawns may enter the inner ring.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function HowToPlayModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.guideBackdrop}>
        <View
          style={[
            styles.guideCard,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.guideHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.guideTitle}>How to play</Text>
              <Text style={styles.guideTagline}>{CHOWKA_TAGLINE}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close" hitSlop={8}>
              <X color={colors.amber100} size={18} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.guideInner} showsVerticalScrollIndicator={false}>
            <View style={styles.factsRow}>
              {CHOWKA_FACTS.map((f) => (
                <View key={f.k} style={styles.fact}>
                  <Text style={styles.factK}>{f.k}</Text>
                  <Text style={styles.factV}>{f.v}</Text>
                </View>
              ))}
            </View>

            <View style={styles.keyRule}>
              <Text style={styles.keyRuleTitle}>{CHOWKA_KEY_RULE.title}</Text>
              <Text style={styles.keyRuleIntro}>{CHOWKA_KEY_RULE.intro}</Text>
              {CHOWKA_KEY_RULE.conditions.map((c) => (
                <View key={c} style={styles.whyRow}>
                  <Check color={colors.emerald} size={14} />
                  <Text style={styles.whyText}>{c}</Text>
                </View>
              ))}
              <Text style={styles.result}>→ {CHOWKA_KEY_RULE.result}</Text>
              {CHOWKA_KEY_RULE.safe.map((s) => (
                <Text key={s} style={styles.note}>
                  {s}
                </Text>
              ))}
            </View>

            <Text style={styles.rulesHeading}>Rules</Text>
            {CHOWKA_RULES.map((rule, i) => (
              <View key={rule} style={styles.ruleRow}>
                <Text style={styles.ruleNum}>{i + 1}</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
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
    right: 136,
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
  seatStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    zIndex: 2,
  },
  seatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: 'rgba(26, 15, 13, 0.65)',
  },
  seatChipTurn: {
    borderColor: 'rgba(232, 194, 122, 0.7)',
    backgroundColor: 'rgba(232, 194, 122, 0.12)',
  },
  seatChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.amber100,
    fontVariant: ['tabular-nums'],
  },
  body: { flex: 1, gap: 8, minHeight: 0, marginTop: 4 },
  bodyLandscape: { flexDirection: 'row' },
  bodyPortrait: { flexDirection: 'column' },
  boardSlot: { flex: 1, minWidth: 0, minHeight: 0 },
  boardSlotPortrait: { flex: 1 },
  side: { minHeight: 0 },
  sidePortrait: { flexGrow: 0, flexShrink: 0, height: 214 },
  sideLandscape: { flex: 0, width: 260, maxWidth: 280, justifyContent: 'center' },
  panel: {
    height: 214,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: 'rgba(26, 15, 13, 0.7)',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  statusSlot: { height: 34, justifyContent: 'center' },
  status: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(245, 230, 200, 0.85)',
    fontWeight: '600',
  },
  noteSlot: { height: 36, justifyContent: 'center' },
  newsBlock: { gap: 1 },
  news: { fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 15 },
  newsTitle: { fontWeight: '800', color: colors.amber200 },
  newsGate: { fontSize: 10, color: colors.sky, textAlign: 'center' },
  captureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.45)',
    backgroundColor: 'rgba(252, 211, 77, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 32,
  },
  captureBannerText: { flex: 1, fontSize: 11, color: colors.amber100, lineHeight: 14 },
  brassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brass,
    borderRadius: 12,
    paddingVertical: 11,
    width: '100%',
    height: 44,
  },
  brassDisabled: { backgroundColor: colors.wood800 },
  brassBtnText: { color: colors.wood950, fontSize: 14, fontWeight: '800' },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  seatTurn: {
    backgroundColor: 'rgba(232, 194, 122, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 194, 122, 0.45)',
  },
  seatDot: { width: 12, height: 12, borderRadius: 6 },
  seatDotLg: { width: 16, height: 16, borderRadius: 8 },
  seatText: { flex: 1, minWidth: 0 },
  seatName: { fontSize: 14, fontWeight: '700', color: colors.amber50 },
  seatMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
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
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  playersSheet: {
    backgroundColor: colors.wood900,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.brassDim,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 8,
  },
  playersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  playersTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  playersHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 4,
  },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  whyText: { flex: 1, fontSize: 13, color: colors.amber50, lineHeight: 18 },
  result: { fontSize: 13, fontWeight: '700', color: colors.amber200, marginTop: 2 },
  note: { fontSize: 11, color: colors.textFaint, lineHeight: 15 },
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
  winnerDot: { width: 48, height: 48, borderRadius: 24 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.amber50, textAlign: 'center' },
  modalBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  secondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brassDim,
    paddingVertical: 12,
    backgroundColor: 'rgba(26, 15, 13, 0.55)',
  },
  secondaryBtnText: { color: colors.amber100, fontSize: 15, fontWeight: '700' },
  guideBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  guideCard: {
    flex: 1,
    backgroundColor: colors.wood900,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.brassDim,
    paddingHorizontal: 16,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  guideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  guideTagline: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  guideInner: { gap: 12, paddingBottom: 24 },
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: {
    minWidth: '45%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: 'rgba(26, 15, 13, 0.55)',
    padding: 10,
  },
  factK: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  factV: { fontSize: 13, fontWeight: '600', color: colors.amber100, marginTop: 4 },
  keyRule: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(252, 211, 77, 0.55)',
    padding: 12,
    gap: 6,
    backgroundColor: 'rgba(26, 15, 13, 0.7)',
  },
  keyRuleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.amber200,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  keyRuleIntro: { fontSize: 13, color: 'rgba(245, 230, 200, 0.85)', lineHeight: 18 },
  rulesHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.amber50,
    marginTop: 4,
  },
  ruleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ruleNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(201, 162, 79, 0.25)',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 11,
    fontWeight: '800',
    color: colors.amber200,
    overflow: 'hidden',
  },
  ruleText: { flex: 1, fontSize: 13, color: 'rgba(245, 230, 200, 0.85)', lineHeight: 19 },
});
