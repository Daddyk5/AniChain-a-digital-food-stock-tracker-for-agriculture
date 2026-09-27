import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { api } from '@/lib/api';
import { WS_URL } from '@/lib/config';
import { priceStore } from '@/lib/priceStore';
import { RealtimeClient, type ConnectionStatus } from '@/lib/realtime';
import type { PriceEvent } from '@/lib/types';
import { useWatchlist } from '@/lib/watchlist';

type LiveContextValue = {
  status: ConnectionStatus;
  loadError: string | null;
  alert: { event: PriceEvent; key: number } | null;
  dismissAlert: () => void;
  refresh: () => Promise<void>;
};

const LiveContext = createContext<LiveContextValue | null>(null);

/**
 * Owns the single WebSocket connection. It connects while the app is in the foreground and
 * disconnects in the background. Each (re)connect refetches the snapshot, so updates missed
 * while offline are recovered without polling.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alert, setAlert] = useState<LiveContextValue['alert']>(null);
  const clientRef = useRef<RealtimeClient | null>(null);
  const watched = useWatchlist();

  const refresh = useCallback(
    () =>
      api.ticker().then(
        (items) => {
          priceStore.applySnapshot(items);
          setLoadError(null);
        },
        (err: unknown) => setLoadError(err instanceof Error ? err.message : 'Could not load prices'),
      ),
    [],
  );

  useEffect(() => {
    const client = new RealtimeClient(WS_URL, {
      onStatus: setStatus,
      onOpen: () => void refresh(),
      onMessage: (msg) => {
        if (msg.type === 'price') priceStore.applyEvent(msg.data);
        else if (msg.type === 'alert') setAlert({ event: msg.data, key: msg.data.id });
        else if (msg.type === 'resync') void refresh();
      },
    });
    clientRef.current = client;
    client.start();
    void refresh();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.start();
      else if (state === 'background') client.stop();
    });
    return () => {
      sub.remove();
      client.stop();
      clientRef.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    clientRef.current?.setWatchlist(watched);
  }, [watched]);

  const dismissAlert = useCallback(() => setAlert(null), []);

  return (
    <LiveContext value={{ status, loadError, alert, dismissAlert, refresh }}>{children}</LiveContext>
  );
}

export function useLive() {
  const ctx = use(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside <LiveProvider>');
  return ctx;
}
