import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../src/db/client.ts';

await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
console.log('Migrations applied.');
await pool.end();
