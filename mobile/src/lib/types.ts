// Mirrors backend/src/queries.ts and backend/src/realtime/types.ts.

export const CATEGORIES = ['meat', 'fish', 'eggs', 'vegetables', 'fruits'] as const;
export type Category = (typeof CATEGORIES)[number];

export const MARKETS = {
  bankerohan: 'Bankerohan',
  agdao: 'Agdao',
  'davao-city': 'Davao City',
} as const;
export type MarketKey = keyof typeof MARKETS;

export type Commodity = { id: number; slug: string; name: string; category: Category; unit: string };

/** Latest price for one (commodity, market) pair. Prices are strings with 2 decimals (PHP). */
export type TickerRow = {
  commodityId: number;
  slug: string;
  name: string;
  category: Category;
  unit: string;
  marketLocation: MarketKey;
  price: string;
  previousPrice: string | null;
  recordedAt: string;
};

export type PriceEvent = TickerRow & { id: number; source: string };

export type HistoryResponse = {
  range: Range;
  since: string;
  openingPrice: string | null;
  points: { price: string; recordedAt: string }[];
};

export const RANGES = ['7d', '30d', '90d'] as const;
export type Range = (typeof RANGES)[number];

export type ServerMessage =
  | { type: 'hello'; serverTime: string }
  | { type: 'price'; data: PriceEvent }
  | { type: 'alert'; data: PriceEvent }
  | { type: 'resync' }
  | { type: 'error'; message: string };
