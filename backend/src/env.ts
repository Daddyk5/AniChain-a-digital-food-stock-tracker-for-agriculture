import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

// Load backend/.env first, then the repo-root .env (first file wins on conflicts).
const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: [resolve(backendDir, '.env'), resolve(backendDir, '../.env')], quiet: true });

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Path to Aiven's CA certificate (ca.pem). Optional for local Postgres.
  DATABASE_CA_CERT: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().int().positive().default(3000),
  // If equal to PORT (or unset), the WebSocket endpoint is served on the HTTP server at /ws.
  WS_PORT: z.coerce.number().int().positive().optional(),
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  CORS_ORIGIN: z.string().default('*'),
  // Enables AI price insights (Claude). Leave unset to turn the feature off.
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
