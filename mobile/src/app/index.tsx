import { Image } from 'expo-image';
import { Link, Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chips, type ChipOption } from '@/components/Chips';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import { useLive } from '@/components/LiveProvider';
import { PriceRow } from '@/components/PriceRow';
import { TickerTape } from '@/components/TickerTape';
import { Colors, Spacing } from '@/constants/theme';
import { rowKey } from '@/lib/format';
import { hasSeenWelcome } from '@/lib/onboarding';
import { priceStore, useLiveRows } from '@/lib/priceStore';
import { CATEGORIES, MARKETS, type Category, type MarketKey } from '@/lib/types';
import { useWatchlist } from '@/lib/watchlist';

type CategoryFilter = 'all' | 'watching' | Category;
type MarketFilter = 'all' | MarketKey;

const CATEGORY_OPTIONS: ChipOption<CategoryFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'watching', label: '★ Watching' },
  ...CATEGORIES.map((c) => ({ value: c, label: c[0]!.toUpperCase() + c.slice(1) })),
];
const MARKET_OPTIONS: ChipOption<MarketFilter>[] = [
  { value: 'all', label: 'All markets' },
  ...Object.entries(MARKETS).map(([value, label]) => ({ value: value as MarketKey, label })),
];

export default function MarketsScreen() {
  const rows = useLiveRows();
  const watched = useWatchlist();
  const { loadError, refresh } = useLive();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [market, setMarket] = useState<MarketFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome] = useState(() => !hasSeenWelcome());

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (category === 'all' ||
        (category === 'watching' ? watched.includes(r.commodityId) : r.category === category)) &&
      (market === 'all' || r.marketLocation === market) &&
      (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q)),
  );

  if (showWelcome) return <Redirect href="/welcome" />;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Link href="/welcome" asChild>
              <Pressable style={styles.titleRow} accessibilityRole="button" accessibilityLabel="AniChain Davao, about">
                <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
                <Text style={styles.title}>AniChain</Text>
                <Text style={styles.titleTag}>DAVAO</Text>
              </Pressable>
            </Link>
          ),
          headerRight: () => (
            <View style={styles.headerRight}>
              <ConnectionBadge />
              <Link href="/admin" style={styles.adminLink}>
                Admin
              </Link>
            </View>
          ),
        }}
      />
      <TickerTape rows={rows} />

      <View style={styles.controls}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search commodities"
          placeholderTextColor={Colors.textMuted}
          style={styles.search}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        <Chips options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        <Chips options={MARKET_OPTIONS} value={market} onChange={setMarket} />
      </View>

      <View style={styles.header}>
        <Text style={styles.headerText}>Commodity / Market</Text>
        <Text style={styles.headerText}>Price · Last change</Text>
      </View>

      <FlatList
        data={visible}
        keyExtractor={rowKey}
        renderItem={({ item }) => <PriceRow row={item} watched={watched.includes(item.commodityId)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={Colors.textSecondary}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {!priceStore.loaded && !loadError ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <Text style={styles.emptyText}>
                {loadError
                  ? `Can't reach the AniChain server.\n${loadError}`
                  : category === 'watching'
                    ? 'Tap ☆ on a commodity to get alerts when its price changes.'
                    : 'No prices match these filters.'}
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  controls: { paddingTop: Spacing.md, gap: Spacing.sm },
  search: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceRaised,
    color: Colors.text,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerText: { color: Colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: Spacing.lg },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logo: { width: 26, height: 26 },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  titleTag: { color: Colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  adminLink: { color: Colors.accent, fontWeight: '600', fontSize: 15 },
});
