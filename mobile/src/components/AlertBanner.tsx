import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, directionColor, Fonts, Spacing } from '@/constants/theme';
import { changePct, formatPct, formatPeso, marketName } from '@/lib/format';
import { useLive } from './LiveProvider';

const VISIBLE_MS = 5000;

/** In-app price-change alert for watched commodities, pushed over the WebSocket. */
export function AlertBanner() {
  const { alert, dismissAlert } = useLive();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(dismissAlert, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [alert, dismissAlert]);

  if (!alert) return null;
  const e = alert.event;
  const pct = changePct(e);

  return (
    <Animated.View
      key={alert.key}
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[styles.wrap, { top: insets.top + Spacing.sm }]}>
      <Pressable
        style={[styles.banner, { borderLeftColor: directionColor(pct) }]}
        accessibilityRole="alert"
        onPress={() => {
          dismissAlert();
          router.push({ pathname: '/commodity/[id]', params: { id: e.commodityId, market: e.marketLocation } });
        }}>
        <Text style={styles.title}>
          ★ {e.name} · {marketName(e.marketLocation)}
        </Text>
        <Text style={styles.body}>
          {e.previousPrice ? `${formatPeso(e.previousPrice)} → ` : ''}
          {formatPeso(e.price)}{' '}
          <Text style={{ color: directionColor(pct) }}>{formatPct(pct)}</Text>
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, zIndex: 100 },
  banner: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: 8,
    borderLeftWidth: 4,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  body: { color: Colors.text, fontFamily: Fonts.mono, marginTop: 4 },
});
