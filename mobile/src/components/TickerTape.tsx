import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors, directionColor, Fonts, Spacing } from '@/constants/theme';
import { changePct, formatPct, formatPeso, rowKey } from '@/lib/format';
import type { LiveRow } from '@/lib/priceStore';

const PX_PER_SECOND = 40;

/** Scrolling marquee of the biggest movers. Content is rendered twice so the loop is seamless. */
export function TickerTape({ rows }: { rows: LiveRow[] }) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);

  const movers = rows
    .map((row) => ({ row, pct: changePct(row) }))
    .filter((m) => m.pct !== null)
    .sort((a, b) => Math.abs(b.pct!) - Math.abs(a.pct!))
    .slice(0, 12);

  useEffect(() => {
    if (!width) return;
    x.value = 0;
    x.value = withRepeat(
      withTiming(-width, { duration: (width / PX_PER_SECOND) * 1000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [width, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  if (movers.length === 0) return <View style={styles.tape} />;

  const items = movers.map(({ row, pct }) => (
    <View key={rowKey(row)} style={styles.item}>
      <Text style={styles.symbol}>{row.slug.toUpperCase()}</Text>
      <Text style={styles.price}>{formatPeso(row.price)}</Text>
      <Text style={[styles.pct, { color: directionColor(pct) }]}>{formatPct(pct)}</Text>
    </View>
  ));

  return (
    <View style={styles.tape} accessibilityLabel="Top movers ticker">
      <Animated.View style={[styles.track, style]}>
        <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {items}
        </View>
        <View style={styles.track}>{items}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tape: {
    height: 34,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    justifyContent: 'center',
  },
  track: { flexDirection: 'row', alignSelf: 'flex-start' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md },
  symbol: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  price: { color: Colors.text, fontFamily: Fonts.mono, fontSize: 12 },
  pct: { fontFamily: Fonts.mono, fontSize: 12 },
});
