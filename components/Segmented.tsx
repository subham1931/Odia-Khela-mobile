import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  format = (v) => String(v),
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const on = opt === value;
        return (
          <Pressable
            key={String(opt)}
            onPress={() => onChange(opt)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
              {format(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexGrow: 1,
    minWidth: 56,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brassDim,
    backgroundColor: colors.wood950,
    alignItems: 'center',
  },
  chipOn: {
    borderColor: colors.brass,
    backgroundColor: 'rgba(201, 162, 79, 0.22)',
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chipTextOn: { color: colors.amber100 },
});
