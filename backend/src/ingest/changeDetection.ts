import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.ts';
import { commodities, priceHistory, PRICE_SOURCES } from '../db/schema.ts';
import { MARKET_KEYS } from '../markets.ts';

/**
 * Single entry point for every price observation, whatever its origin (scraper, admin form,
 * future vendor submissions). A row is written only when the price differs from the latest stored
 * price for that commodity at that market. The insert fires the `price_history_notify` trigger,
 * which is the only thing that broadcasts, so "unchanged" observations never reach clients.
 */

export const observationSchema = z
  .object({
    commodityId: z.number().int().positive().optional(),
    slug: z.string().min(1).optional(),
    price: z.coerce.number().positive().max(1_000_000),
    marketLocation: z.enum(MARKET_KEYS),
  })
  .refine((o) => o.commodityId !== undefined || o.slug !== undefined, {
    message: 'Either commodityId or slug is required',
  });

export type PriceObservation = z.infer<typeof observationSchema>;
export type IngestSource = (typeof PRICE_SOURCES)[number];

export type IngestResult =
  | { status: 'changed'; commodityId: number; slug: string; marketLocation: string; previousPrice: string | null; price: string; id: number }
  | { status: 'unchanged'; commodityId: number; slug: string; marketLocation: string; price: string }
  | { status: 'unknown_commodity'; commodityId?: number; slug?: string };

const toCentavoString = (price: number) => price.toFixed(2);

export async function ingestPrice(obs: PriceObservation, source: IngestSource): Promise<IngestResult> {
  const price = toCentavoString(obs.price);

  return db.transaction(async (tx) => {
    const [commodity] = await tx
      .select({ id: commodities.id, slug: commodities.slug })
      .from(commodities)
      .where(obs.commodityId !== undefined ? eq(commodities.id, obs.commodityId) : eq(commodities.slug, obs.slug!))
      .limit(1);
    if (!commodity) return { status: 'unknown_commodity', commodityId: obs.commodityId, slug: obs.slug };

    // Serialize concurrent writers (scraper + admin + vendors) for the same commodity/market so two
    // identical submissions can't both see "changed" and double-insert.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`price:${commodity.id}:${obs.marketLocation}`}))`,
    );

    const [latest] = await tx
      .select({ price: priceHistory.price })
      .from(priceHistory)
      .where(and(eq(priceHistory.commodityId, commodity.id), eq(priceHistory.marketLocation, obs.marketLocation)))
      .orderBy(desc(priceHistory.recordedAt), desc(priceHistory.id))
      .limit(1);

    const base = { commodityId: commodity.id, slug: commodity.slug, marketLocation: obs.marketLocation };
    if (latest && latest.price === price) return { status: 'unchanged', ...base, price };

    const [inserted] = await tx
      .insert(priceHistory)
      .values({ commodityId: commodity.id, price, marketLocation: obs.marketLocation, source })
      .returning({ id: priceHistory.id });

    return { status: 'changed', ...base, previousPrice: latest?.price ?? null, price, id: inserted!.id };
  });
}

export async function ingestBatch(observations: PriceObservation[], source: IngestSource) {
  const results: IngestResult[] = [];
  // Sequential on purpose: batches are small (one market bulletin) and ordering keeps logs readable.
  for (const obs of observations) results.push(await ingestPrice(obs, source));
  return {
    results,
    summary: {
      received: results.length,
      changed: results.filter((r) => r.status === 'changed').length,
      unchanged: results.filter((r) => r.status === 'unchanged').length,
      unknown: results.filter((r) => r.status === 'unknown_commodity').length,
    },
  };
}
