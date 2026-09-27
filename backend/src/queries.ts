import { sql } from 'drizzle-orm';
import { db } from './db/client.ts';
import type { Category } from './db/schema.ts';

export type TickerRow = {
  commodityId: number;
  slug: string;
  name: string;
  category: Category;
  unit: string;
  marketLocation: string;
  price: string;
  previousPrice: string | null;
  recordedAt: string;
};

/**
 * One row per (commodity, market) pair with its latest price and the price it replaced.
 * Because only changes are stored, the previous row is the last change and the % change is the
 * move since the price last changed.
 */
export async function getTicker(filter: { category?: Category; q?: string; market?: string; commodityId?: number }) {
  const conditions = [sql`true`];
  if (filter.category) conditions.push(sql`c.category = ${filter.category}`);
  if (filter.q) conditions.push(sql`c.name ilike ${`%${filter.q.replace(/[\%_]/g, '\$&')}%`}`);
  if (filter.commodityId) conditions.push(sql`c.id = ${filter.commodityId}`);
  const marketCond = filter.market ? sql`and m.market_location = ${filter.market}` : sql``;

  const { rows } = await db.execute<TickerRow>(sql`
    select c.id as "commodityId", c.slug, c.name, c.category, c.unit,
           m.market_location as "marketLocation",
           latest.price, prev.price as "previousPrice", to_char(latest.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "recordedAt"
    from commodities c
    join lateral (
      select distinct market_location from price_history where commodity_id = c.id
    ) m on true
    join lateral (
      select price, recorded_at from price_history
      where commodity_id = c.id and market_location = m.market_location
      order by recorded_at desc, id desc limit 1
    ) latest on true
    left join lateral (
      select price from price_history
      where commodity_id = c.id and market_location = m.market_location
      order by recorded_at desc, id desc offset 1 limit 1
    ) prev on true
    where ${sql.join(conditions, sql` and `)} ${marketCond}
    order by c.category, c.name, m.market_location
  `);
  return rows;
}

export const RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const;
export type Range = keyof typeof RANGES;

/**
 * Price changes within the range, plus the price in effect when the range started so the chart
 * can draw a flat line from the left edge up to the first change (prices are step functions).
 */
export async function getHistory(commodityId: number, market: string, range: Range) {
  const since = new Date(Date.now() - RANGES[range] * 24 * 60 * 60 * 1000);

  const { rows: points } = await db.execute<{ price: string; recordedAt: string }>(sql`
    select price, to_char(recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "recordedAt" from price_history
    where commodity_id = ${commodityId} and market_location = ${market} and recorded_at >= ${since}
    order by recorded_at asc, id asc
  `);
  const { rows: opening } = await db.execute<{ price: string }>(sql`
    select price from price_history
    where commodity_id = ${commodityId} and market_location = ${market} and recorded_at < ${since}
    order by recorded_at desc, id desc limit 1
  `);

  return { range, since: since.toISOString(), openingPrice: opening[0]?.price ?? null, points };
}
