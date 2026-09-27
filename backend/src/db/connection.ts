import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';

/**
 * Builds node-postgres connection options.
 *
 * Aiven requires TLS. When a CA cert path is given we verify the server against it, and strip
 * `sslmode` from the URL because node-postgres lets URL params override the `ssl` object.
 */
export function poolConfig(databaseUrl: string, caCertPath?: string) {
  if (!caCertPath) return { connectionString: databaseUrl, ssl: undefined } satisfies PoolConfig;

  const url = new URL(databaseUrl);
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.toString(),
    ssl: { ca: readFileSync(caCertPath, 'utf8'), rejectUnauthorized: true },
  } satisfies PoolConfig;
}
