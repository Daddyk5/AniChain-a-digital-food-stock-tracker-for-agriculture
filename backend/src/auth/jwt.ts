import { timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { jwt, sign } from 'hono/jwt';
import { env } from '../env.ts';

export type Role = 'admin' | 'ingest';
export type TokenPayload = { sub: string; role: Role; iat: number; exp: number };
export type AuthEnv = { Variables: { jwtPayload: TokenPayload } };

const ALG = 'HS256';

export async function issueToken(sub: string, role: Role, ttlSeconds: number) {
  const iat = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub, role, iat, exp: iat + ttlSeconds };
  return { token: await sign(payload, env.JWT_SECRET, ALG), expiresAt: new Date(payload.exp * 1000).toISOString() };
}

/** Verifies the Bearer token (signature + exp), then checks its role. */
export const requireRole = (...roles: Role[]) => [
  jwt({ secret: env.JWT_SECRET, alg: ALG }),
  createMiddleware<AuthEnv>(async (c, next) => {
    if (!roles.includes(c.get('jwtPayload').role)) throw new HTTPException(403, { message: 'Forbidden' });
    await next();
  }),
] as const;

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
