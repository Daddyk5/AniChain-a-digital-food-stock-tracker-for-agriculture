import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { sql } from 'drizzle-orm';
import type { Server } from 'node:http';
import { env } from './env.ts';
import { db, pool } from './db/client.ts';
import { hub } from './realtime/hub.ts';
import { startPriceListener } from './realtime/listener.ts';
import type { ClientMessage } from './realtime/types.ts';
import { adminRoutes, ingestRoutes } from './routes/admin.ts';
import { authRoutes } from './routes/auth.ts';
import { publicRoutes } from './routes/public.ts';

const app = new Hono();
app.use(logger());
app.use('/api/*', cors({ origin: env.CORS_ORIGIN }));

app.get('/health', async (c) => {
  await db.execute(sql`select 1`);
  return c.json({ ok: true, wsClients: hub.size });
});
app.route('/api', publicRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/ingest', ingestRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    // Keep headers such as WWW-Authenticate from the JWT middleware, but always answer in JSON.
    const { headers } = err.getResponse();
    headers.delete('content-type');
    return c.json({ error: err.message || 'Request failed' }, err.status, Object.fromEntries(headers));
  }
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

/** Mounts `GET /ws` on the given app. Clients receive `price` events for every change and can
 *  send `{ type: 'watch', commodityIds }` to also receive `alert` events for those commodities. */
function mountWebSocket(target: Hono) {
  const nodeWs = createNodeWebSocket({ app: target });
  target.get(
    '/ws',
    nodeWs.upgradeWebSocket(() => ({
      onOpen: (_evt, ws) => hub.add(ws),
      onMessage: (evt, ws) => {
        try {
          const msg = JSON.parse(String(evt.data)) as ClientMessage;
          if (msg.type === 'watch' && Array.isArray(msg.commodityIds)) {
            hub.setWatchlist(ws, msg.commodityIds.filter((id) => Number.isInteger(id)));
          }
        } catch {
          hub.send(ws, { type: 'error', message: 'Invalid message' });
        }
      },
      onClose: (_evt, ws) => hub.remove(ws),
    })),
  );
  return nodeWs;
}

const wsPort = env.WS_PORT ?? env.PORT;
const servers: Server[] = [];

if (wsPort === env.PORT) {
  const nodeWs = mountWebSocket(app);
  const server = serve({ fetch: app.fetch, port: env.PORT }) as Server;
  nodeWs.injectWebSocket(server);
  servers.push(server);
  console.log(`HTTP + WebSocket listening on http://localhost:${env.PORT} (ws path /ws)`);
} else {
  servers.push(serve({ fetch: app.fetch, port: env.PORT }) as Server);
  const wsApp = new Hono();
  const nodeWs = mountWebSocket(wsApp);
  const wsServer = serve({ fetch: wsApp.fetch, port: wsPort }) as Server;
  nodeWs.injectWebSocket(wsServer);
  servers.push(wsServer);
  console.log(`HTTP listening on http://localhost:${env.PORT}; WebSocket on ws://localhost:${wsPort}/ws`);
}

hub.startHeartbeat();
const stopListener = startPriceListener();

const shutdown = async () => {
  console.log('Shutting down…');
  hub.stop();
  await stopListener();
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
