import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';

const KEY = 'anichain.watchlist.v1';

/** Commodity ids the user wants price-change alerts for. Persisted locally on the device. */
class Watchlist {
  private ids: number[] = load();
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  get = () => this.ids;

  has(id: number) {
    return this.ids.includes(id);
  }

  toggle(id: number) {
    this.ids = this.has(id) ? this.ids.filter((x) => x !== id) : [...this.ids, id];
    Storage.setItemSync(KEY, JSON.stringify(this.ids));
    for (const fn of this.listeners) fn();
  }
}

function load(): number[] {
  try {
    const parsed = JSON.parse(Storage.getItemSync(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

export const watchlist = new Watchlist();

export const useWatchlist = () => useSyncExternalStore(watchlist.subscribe, watchlist.get);
