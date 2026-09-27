/**
 * End-to-end check against a running backend (npm run dev) and a migrated + seeded database:
 * change detection, NOTIFY → WebSocket broadcast, watch alerts, auth, and Davao-only validation.
 * Writes real rows (source=admin/scraper) for `tomato` / `onion-red`, so use a dev database.
 *   API_URL=http://localhost:3000 WS_URL=ws://localhost:3000/ws npm run smoke
 */
import assert from 'node:assert/strict';
import { issueToken } from '../src/auth/jwt.ts';
import { env } from '../src/env.ts';
import type { ServerMessage } from '../src/realtime/types.ts';

const API = process.env.API_URL ?? `http://localhost:${env.PORT}`;
const WS = process.env.WS_URL ?? `ws://localhost:${env.WS_PORT ?? env.PORT}/ws`;

const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
  });
  return { status: res.status, body: (await res.json()) as any };
};

const messages: ServerMessage[] = [];
const socket = new WebSocket(WS);
await new Promise<void>((resolve, reject) => {
  socket.onmessage = (e) => messages.push(JSON.parse(String(e.data)));
  socket.onopen = () => resolve();
  socket.onerror = () => reject(new Error(`Cannot connect to ${WS}`));
});
const settle = () => new Promise((r) => setTimeout(r, 400));
await settle();
assert.equal(messages[0]?.type, 'hello');

const { body: list } = await call('/api/commodities');
console.log(`ticker rows: ${list.items.length}`);

const login = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }) });
assert.equal(login.status, 200, 'admin login');
const admin = login.body.token as string;

assert.equal((await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong-password' }) })).status, 401);
assert.equal((await call('/api/admin/prices', { method: 'POST', body: '{}' })).status, 401, 'no token → 401');

const base = Math.round(100 + Math.random() * 50);
const post = (price: number, marketLocation = 'bankerohan') =>
  call('/api/admin/prices', { method: 'POST', token: admin, body: JSON.stringify({ slug: 'tomato', price, marketLocation }) });

const first = await post(base);
assert.equal(first.body.result.status, 'changed');
const tomatoId = first.body.result.commodityId as number;
socket.send(JSON.stringify({ type: 'watch', commodityIds: [tomatoId] }));
await settle();
messages.length = 0;

// 1) Same price again → unchanged, nothing broadcast.
const same = await post(base);
assert.equal(same.status, 200);
assert.equal(same.body.result.status, 'unchanged');
await settle();
assert.equal(messages.length, 0, 'unchanged price must not broadcast');
console.log('✓ unchanged price: not written, not broadcast');

// 2) New price → changed, broadcast as `price` + `alert` (watched).
const changed = await post(base + 5.5);
assert.equal(changed.status, 201);
await settle();
assert.deepEqual(messages.map((m) => m.type).sort(), ['alert', 'price']);
const evt = messages.find((m) => m.type === 'price')!;
assert.ok(evt.type === 'price');
assert.equal(evt.data.price, (base + 5.5).toFixed(2));
assert.equal(evt.data.previousPrice, base.toFixed(2));
console.log(`✓ changed price broadcast: ${evt.data.previousPrice} → ${evt.data.price} (+alert for watcher)`);
messages.length = 0;

// 3) Scraper batch via ingest token: one change for an unwatched commodity, one unchanged, one unknown.
const { token: ingest } = await issueToken('smoke-scraper', 'ingest', 300);
const batch = await call('/api/ingest/prices', {
  method: 'POST',
  token: ingest,
  body: JSON.stringify({
    observations: [
      { slug: 'onion-red', price: base + Math.random(), marketLocation: 'agdao' },
      { slug: 'tomato', price: base + 5.5, marketLocation: 'bankerohan' },
      { slug: 'no-such-thing', price: 10, marketLocation: 'agdao' },
    ],
  }),
});
assert.equal(batch.status, 200);
assert.deepEqual(batch.body.summary, { received: 3, changed: 1, unchanged: 1, unknown: 1 });
await settle();
assert.deepEqual(messages.map((m) => m.type), ['price'], 'unwatched change → price only, no alert');
console.log('✓ ingest batch: 1 changed / 1 unchanged / 1 unknown, single broadcast');

// 4) Ingest token cannot use admin endpoint; non-Davao market rejected.
assert.equal((await call('/api/admin/prices', { method: 'POST', token: ingest, body: JSON.stringify({ slug: 'tomato', price: 1, marketLocation: 'agdao' }) })).status, 403);
assert.equal((await post(99, 'divisoria')).status, 400);
console.log('✓ role check (403) and Davao-only market validation (400)');

// 5) Read endpoints.
const ticker = await call('/api/commodities?category=vegetables&market=bankerohan');
const row = ticker.body.items.find((r: any) => r.slug === 'tomato');
assert.equal(row.price, (base + 5.5).toFixed(2));
assert.equal(row.previousPrice, base.toFixed(2));
const hist = await call(`/api/commodities/${tomatoId}/history?range=7d&market=bankerohan`);
assert.ok(hist.body.points.length >= 2);
console.log(`✓ ticker + history (${hist.body.points.length} points in 7d)`);

socket.close();
console.log('\nSmoke test passed.');
