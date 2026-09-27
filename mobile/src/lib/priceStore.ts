import { useSyncExternalStore } from 'react';
import { rowKey } from './format';
import type { PriceEvent, TickerRow } from './types';

/** A ticker row plus when it last changed *while the app was watching*, which drives the flash. */
export type LiveRow = TickerRow & { liveChangedAt?: number };

type Listener = () => void;
type EventListener = (event: PriceEvent) => void;

/**
 * Client-side mirror of the latest price per (commodity, market). Filled from a REST snapshot,
 * then patched by WebSocket `price` events. Nothing here polls: rows only change on push.
 */
class PriceStore {
  private rows = new Map<string, LiveRow>();
  private list: LiveRow[] = [];
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();
  loaded = false;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getRows = () => this.list;

  /** For screens that need every event (e.g. appending to a live chart). */
  onEvent(fn: EventListener) {
    this.eventListeners.add(fn);
    return () => {
      this.eventListeners.delete(fn);
    };
  }

  /**
   * Replaces state with a snapshot, but keeps any row the socket already updated past the
   * snapshot (events can arrive while the snapshot request is in flight). recordedAt values are
   * fixed-width ISO strings from the backend, so string comparison is chronological.
   */
  applySnapshot(items: TickerRow[]) {
    const next = new Map<string, LiveRow>();
    for (const item of items) {
      const key = rowKey(item);
      const current = this.rows.get(key);
      next.set(key, current && current.recordedAt > item.recordedAt ? current : { ...item, liveChangedAt: current?.liveChangedAt });
    }
    for (const [key, row] of this.rows) if (!next.has(key) && row.liveChangedAt) next.set(key, row);
    this.rows = next;
    this.loaded = true;
    this.emit();
  }

  applyEvent(event: PriceEvent) {
    const key = rowKey(event);
    const current = this.rows.get(key);
    if (current && current.recordedAt > event.recordedAt) return; // stale/out-of-order
    const { id: _id, source: _source, ...row } = event;
    this.rows.set(key, { ...row, liveChangedAt: Date.now() });
    this.emit();
    for (const fn of this.eventListeners) fn(event);
  }

  private emit() {
    this.list = [...this.rows.values()].sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.marketLocation.localeCompare(b.marketLocation),
    );
    for (const fn of this.listeners) fn();
  }
}

export const priceStore = new PriceStore();

export const useLiveRows = () => useSyncExternalStore(priceStore.subscribe, priceStore.getRows);
