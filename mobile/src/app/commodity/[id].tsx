import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { InsightCard } from '@/components/InsightCard';
import { PriceChart, type ChartPoint } from '@/components/PriceChart';
import { Colors, directionColor, Fonts, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { changePct, formatPct, formatPeso, marketName, timeAgo } from '@/lib/format';
import { priceStore, useLiveRows } from '@/lib/priceStore';
import { RANGES, type HistoryResponse, type MarketKey, type Range } from '@/lib/types';
import { useWatchlist, watchlist } from '@/lib/watchlist';

type LoadedHistory = HistoryResponse & { asOf: number };

export default function CommodityScreen() {
  const params = useLocalSearchParams<{ id: string; market: MarketKey }>();
  const id = Number(params.id);
  const market = params.market;
  const rows = useLiveRows();
  const watched = useWatchlist().includes(id);
  const [range, setRange] = useState<Range>('30d');
  // Keyed by request so switching market/range shows a spinner without resetting state in an effect.
  // asOf: when this data was known to be current, so the step line can extend to "now".
  const requestKey = `${id}:${market}:${range}`;
  const [loaded, setLoaded] = useState<{ key: string; history?: LoadedHistory; error?: string } | null>(null);
  const history = loaded?.key === requestKey ? (loaded.history ?? null) : null;
  const error = loaded?.key === requestKey ? (loaded.error ?? null) : null;

  const row = rows.find((r) => r.commodityId === id && r.marketLocation === market);
  const otherMarkets = rows.filter((r) => r.commodityId === id).map((r) => r.marketLocation);

  useEffect(() => {
    let cancelled = false;
    const key = `${id}:${market}:${range}`;
    api.history(id, market, range).then(
      (h) => !cancelled && setLoaded({ key, history: { ...h, asOf: Date.now() } }),
      (e: Error) => !cancelled && setLoaded({ key, error: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [id, market, range]);

  // Live chart: append each pushed change for this pair to the loaded history.
  useEffect(
    () =>
      priceStore.onEvent((e) => {
        if (e.commodityId !== id || e.marketLocation !== market) return;
        setLoaded((l) => {
          const h = l?.history;
          // Skip if the history response already included this change.
          if (!l || !h || (h.points.at(-1)?.recordedAt ?? '') >= e.recordedAt) return l;
          return { ...l, history: { ...h, asOf: Date.now(), points: [...h.points, { price: e.price, recordedAt: e.recordedAt }] } };
        });
      }),
    [id, market],
  );

  const points = toChartPoints(history);
  const first = points[0]?.price;
  const last = points.at(-1)?.price;
  const rangeChange = first && last ? ((last - first) / first) * 100 : null;
  const pct = row ? changePct(row) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: row?.name ?? '',
          headerRight: () => (
            <Pressable
              onPress={() => watchlist.toggle(id)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={watched ? 'Stop price alerts' : 'Alert me when the price changes'}>
              <Text style={[styles.star, watched && { color: Colors.accent }]}>{watched ? '★' : '☆'}</Text>
            </Pressable>
          ),
        }}
      />

      {row ? (
        <View style={styles.hero}>
          <Text style={styles.pair}>
            {row.slug.toUpperCase()} / {marketName(market).toUpperCase()}
          </Text>
          <Text style={[styles.price, { color: directionColor(pct) }]}>{formatPeso(row.price)}</Text>
          <Text style={styles.meta}>
            <Text style={{ color: directionColor(pct) }}>{formatPct(pct)}</Text> since last change · per {row.unit} ·
            updated {timeAgo(row.recordedAt)}
          </Text>
        </View>
      ) : (
        <ActivityIndicator color={Colors.accent} style={{ margin: Spacing.xl }} />
      )}

      {otherMarkets.length > 1 && (
        <Chips
          options={otherMarkets.map((m) => ({ value: m, label: marketName(m) }))}
          value={market}
          onChange={(m) => router.setParams({ market: m })}
        />
      )}

      <View style={styles.rangeRow}>
        <Chips options={RANGES.map((r) => ({ value: r, label: r.toUpperCase() }))} value={range} onChange={setRange} />
      </View>

      <View style={styles.chartCard}>
        {error ? (
          <Text style={styles.muted}>{error}</Text>
        ) : !history ? (
          <ActivityIndicator color={Colors.accent} style={{ height: 240 }} />
        ) : points.length < 2 ? (
          <Text style={styles.muted}>Not enough price changes in this range yet.</Text>
        ) : (
          <PriceChart points={points} color={directionColor(rangeChange)} />
        )}
      </View>

      {points.length > 1 && (
        <View style={styles.stats}>
          <Stat label={`${range} change`} value={formatPct(rangeChange)} color={directionColor(rangeChange)} />
          <Stat label={`${range} high`} value={formatPeso(Math.max(...points.map((p) => p.price)))} />
          <Stat label={`${range} low`} value={formatPeso(Math.min(...points.map((p) => p.price)))} />
          <Stat label="Changes" value={String(history?.points.length ?? 0)} />
        </View>
      )}

      <InsightCard commodityId={id} market={market} priceAt={row?.recordedAt} />

      <Text style={styles.footnote}>
        Prices update only when a Davao market source reports a change. {watched ? 'You’ll get an alert' : 'Tap ☆ to get an alert'} the
        moment this commodity’s price moves.
      </Text>
    </ScrollView>
  );
}

/** Price in effect at the range start, every change after it, then the latest price held until
 *  `asOf` so the step line reaches the right edge. */
function toChartPoints(history: LoadedHistory | null): ChartPoint[] {
  if (!history) return [];
  const points: ChartPoint[] = history.points.map((p) => ({ t: Date.parse(p.recordedAt), price: Number(p.price) }));
  if (history.openingPrice) points.unshift({ t: Date.parse(history.since), price: Number(history.openingPrice) });
  const tail = points.at(-1);
  if (tail && history.asOf > tail.t) points.push({ t: history.asOf, price: tail.price });
  return points;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Spacing.xl * 2, gap: Spacing.md },
  hero: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  pair: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  price: { fontFamily: Fonts.mono, fontSize: 36, fontWeight: '700', marginVertical: 4 },
  meta: { color: Colors.textSecondary, fontSize: 13 },
  star: { fontSize: 24, color: Colors.textSecondary },
  rangeRow: { marginTop: Spacing.xs },
  chartCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.sm,
    minHeight: 120,
    justifyContent: 'center',
  },
  muted: { color: Colors.textSecondary, textAlign: 'center', padding: Spacing.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, rowGap: Spacing.md },
  stat: { width: '50%' },
  statLabel: { color: Colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  statValue: { color: Colors.text, fontFamily: Fonts.mono, fontSize: 15, marginTop: 2 },
  footnote: { color: Colors.textMuted, fontSize: 12, paddingHorizontal: Spacing.lg, lineHeight: 18 },
});
