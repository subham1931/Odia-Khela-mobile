import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, RotateCcw, Settings2, Sparkles, Volume2, VolumeX } from 'lucide-react-native';
import { type DashMove, type DashState, PIECES, piecesOf, QUIET_LIMIT, type Side } from '@odiakhela/engine/dash';
import { colors } from '@/constants/theme';
import { type DashCapture, type DashOptions, useDashGame } from '@/hooks/useDashGame';
import { sounds, vibrate } from '@/lib/feedback';
import { useSettings } from '@/store/settings';
import { DASH_NAMES, DashBoard, Guti } from './DashBoard';
import { GameOptionsSheet } from './GameOptionsSheet';
import { JuteBackground } from './JuteBackground';

export function DashScreen({ options, onExit }: { options: DashOptions; onExit: () => void }) {
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [optionsOpen, setOptionsOpen] = useState(false);

  const onMove = useCallback((m: DashMove, _s: DashState) => {
    const { sound, haptics } = settingsRef.current;
    if (m.kind === 'jump') {
      if (sound) sounds.capture(3);
      if (haptics) void vibrate([30, 40, 60]);
    } else if (sound) sounds.drop();
  }, []);

  const g = useDashGame(options, { speed: settings.speed, onMove });
  const { state } = g;
  const vsAI = options.humanSide !== null;
  const name = (side: Side) => (vsAI ? (side === options.humanSide ? 'You' : 'Machine') : DASH_NAMES[side]);
  const you = (side: Side) => vsAI && side === options.humanSide;

  useEffect(() => {
    if (state.winner === null || state.winner === 'draw') return;
    if (vsAI && state.winner !== options.humanSide) return;
    if (settingsRef.current.sound) sounds.win();
    if (settingsRef.current.haptics) void vibrate([40, 60, 80]);
  }, [state.winner, vsAI, options.humanSide]);

  const status = g.jumping
    ? `${name(state.turn)} ${you(state.turn) ? 'capture' : 'captures'}!`
    : g.aiThinking
      ? 'Machine is thinking…'
      : state.winner !== null
        ? ''
        : g.isHumanTurn
          ? state.chainFrom !== null
            ? 'Keep going – the same piece must jump again'
            : g.mustCapture
              ? `${vsAI ? 'You' : DASH_NAMES[state.turn]} must capture – pick a glowing piece and jump`
              : `${vsAI ? 'Your move' : DASH_NAMES[state.turn]} – tap a piece, then a glowing point`
          : `${name(state.turn)} to move`;

  const sidePanel = (side: Side) => (
    <View style={[styles.sidePanel, state.winner === null && state.turn === side && styles.sidePanelActive]}>
      <View style={styles.sideHeader}>
        <View style={styles.gutiThumb}>
          <Guti side={side} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sideName} numberOfLines={1}>
            {name(side)}
          </Text>
          <Text style={styles.sideMeta}>
            {DASH_NAMES[side]}
            {side === 0 ? ' · first' : ''}
          </Text>
        </View>
        <Text style={styles.sideCount}>
          {piecesOf(state.board, side)}/{PIECES}
        </Text>
      </View>
    </View>
  );

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
          <Text style={styles.title}>Dash-guti</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Ten pieces · compulsory captures
            {vsAI ? ` · you play ${DASH_NAMES[options.humanSide!].toLowerCase()}` : ''}
            {status ? ` · ${status}` : ''}
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

      <View style={styles.body}>
        <View style={styles.sideCol}>
          {sidePanel(1)}
          {sidePanel(0)}
          <View style={styles.quietCard}>
            <Text style={styles.quietLabel}>Moves without a capture</Text>
            <View style={styles.quietTrack}>
              <View
                style={[
                  styles.quietFill,
                  {
                    width: `${(state.quiet / QUIET_LIMIT) * 100}%`,
                    backgroundColor: state.quiet > QUIET_LIMIT - 10 ? colors.amber300 : 'rgba(201,162,79,0.6)',
                  },
                ]}
              />
            </View>
            <Text style={styles.quietMeta}>
              {state.quiet} / {QUIET_LIMIT}
            </Text>
          </View>
        </View>

        <View style={styles.boardSlot}>
          <DashBoard
            pieces={g.pieces}
            targets={g.targets}
            selectable={g.selectable}
            selected={g.selected}
            jumping={g.jumping}
            lastMove={g.lastMove}
            chainFrom={g.isHumanTurn ? state.chainFrom : null}
            danger={g.danger}
            onTap={g.tapPoint}
          />
        </View>
      </View>

      <DashExplainer capture={g.lastCapture} name={name} />

      <GameOptionsSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)} />

      {state.winner !== null && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {state.winner !== 'draw' ? (
              <View style={styles.winnerGuti}>
                <Guti side={state.winner} />
              </View>
            ) : null}
            <Text style={styles.modalTitle}>
              {state.winner === 'draw'
                ? 'The game is drawn'
                : you(state.winner)
                  ? 'You win!'
                  : vsAI
                    ? 'The machine wins'
                    : `${DASH_NAMES[state.winner]} wins`}
            </Text>
            <Text style={styles.modalBody}>
              {state.reason === 'wipeout'
                ? 'Every one of the other side’s pieces was captured.'
                : state.reason === 'blocked'
                  ? 'The other side was left with no move at all.'
                  : `${QUIET_LIMIT} moves passed without a capture, so the pieces were counted: ${piecesOf(state.board, 0)} ivory, ${piecesOf(state.board, 1)} ebony.`}
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
      )}
    </View>
  );
}

