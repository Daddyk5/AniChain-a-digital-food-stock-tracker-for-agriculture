import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

export type ChipOption<T extends string> = { value: T; label: string };

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, selected && styles.selected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surfaceRaised,
  },
  selected: { backgroundColor: Colors.accent },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  selectedLabel: { color: Colors.background },
});
