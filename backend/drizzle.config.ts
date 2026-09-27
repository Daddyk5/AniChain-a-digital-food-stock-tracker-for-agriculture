import { defineConfig } from 'drizzle-kit';
import { env } from './src/env.ts';
import { poolConfig } from './src/db/connection.ts';

const { connectionString, ssl } = poolConfig(env.DATABASE_URL, env.DATABASE_CA_CERT);
const url = new URL(connectionString);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl,
  },
});
