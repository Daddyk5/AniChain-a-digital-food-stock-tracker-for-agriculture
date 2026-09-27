import { MARKETS, type TickerRow } from './types';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatPeso = (value: string | number) => peso.format(Number(value));

/** % move since the price last changed (only changes are stored, so that's the previous row). */
export function changePct(row: Pick<TickerRow, 'price' | 'previousPrice'>): number | null {
  if (!row.previousPrice) return null;
  const prev = Number(row.previousPrice);
  return prev === 0 ? null : ((Number(row.price) - prev) / prev) * 100;
}

export const formatPct = (pct: number | null) =>
  pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;

export const marketName = (key: string) => MARKETS[key as keyof typeof MARKETS] ?? key;

export const rowKey = (r: Pick<TickerRow, 'commodityId' | 'marketLocation'>) =>
  `${r.commodityId}:${r.marketLocation}`;

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
