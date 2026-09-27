/**
 * LOCAL DEVELOPMENT ONLY. Generates 90 days of *synthetic* price history so the charts have
 * something to draw before real bulletins are ingested. Rows are tagged source='seed-demo' (the
 * NOTIFY trigger ignores them) and can be removed with:
 *   DELETE FROM price_history WHERE source = 'seed-demo';
 * These numbers are made up. Never run this against production.
 */
import { db, pool } from '../src/db/client.ts';
import { commodities, priceHistory } from '../src/db/schema.ts';

if (!process.argv.includes('--yes')) {
  console.error('This writes FAKE prices tagged source=seed-demo. Re-run with --yes to confirm (dev databases only).');
  process.exit(1);
}

// Rough order-of-magnitude placeholders per unit, only to make the demo charts look plausible.
const BASE: Record<string, number> = { meat: 320, fish: 200, eggs: 8, vegetables: 90, fruits: 110 };
const MARKETS = ['bankerohan', 'agdao'];
const DAY = 24 * 60 * 60 * 1000;

const rows = await db.select().from(commodities);
const values: (typeof priceHistory.$inferInsert)[] = [];
for (const c of rows) {
  for (const market of MARKETS) {
    let price = BASE[c.category]! * (0.7 + Math.random() * 0.6);
    let t = Date.now() - 90 * DAY;
    while (t < Date.now() - DAY) {
      values.push({ commodityId: c.id, marketLocation: market, price: price.toFixed(2), source: 'seed-demo', recordedAt: new Date(t) });
      t += (0.5 + Math.random() * 3) * DAY;
      price = Math.max(1, price * (1 + (Math.random() - 0.5) * 0.08));
    }
  }
}
await db.insert(priceHistory).values(values);
console.log(`Inserted ${values.length} synthetic rows for ${rows.length} commodities.`);
await pool.end();
