import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client.ts';
import { CATEGORIES, commodities } from '../db/schema.ts';
import { ingestBatch, ingestPrice, observationSchema } from '../ingest/changeDetection.ts';
import { requireRole, type AuthEnv } from '../auth/jwt.ts';
import { validate } from './validate.ts';

/** Manual price entry: the interim source while scrapers are being finalized. */
export const adminRoutes = new Hono<AuthEnv>()
  .use(...requireRole('admin'))
  .post('/prices', validate('json', observationSchema), async (c) => {
    const result = await ingestPrice(c.req.valid('json'), 'admin');
    if (result.status === 'unknown_commodity') return c.json({ error: 'Unknown commodity', result }, 404);
    return c.json({ result }, result.status === 'changed' ? 201 : 200);
  })
  .post(
    '/commodities',
    validate(
      'json',
      z.object({
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase-kebab-case'),
        name: z.string().min(1).max(80),
        category: z.enum(CATEGORIES),
        unit: z.string().min(1).max(16).default('kg'),
      }),
    ),
    async (c) => {
      const [row] = await db.insert(commodities).values(c.req.valid('json')).onConflictDoNothing().returning();
      if (!row) return c.json({ error: 'Slug already exists' }, 409);
      return c.json({ commodity: row }, 201);
    },
  );

/**
 * Machine ingestion (scraper today, vendor submissions later). Same change-detection path as
 * admin entry: unchanged prices are acknowledged but never written or broadcast.
 */
export const ingestRoutes = new Hono<AuthEnv>()
  .use(...requireRole('ingest', 'admin'))
  .post(
    '/prices',
    validate('json', z.object({ observations: z.array(observationSchema).min(1).max(500) })),
    async (c) => c.json(await ingestBatch(c.req.valid('json').observations, 'scraper')),
  );
