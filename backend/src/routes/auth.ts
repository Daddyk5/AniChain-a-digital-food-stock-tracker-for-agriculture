import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../env.ts';
import { issueToken, safeEqual } from '../auth/jwt.ts';
import { validate } from './validate.ts';

const ADMIN_TOKEN_TTL = 12 * 60 * 60;

export const authRoutes = new Hono().post(
  '/login',
  validate('json', z.object({ username: z.string(), password: z.string() })),
  async (c) => {
    const { username, password } = c.req.valid('json');
    // Evaluate both comparisons so response timing doesn't reveal which one failed.
    const userOk = safeEqual(username, env.ADMIN_USERNAME);
    const passOk = safeEqual(password, env.ADMIN_PASSWORD);
    if (!(userOk && passOk)) return c.json({ error: 'Invalid credentials' }, 401);
    return c.json({ ...(await issueToken(username, 'admin', ADMIN_TOKEN_TTL)), role: 'admin' as const });
  },
);
