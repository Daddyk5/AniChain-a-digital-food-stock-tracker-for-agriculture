import type { ServerMessage } from './types';

export type ConnectionStatus = 'connecting' | 'live' | 'offline';

type Handlers = {
  onMessage: (msg: ServerMessage) => void;
  /** Called on every successful (re)connect. Events sent while disconnected are lost, so the
   *  caller should refetch the snapshot here. */
  onOpen: () => void;
  onStatus: (status: ConnectionStatus) => void;
};

/**
 * WebSocket client with exponential-backoff reconnects. Price updates are server-pushed. The
 * client never polls for prices; the only timer is the reconnect backoff.
 */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private active = false;
  private watch: number[] = [];

  constructor(
    private url: string,
    private handlers: Handlers,
  ) {}

  start() {
    if (this.active) return;
    this.active = true;
    this.open();
  }

  stop() {
    this.active = false;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.handlers.onStatus('offline');
  }

  setWatchlist(commodityIds: number[]) {
    this.watch = commodityIds;
    this.send({ type: 'watch', commodityIds });
  }

  private open() {
    this.handlers.onStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.attempt = 0;
      this.handlers.onStatus('live');
      this.send({ type: 'watch', commodityIds: this.watch });
      this.handlers.onOpen();
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      try {
        this.handlers.onMessage(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleReconnect() {
    if (!this.active || this.retryTimer) return;
    this.handlers.onStatus('offline');
    const delay = Math.min(30_000, 1000 * 2 ** this.attempt++) * (0.8 + Math.random() * 0.4);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (this.active) this.open();
    }, delay);
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
