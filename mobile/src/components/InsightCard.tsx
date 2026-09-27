import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import type { MarketKey } from '@/lib/types';

type State = { key: string; text?: string; error?: string; disabled?: boolean };

/**
 * Claude-written summary of the recent price trend. Generated on the backend (the API key never
 * ships in the app) and refetched when the price changes. Hidden when the server has AI turned off.
 */
export function InsightCard({ commodityId, market, priceAt }: { commodityId: number; market: MarketKey; priceAt?: string }) {
  const key = `${commodityId}:${market}:${priceAt ?? ''}`;
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!priceAt) return;
    let cancelled = false;
    api.insight(commodityId, market).then(
      (r) => !cancelled && setState({ key, text: r.text }),
      (e: unknown) =>
        !cancelled &&
        setState({
          key,
          disabled: e instanceof ApiError && e.status === 503,
          error: e instanceof Error ? e.message : 'Insight unavailable',
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [commodityId, market, priceAt, key]);

  const current = state?.key === key ? state : null;
  if (current?.disabled) return null;

  return (
    <View style={styles.card} accessibilityLabel="AI price insight">
      <Text style={styles.label}>✦ AI INSIGHT</Text>
      {!current ? (
        <ActivityIndicator color={Colors.accent} style={styles.loading} />
      ) : current.text ? (
        <Text style={styles.text}>{current.text}</Text>
      ) : (
        <Text style={styles.muted}>{current.error}</Text>
      )}
      <Text style={styles.footer}>Written by Claude from the recorded prices above. Not financial advice.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    gap: Spacing.sm,
  },
  label: { color: Colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  loading: { alignSelf: 'flex-start', marginVertical: Spacing.sm },
  text: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: Colors.textSecondary },
  footer: { color: Colors.textMuted, fontSize: 11 },
});
