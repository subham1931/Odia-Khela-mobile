import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, RotateCcw, Settings2, Sparkles, Undo2, Volume2, VolumeX } from 'lucide-react-native';
import { GOATS, type HuntMove, type HuntState, MAX_PLIES, type Side, TIGERS_TO_WIN } from '@odiakhela/engine/hunt';
import { colors } from '@/constants/theme';
import { type HuntOptions, useHuntGame } from '@/hooks/useHuntGame';
import { sounds, vibrate } from '@/lib/feedback';
import { useSettings } from '@/store/settings';
import { GameOptionsSheet } from './GameOptionsSheet';
import { HuntBoard, Token } from './HuntBoard';
import { JuteBackground } from './JuteBackground';

const SIDE_NAME: Record<Side, string> = { goat: 'Goats', tiger: 'Tigers' };

export interface HuntScreenProps {
  options: HuntOptions;
  onExit: () => void;
}

export function HuntScreen({ options, onExit }: HuntScreenProps) {
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [explained, setExplained] = useState<{
    move: Extract<HuntMove, { kind: 'jump' }>;
    captured: number;
  } | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onMove = useCallback((m: HuntMove, next: HuntState) => {
    const { sound, haptics } = settingsRef.current;
    if (m.kind === 'jump') {
      setExplained({ move: m, captured: next.captured });
      if (sound) sounds.capture(4);
      if (haptics) void vibrate([30, 40, 60]);
    } else {
      setExplained(null);
      if (sound) sounds.drop();
    }
  }, []);

  const g = useHuntGame(options, { speed: settings.speed, onMove });
  const { state } = g;
  const vsAI = options.humanSide !== null;
  const name = (side: Side) => (vsAI ? (side === options.humanSide ? 'You' : 'Machine') : SIDE_NAME[side]);

  useEffect(() => {
    if (!state.winner) return;
    const humanWon = vsAI ? state.winner === options.humanSide : state.winner !== 'draw';
    if (!humanWon) return;
    if (settingsRef.current.sound) sounds.win();
    if (settingsRef.current.haptics) void vibrate([40, 60, 80]);
  }, [state.winner, vsAI, options.humanSide]);

  const status = g.capture
    ? `Tiger jumps! Goat ${state.captured + 1} of ${TIGERS_TO_WIN} taken`
    : g.aiThinking
      ? 'Machine is thinking…'
      : state.winner
        ? ''
        : g.isHumanTurn
          ? state.turn === 'goat'
            ? state.goatsInHand > 0
              ? `${vsAI ? 'Your move' : 'Goats'} – place a goat (${state.goatsInHand} left)`
              : `${vsAI ? 'Your move' : 'Goats'} – tap a goat, then a glowing point`
            : `${vsAI ? 'Your move' : 'Tigers'} – tap a tiger, then a glowing point`
          : `${name(state.turn)} to move`;

  const board = (
    <HuntBoard
      pieces={g.pieces}
      targets={g.targets}
      selectable={g.selectable}
      selected={g.selected}
      capture={g.capture}
      lastMove={g.lastMove}
      trapped={g.busy ? [] : g.trapped}
      danger={!g.busy && g.isHumanTurn && state.turn === 'goat' ? g.danger : []}
      onTap={g.tapPoint}
    />
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
          <Text style={styles.title}>Bagha Chheli</Text>
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

      {status ? (
        <Text style={[styles.statusLine, g.capture && styles.statusCapture]} numberOfLines={1}>
          {status}
        </Text>
      ) : (
        <View style={styles.statusSpacer} />
      )}

      {landscape ? (
        <View style={styles.landscapeBody}>
          <SidePanel
            side="goat"
            title={name('goat')}
            active={!state.winner && state.turn === 'goat'}
            compact
          >
            <Stat label="To place" value={`${state.goatsInHand}/${GOATS}`} />
            <Stat label="Taken" value={`${state.captured}`} warn={state.captured >= TIGERS_TO_WIN - 1} />
          </SidePanel>
          <View style={styles.boardSlot}>{board}</View>
          <SidePanel
            side="tiger"
            title={name('tiger')}
            active={!state.winner && state.turn === 'tiger'}
            compact
          >
            <CapturePips captured={state.captured} />
            <Stat label="Trapped" value={`${g.trapped.length}/4`} warn={g.trapped.length >= 3} />
          </SidePanel>
        </View>
      ) : (
        <>
          <View style={styles.portraitStats}>
            <SidePanel side="goat" title={name('goat')} active={!state.winner && state.turn === 'goat'}>
              <Stat label="To place" value={`${state.goatsInHand}/${GOATS}`} />
              <Stat label="Taken" value={`${state.captured}`} warn={state.captured >= TIGERS_TO_WIN - 1} />
            </SidePanel>
            <SidePanel side="tiger" title={name('tiger')} active={!state.winner && state.turn === 'tiger'}>
              <CapturePips captured={state.captured} />
              <Stat label="Trapped" value={`${g.trapped.length}/4`} warn={g.trapped.length >= 3} />
            </SidePanel>
          </View>
          <View style={styles.boardSlot}>{board}</View>
        </>
      )}

      <HuntExplainer explained={explained} compact={!landscape} />

      <View style={styles.toolbar}>
        <Pressable
          onPress={g.back}
          disabled={!g.canBack || g.aiThinking}
          style={[styles.ghostBtn, (!g.canBack || g.aiThinking) && styles.ghostDisabled]}
          accessibilityLabel={
            g.selected !== null
              ? 'Cancel selection'
              : `Undo last move · ${g.undosLeft} of ${g.undoLimit} left`
          }
        >
          <Undo2 color={colors.amber100} size={16} />
          <Text style={styles.ghostText}>
            {g.selected !== null ? 'Cancel' : `Undo · ${g.undosLeft}/${g.undoLimit}`}
          </Text>
        </Pressable>
        <Pressable
          onPress={g.newGame}
          disabled={g.aiThinking || g.busy}
          style={[styles.ghostBtn, (g.aiThinking || g.busy) && styles.ghostDisabled]}
          accessibilityLabel="Restart match"
        >
          <RotateCcw color={colors.amber100} size={16} />
          <Text style={styles.ghostText}>Restart</Text>
        </Pressable>
      </View>

      <GameOptionsSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)} />

      {state.winner ? (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {state.winner !== 'draw' ? (
              <View style={styles.winnerToken}>
                <Token side={state.winner} id={999} size={64} />
              </View>
            ) : null}
            <Text style={styles.modalTitle}>
              {state.winner === 'draw'
                ? 'The game is drawn'
                : vsAI
                  ? state.winner === options.humanSide
                    ? 'You win!'
                    : 'The machine wins'
                  : `${SIDE_NAME[state.winner]} win!`}
            </Text>
            <Text style={styles.modalBody}>
              {state.winner === 'tiger'
                ? `The tigers captured ${state.captured} goats.`
                : state.winner === 'goat'
                  ? 'Every tiger is trapped – none can move or jump.'
                  : `${MAX_PLIES} moves passed without a result.`}
            </Text>
            <Pressable style={styles.brassBtn} onPress={g.newGame} accessibilityRole="button">
              <RotateCcw color={colors.wood950} size={18} />
              <Text style={styles.brassBtnText}>Play again</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={onExit}
              accessibilityRole="button"
              accessibilityLabel="Back to all games"
            >
              <ChevronLeft color={colors.amber100} size={18} />
              <Text style={styles.secondaryBtnText}>All games</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function HuntExplainer({
  explained,
  compact = false,
}: {
  explained: { move: Extract<HuntMove, { kind: 'jump' }>; captured: number } | null;
  compact?: boolean;
}) {
  if (!explained) {
    return (
      <Text style={[styles.hint, compact && styles.hintCompact]} numberOfLines={compact ? 2 : 3}>
        Capture: a tiger jumps over a goat into the empty point beyond – goats never capture; they win by trapping.
      </Text>
    );
  }
  const left = TIGERS_TO_WIN - explained.captured;
  if (compact) {
    return (
      <View style={[styles.explainer, styles.explainerCompact]}>
        <Sparkles color={colors.amber300} size={14} />
        <Text style={styles.explainerTitleCompact}>Tiger jumps!</Text>
        <Text style={styles.explainerStat}>
          {explained.captured}/{TIGERS_TO_WIN}
          {left > 0 ? ` · ${left} more` : ' · tigers win'}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.explainer} accessibilityLiveRegion="polite">
      <View style={styles.explainerHeader}>
        <Sparkles color={colors.amber300} size={18} />
        <Text style={styles.explainerTitle}>Tiger jumps!</Text>
        <View style={styles.statPill}>
          <Text style={styles.statPillText}>
            {explained.captured} of {TIGERS_TO_WIN} goats taken
          </Text>
        </View>
      </View>
      {['A goat stood right next to the tiger, on a line', 'The point straight beyond that goat was empty'].map((w) => (
        <View key={w} style={styles.whyRow}>
          <Check color={colors.emerald} size={14} />
          <Text style={styles.whyText}>{w}</Text>
        </View>
      ))}
      <Text style={styles.result}>→ So the tiger leapt over it, and the goat is off the board.</Text>
      <Text style={styles.note}>
        {left > 0
          ? `${left} more and the tigers win. Goats: keep the point behind every goat covered.`
          : 'That was the fifth – the tigers win.'}
      </Text>
    </View>
  );
}

function SidePanel({
  side,
  title,
  active,
  children,
  compact = false,
}: {
  side: Side;
  title: string;
  active: boolean;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <View style={[styles.panel, compact && styles.panelCompact, active ? styles.panelActive : styles.panelIdle]}>
      <View style={styles.panelHead}>
        <View style={styles.panelToken}>
          <Token side={side} id={side === 'goat' ? 1 : 2} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.panelTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.panelSub}>{side === 'goat' ? 'Chheli · 20' : 'Bagha · 4'}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, warn && styles.statWarn]}>{value}</Text>
    </View>
  );
}

