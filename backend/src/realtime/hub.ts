import type { WSContext } from 'hono/ws';
import type { WebSocket } from 'ws';
import type { PriceEvent, ServerMessage } from './types.ts';

type Client = { watch: Set<number>; alive: boolean };

const MAX_WATCHED = 200;
const HEARTBEAT_MS = 30_000;

/** Tracks connected WebSocket clients and what each one is watching. In-process only: with several
 *  backend instances, each one LISTENs to Postgres itself, so no cross-instance fan-out is needed. */
class Hub {
  private clients = new Map<WSContext<WebSocket>, Client>();
  private heartbeat: NodeJS.Timeout | undefined;

  get size() {
    return this.clients.size;
  }

  add(ws: WSContext<WebSocket>) {
    const client: Client = { watch: new Set(), alive: true };
    this.clients.set(ws, client);
    ws.raw?.on('pong', () => (client.alive = true));
    this.send(ws, { type: 'hello', serverTime: new Date().toISOString() });
  }

  remove(ws: WSContext<WebSocket>) {
    this.clients.delete(ws);
  }

  setWatchlist(ws: WSContext<WebSocket>, commodityIds: number[]) {
    const client = this.clients.get(ws);
    if (client) client.watch = new Set(commodityIds.slice(0, MAX_WATCHED));
  }

  publishPrice(event: PriceEvent) {
    const price = JSON.stringify({ type: 'price', data: event } satisfies ServerMessage);
    const alert = JSON.stringify({ type: 'alert', data: event } satisfies ServerMessage);
    for (const [ws, client] of this.clients) {
      this.sendRaw(ws, price);
      if (client.watch.has(event.commodityId)) this.sendRaw(ws, alert);
    }
  }

  broadcast(message: ServerMessage) {
    const data = JSON.stringify(message);
    for (const ws of this.clients.keys()) this.sendRaw(ws, data);
  }

  send(ws: WSContext<WebSocket>, message: ServerMessage) {
    this.sendRaw(ws, JSON.stringify(message));
  }

  /** Drops connections that stopped answering pings (mobile clients vanish without closing). */
  startHeartbeat() {
    this.heartbeat ??= setInterval(() => {
      for (const [ws, client] of this.clients) {
        if (!client.alive) {
          ws.raw?.terminate();
          this.clients.delete(ws);
          continue;
        }
        client.alive = false;
        ws.raw?.ping();
      }
    }, HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  stop() {
    clearInterval(this.heartbeat);
    for (const ws of this.clients.keys()) ws.close(1001, 'Server shutting down');
    this.clients.clear();
  }

  private sendRaw(ws: WSContext<WebSocket>, data: string) {
    if (ws.readyState === 1) ws.send(data);
  }
}

export const hub = new Hub();
