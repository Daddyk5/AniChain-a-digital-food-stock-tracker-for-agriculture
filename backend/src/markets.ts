// v1 scope is Davao City only. Every price row must reference one of these markets, which is how
// the backend enforces the Davao-only rule regardless of which source submitted the price.
export const DAVAO_MARKETS = {
  bankerohan: 'Bankerohan Public Market',
  agdao: 'Agdao Public Market',
  'davao-city': 'Davao City (city-wide bulletin)',
} as const;

export type MarketKey = keyof typeof DAVAO_MARKETS;
export const MARKET_KEYS = Object.keys(DAVAO_MARKETS) as [MarketKey, ...MarketKey[]];
