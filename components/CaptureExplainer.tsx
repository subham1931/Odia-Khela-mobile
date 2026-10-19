import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Sparkles } from 'lucide-react-native';
import type { Player, RevealEvent } from '@odiakhela/engine/types';
import { colors } from '@/constants/theme';

export function explainCapture(reveal: RevealEvent, mover: Player, names: [string, string]) {
  const name = names[mover];
  const you = name === 'You';
  const subject = you ? 'you' : name;
  const poss = you ? 'Your' : `${name}'s`;
  const takes = you ? 'take' : 'takes';
  const own = you ? 'your own' : 'their own';

  if (reveal.rule === 'extra_turn') {
    return {
      title: 'Free turn!',
      stat: you ? 'you go again' : `${name} goes again`,
      why: [`${poss} last seed landed in ${you ? 'your' : 'their'} store`],
      result: `So ${subject} ${you ? 'move' : 'moves'} again.`,
    };
  }
  if (reveal.rule === 'sweep' || reveal.rule === 'opposite') {
    return {
      title: 'Capture!',
      stat: `${reveal.count} seeds`,
      why: [`Last seed fell into an empty pit on ${own} side`],
      result: `So ${subject} ${takes} ${reveal.count} into the store.`,
    };
  }
  return {
    title: 'Capture!',
    stat: `${reveal.count} counter${reveal.count === 1 ? '' : 's'}`,
    why: [`${poss} hand ran out`, 'The next pit was empty'],
    result: `So ${subject} ${takes} the pit beyond that empty one.`,
  };
}

export function CaptureExplainer({
  explanation,
  names,
  onContinue,
}: {
  explanation: { reveal: RevealEvent; mover: Player } | null;
  names: [string, string];
  onContinue: () => void;
}) {
  if (!explanation) return null;
  const x = explainCapture(explanation.reveal, explanation.mover, names);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          <Sparkles color={colors.amber300} size={14} />
          <Text style={styles.title}>{x.title}</Text>
          <View style={styles.stat}>
            <Text style={styles.statText}>{x.stat}</Text>
          </View>
        </View>

        {x.why.map((w) => (
          <View key={w} style={styles.whyRow}>
            <Check color={colors.emerald} size={12} />
            <Text style={styles.why} numberOfLines={2}>
              {w}
            </Text>
          </View>
        ))}
        <Text style={styles.result} numberOfLines={2}>
          → {x.result}
        </Text>

        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 5,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(252, 211, 77, 0.75)',
    backgroundColor: 'rgba(42, 26, 22, 0.97)',
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.amber200,
    fontFamily: 'CormorantGaramond_600SemiBold',
  },
  stat: {
    backgroundColor: colors.amber300,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statText: { fontSize: 10, fontWeight: '800', color: colors.wood950 },
  whyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  why: { flex: 1, color: colors.amber50, fontSize: 12, lineHeight: 16 },
  result: { color: colors.amber200, fontSize: 12, fontWeight: '700', marginTop: 2 },
  btn: {
    marginTop: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brass,
    borderRadius: 10,
    paddingVertical: 9,
  },
  btnPressed: { opacity: 0.9 },
  btnText: { color: colors.wood950, fontSize: 13, fontWeight: '800' },
});
