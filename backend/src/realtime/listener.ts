import pg from 'pg';
import { env } from '../env.ts';
import { poolConfig } from '../db/connection.ts';
import { PRICE_CHANNEL } from '../db/schema.ts';
import { hub } from './hub.ts';
import type { PriceEvent } from './types.ts';

/**
 * Holds one dedicated connection (LISTEN can't go through the pool) and forwards each
 * `price_update` notification to the WebSocket hub. Reconnects with backoff. After a reconnect,
 * clients get a `resync` because notifications sent while disconnected are lost.
 */
export function startPriceListener() {
  let client: pg.Client | undefined;
  let stopped = false;
  let attempt = 0;
  let hasConnectedBefore = false;
  let retryTimer: NodeJS.Timeout | undefined;

  const connect = async () => {
    const c = new pg.Client(poolConfig(env.DATABASE_URL, env.DATABASE_CA_CERT));
    client = c;
    c.on('notification', (msg) => {
      if (msg.channel !== PRICE_CHANNEL || !msg.payload) return;
      try {
        hub.publishPrice(JSON.parse(msg.payload) as PriceEvent);
      } catch (err) {
        console.error('[listener] bad payload', err);
      }
    });
    c.on('error', (err) => {
      console.error('[listener] connection error:', err.message);
      scheduleReconnect(c);
    });
    c.on('end', () => scheduleReconnect(c));

    try {
      await c.connect();
      await c.query(`LISTEN ${PRICE_CHANNEL}`);
      console.log(`[listener] listening on "${PRICE_CHANNEL}"`);
      if (hasConnectedBefore) hub.broadcast({ type: 'resync' });
      hasConnectedBefore = true;
      attempt = 0;
    } catch (err) {
      console.error('[listener] connect failed:', (err as Error).message);
      scheduleReconnect(c);
    }
  };

  const scheduleReconnect = (c: pg.Client) => {
    if (stopped || c !== client || retryTimer) return;
    client = undefined;
    c.removeAllListeners();
    c.on('error', () => {}); // a late error on the dead client must not crash the process
    c.end().catch(() => {});
    const delay = Math.min(30_000, 1_000 * 2 ** attempt++);
    console.log(`[listener] reconnecting in ${delay}ms`);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void connect();
    }, delay);
  };

  void connect();

  return async () => {
    stopped = true;
    clearTimeout(retryTimer);
    await client?.end().catch(() => {});
  };
}
