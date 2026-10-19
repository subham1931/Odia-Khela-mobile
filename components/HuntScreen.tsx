import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, RotateCcw, Settings2, Undo2, Volume2, VolumeX, X } from 'lucide-react-native';
import { GOATS, type HuntMove, type HuntState, MAX_PLIES, type Side, TIGERS_TO_WIN } from '@odiakhela/engine/hunt';
import { colors } from '@/constants/theme';
import { type HuntOptions, useHuntGame } from '@/hooks/useHuntGame';
import { sounds, vibrate } from '@/lib/feedback';
import { type AnimationSpeed, useSettings } from '@/store/settings';
import { HuntBoard, Token } from './HuntBoard';
import { JuteBackground } from './JuteBackground';
import { Segmented } from './Segmented';

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
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onMove = useCallback((m: HuntMove, _next: HuntState) => {
    const { sound, haptics } = settingsRef.current;
    if (m.kind === 'jump') {
      if (sound) sounds.capture(4);
      if (haptics) void vibrate([30, 40, 60]);
    } else if (sound) {
      sounds.drop();
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
            : `${vsAI ? 'Your move' : 'Tigers'} – tap a tiger, then move or jump`
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
          <Text style={styles.subtitle} numberOfLines={1}>
            Odisha · Tigers & goats
            {vsAI ? ` · you play ${options.humanSide === 'goat' ? 'goats' : 'tigers'}` : ''}
            {status ? ` · ${status}` : ''}
          </Text>
          <Text style={styles.drawHint}>Drawn after {MAX_PLIES} moves</Text>
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

      <View style={styles.statusRow}>
        {g.aiThinking ? <ActivityIndicator color={colors.amber200} size="small" /> : null}
        <Text style={[styles.statusText, g.capture && styles.statusCapture]} numberOfLines={2}>
          {status}
        </Text>
      </View>

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
      </View>

      {optionsOpen ? (
        <View style={styles.optionsRoot} pointerEvents="box-none">
          <Pressable style={styles.optionsBackdrop} onPress={() => setOptionsOpen(false)} />
          <View
            style={[
              styles.optionsCard,
              {
                paddingTop: Math.max(insets.top, 12),
                paddingBottom: Math.max(insets.bottom, 12),
                paddingRight: Math.max(insets.right, 14),
              },
            ]}
          >
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>Match options</Text>
              <Pressable
                onPress={() => setOptionsOpen(false)}
                style={styles.iconBtn}
                accessibilityLabel="Close options"
                hitSlop={8}
              >
                <X color={colors.amber100} size={16} />
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Animation speed</Text>
            <Segmented
              value={settings.speed}
              options={['slow', 'normal', 'fast'] as const satisfies readonly AnimationSpeed[]}
              onChange={(speed) => settings.set({ speed })}
            />
          </View>
        </View>
      ) : null}

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
  drawHint: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textFaint,
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
  statusRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(245, 230, 200, 0.8)',
    textAlign: 'center',
    flexShrink: 1,
  },
  statusCapture: {
    backgroundColor: colors.amber300,
    color: colors.wood950,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 2,
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
    marginBottom: 6,
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
  optionsRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  optionsBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  optionsCard: {
    width: 280,
    maxWidth: '85%',
    height: '100%',
    backgroundColor: colors.wood900,
    borderLeftWidth: 1,
    borderLeftColor: colors.brassDim,
    paddingHorizontal: 16,
    gap: 12,
  },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.amber50,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
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
  link: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