function CapturePips({ captured }: { captured: number }) {
  return (
    <View>
      <Text style={styles.statLabel}>Goats captured</Text>
      <View style={styles.pips}>
        {Array.from({ length: TIGERS_TO_WIN }, (_, i) => (
          <View key={i} style={[styles.pip, i < captured ? styles.pipOn : styles.pipOff]} />
        ))}
      </View>
      <Text style={styles.statValue}>
        {captured} / {TIGERS_TO_WIN}
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
    marginBottom: 14,
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
  statusLine: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(245, 230, 200, 0.85)',
    marginBottom: 6,
    minHeight: 18,
  },
  statusCapture: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: colors.amber300,
    color: colors.wood950,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 8,
  },
  statusSpacer: { height: 6 },
  hint: {
    fontSize: 11,
    color: colors.textFaint,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hintCompact: { fontSize: 10, paddingVertical: 4, maxHeight: 36 },
  explainer: {
    marginTop: 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(252, 211, 77, 0.7)',
    backgroundColor: 'rgba(42, 26, 22, 0.92)',
    padding: 10,
    gap: 4,
  },
  explainerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxHeight: 40,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  explainerHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  explainerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.amber200,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  explainerTitleCompact: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.amber200,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  explainerStat: { fontSize: 11, fontWeight: '700', color: colors.amber100 },
  statPill: {
    borderRadius: 999,
    backgroundColor: colors.amber300,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statPillText: { fontSize: 10, fontWeight: '800', color: colors.wood950 },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  whyText: { flex: 1, fontSize: 12, color: colors.amber50 },
  result: { fontSize: 12, fontWeight: '700', color: colors.amber200 },
  note: { fontSize: 11, color: colors.textFaint },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brassDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landscapeBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    minHeight: 0,
  },
  portraitStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    marginBottom: 8,
  },
  boardSlot: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  panel: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: 'rgba(42, 26, 22, 0.85)',
    padding: 10,
  },
  panelCompact: {
    flex: 0,
    width: 118,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  panelActive: { borderColor: 'rgba(232, 194, 122, 0.7)' },
  panelIdle: { opacity: 0.85 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelToken: { width: 32, height: 32 },
  panelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  panelSub: {
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.amber100,
    fontVariant: ['tabular-nums'],
  },
  statWarn: { color: colors.amber300 },
  pips: { flexDirection: 'row', gap: 3, marginTop: 4, marginBottom: 2 },
  pip: { flex: 1, height: 8, borderRadius: 999 },
  pipOn: { backgroundColor: colors.amber300 },
  pipOff: { backgroundColor: colors.wood700 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 6,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brassDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostDisabled: { opacity: 0.3 },
  ghostText: { color: colors.amber100, fontSize: 13, fontWeight: '600' },
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
  winnerToken: { width: 64, height: 64 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: colors.amber50, textAlign: 'center' },
  modalBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
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
});
