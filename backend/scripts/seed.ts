import { db, pool } from '../src/db/client.ts';
import { commodities } from '../src/db/schema.ts';
import { CATALOG } from './catalog.ts';

const inserted = await db.insert(commodities).values(CATALOG).onConflictDoNothing().returning({ slug: commodities.slug });
console.log(`Seeded ${inserted.length} new commodities (${CATALOG.length - inserted.length} already existed).`);
await pool.end();
