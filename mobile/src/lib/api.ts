import { API_URL } from './config';
import type { Commodity, HistoryResponse, MarketKey, Range, TickerRow } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(API_URL + path, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  ticker: () => request<{ items: TickerRow[] }>('/api/commodities').then((r) => r.items),
  catalog: () => request<{ items: Commodity[] }>('/api/catalog').then((r) => r.items),
  history: (commodityId: number, market: MarketKey, range: Range) =>
    request<HistoryResponse>(`/api/commodities/${commodityId}/history?range=${range}&market=${market}`),
  insight: (commodityId: number, market: MarketKey) =>
    request<{ text: string; model: string; generatedAt: string }>(
      `/api/commodities/${commodityId}/insight?market=${market}`,
    ),
  login: (username: string, password: string) =>
    request<{ token: string; expiresAt: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  submitPrice: (token: string, body: { commodityId: number; marketLocation: MarketKey; price: number }) =>
    request<{
      result: { status: 'changed' | 'unchanged'; price: string; previousPrice?: string | null };
    }>('/api/admin/prices', { method: 'POST', token, body: JSON.stringify(body) }),
};
