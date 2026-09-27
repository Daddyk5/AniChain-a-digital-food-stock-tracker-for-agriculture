import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.ts';
import { CATEGORIES, commodities } from '../db/schema.ts';
import { DAVAO_MARKETS, MARKET_KEYS } from '../markets.ts';
import { getHistory, getTicker, RANGES, type Range } from '../queries.ts';
import { getInsight, insightsEnabled, InsightUnavailableError } from '../ai/insight.ts';
import { validate } from './validate.ts';

const idParam = z.object({ id: z.coerce.number().int().positive() });

export const publicRoutes = new Hono()
  .get('/markets', (c) => c.json({ markets: Object.entries(DAVAO_MARKETS).map(([key, name]) => ({ key, name })) }))
  .get('/categories', (c) => c.json({ categories: CATEGORIES }))
  // Every commodity, including ones with no price yet (the ticker only lists priced pairs).
  .get('/catalog', async (c) =>
    c.json({ items: await db.select().from(commodities).orderBy(commodities.category, commodities.name) }),
  )
  .get(
    '/commodities',
    validate(
      'query',
      z.object({
        category: z.enum(CATEGORIES).optional(),
        market: z.enum(MARKET_KEYS).optional(),
        q: z.string().trim().max(64).optional(),
      }),
    ),
    async (c) => c.json({ items: await getTicker(c.req.valid('query')) }),
  )
  .get('/commodities/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param');
    const [commodity] = await db.select().from(commodities).where(eq(commodities.id, id));
    if (!commodity) return c.json({ error: 'Not found' }, 404);
    return c.json({ commodity, markets: await getTicker({ commodityId: id }) });
  })
  .get(
    '/commodities/:id/history',
    validate('param', idParam),
    validate(
      'query',
      z.object({
        range: z.enum(Object.keys(RANGES) as [Range, ...Range[]]).default('30d'),
        market: z.enum(MARKET_KEYS),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid('param');
      const { range, market } = c.req.valid('query');
      return c.json(await getHistory(id, market, range));
    },
  )
  .get(
    '/commodities/:id/insight',
    validate('param', idParam),
    validate('query', z.object({ market: z.enum(MARKET_KEYS) })),
    async (c) => {
      if (!insightsEnabled()) return c.json({ error: 'AI insights are not configured' }, 503);
      const { id } = c.req.valid('param');
      const { market } = c.req.valid('query');
      try {
        const insight = await getInsight(id, market);
        if (!insight) return c.json({ error: 'No prices for this commodity at this market' }, 404);
        return c.json(insight);
      } catch (err) {
        if (err instanceof InsightUnavailableError) return c.json({ error: err.message }, 502);
        console.error('[insight]', err);
        return c.json({ error: 'AI insight is temporarily unavailable' }, 502);
      }
    },
  );