function DashExplainer({ capture, name }: { capture: DashCapture | null; name: (s: Side) => string }) {
  if (!capture) {
    return (
      <Text style={styles.hint}>
        Capture: jump an enemy piece next to you, along a line, into the empty point beyond. Captures are compulsory.
      </Text>
    );
  }
  const who = name(capture.by);
  const youTook = who === 'You';
  const n = capture.jumps.length;
  return (
    <View style={styles.explainer}>
      <View style={styles.explainerHeader}>
        <Sparkles color={colors.amber300} size={18} />
        <Text style={styles.explainerTitle}>{n > 1 ? `Chain of ${n}!` : 'Captured!'}</Text>
        <View style={styles.stat}>
          <Text style={styles.statText}>
            {who} {youTook ? 'have' : 'has'} taken {capture.total}
          </Text>
        </View>
      </View>
      {['An enemy piece stood right next to the jumping piece, on a line', 'The point straight beyond it, on the same line, was empty'].map(
        (w) => (
          <View key={w} style={styles.whyRow}>
            <Check color={colors.emerald} size={14} />
            <Text style={styles.whyText}>{w}</Text>
          </View>
        ),
      )}
      <Text style={styles.result}>
        → So the piece jumped over it and the enemy piece is off the board
        {n > 1 ? ` – and it could jump again, so it had to: ${n} in one turn` : ''}.
      </Text>
    </View>
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
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 0,
    marginTop: 4,
  },
  sideCol: {
    width: 118,
    gap: 6,
    justifyContent: 'center',
  },
  sidePanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: 'rgba(18, 10, 8, 0.45)',
    padding: 8,
    opacity: 0.85,
  },
  sidePanelActive: {
    opacity: 1,
    borderColor: 'rgba(232, 194, 122, 0.7)',
  },
  sideHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gutiThumb: { width: 28, height: 28 },
  sideName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  sideMeta: {
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  sideCount: { fontSize: 13, fontWeight: '800', color: colors.amber100 },
  quietCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: 'rgba(18, 10, 8, 0.45)',
    padding: 8,
    gap: 4,
  },
  quietLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  quietTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(18, 10, 8, 0.6)',
    overflow: 'hidden',
  },
  quietFill: { height: '100%', borderRadius: 999 },
  quietMeta: { fontSize: 10, color: colors.textMuted },
  boardSlot: { flex: 1, minWidth: 0, minHeight: 0 },
  hint: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxHeight: 48,
  },
  explainer: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(252, 211, 77, 0.7)',
    backgroundColor: 'rgba(42, 26, 22, 0.92)',
    padding: 10,
    gap: 4,
    maxHeight: 120,
  },
  explainerHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  explainerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.amber200,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  stat: {
    borderRadius: 999,
    backgroundColor: colors.amber300,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statText: { fontSize: 10, fontWeight: '800', color: colors.wood950 },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  whyText: { flex: 1, fontSize: 12, color: colors.amber50 },
  result: { fontSize: 12, fontWeight: '700', color: colors.amber200 },
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
  winnerGuti: { width: 56, height: 56 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.amber50, textAlign: 'center' },
  modalBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
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
  link: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
