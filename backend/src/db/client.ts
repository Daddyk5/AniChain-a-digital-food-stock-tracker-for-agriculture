import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../env.ts';
import { poolConfig } from './connection.ts';
import * as schema from './schema.ts';

export const pool = new pg.Pool({ ...poolConfig(env.DATABASE_URL, env.DATABASE_CA_CERT), max: 10 });
export const db = drizzle(pool, { schema });
export type DB = typeof db;
