import { validator } from 'hono/validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';

/** Minimal zod validator for Hono that returns a 400 with readable issues. */
export const validate = <T extends z.ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  validator(target, (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json(
        { error: 'Invalid request', issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
        400,
      );
    }
    return result.data as z.output<T>;
  });
