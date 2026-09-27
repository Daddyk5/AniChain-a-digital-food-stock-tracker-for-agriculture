import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors, directionColor, Fonts, Spacing } from '@/constants/theme';
import { changePct, formatPct, formatPeso, marketName } from '@/lib/format';
import type { LiveRow } from '@/lib/priceStore';

/** One market pair ("Tomato · Bankerohan"). Flashes green/red when a live update lands. */
export function PriceRow({ row, watched }: { row: LiveRow; watched: boolean }) {
  const pct = changePct(row);
  const color = directionColor(pct);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (!row.liveChangedAt) return;
    flash.value = 1;
    flash.value = withTiming(0, { duration: 1400 });
  }, [row.liveChangedAt, flash]);

  const flashStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(flash.value, [0, 1], ['transparent', `${color}40`]),
  }));

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/commodity/[id]', params: { id: row.commodityId, market: row.marketLocation } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${marketName(row.marketLocation)}, ${formatPeso(row.price)}, ${formatPct(pct)}`}>
      <Animated.View style={[styles.row, flashStyle]}>
        <View style={styles.name}>
          <Text style={styles.title} numberOfLines={1}>
            {watched ? '★ ' : ''}
            {row.name}
          </Text>
          <Text style={styles.subtitle}>
            {marketName(row.marketLocation)} · /{row.unit}
          </Text>
        </View>
        <Text style={styles.price}>{formatPeso(row.price)}</Text>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{formatPct(pct)}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  name: { flex: 1 },
  title: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  subtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  price: { color: Colors.text, fontFamily: Fonts.mono, fontSize: 15, fontVariant: ['tabular-nums'] },
  badge: { minWidth: 76, paddingVertical: 6, borderRadius: 4, alignItems: 'center' },
  badgeText: { color: '#fff', fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700' },
});
