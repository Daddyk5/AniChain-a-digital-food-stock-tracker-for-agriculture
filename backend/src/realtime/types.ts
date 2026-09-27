import type { Category, PriceSource } from '../db/schema.ts';

/** Shape of the `price_update` NOTIFY payload (see drizzle/0001_price_notify_trigger.sql). */
export type PriceEvent = {
  id: number;
  commodityId: number;
  slug: string;
  name: string;
  category: Category;
  unit: string;
  marketLocation: string;
  price: string;
  previousPrice: string | null;
  source: PriceSource;
  recordedAt: string;
};

export type ServerMessage =
  | { type: 'hello'; serverTime: string }
  // Sent to every client: drives the ticker and charts.
  | { type: 'price'; data: PriceEvent }
  // Sent only to clients watching data.commodityId: drives price-change alerts.
  | { type: 'alert'; data: PriceEvent }
  // The DB listener reconnected, so events may have been missed. Clients should refetch.
  | { type: 'resync' }
  | { type: 'error'; message: string };

export type ClientMessage = { type: 'watch'; commodityIds: number[] };
