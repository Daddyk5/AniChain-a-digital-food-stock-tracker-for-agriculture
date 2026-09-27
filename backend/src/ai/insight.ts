import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.ts';
import { DAVAO_MARKETS, type MarketKey } from '../markets.ts';
import { getHistory, getTicker } from '../queries.ts';

const MODEL = 'claude-opus-5';

// Stable across requests (no dates or ids) so it stays cacheable.
const SYSTEM_PROMPT = `You write short price notes for AniChain, an app that tracks agricultural commodity prices in Davao City public markets (Philippines). Readers are shoppers, carinderia owners and market vendors checking prices on their phones.

You receive the recorded price changes for one commodity at one market. Prices are in Philippine pesos and a price stays in effect until the next change.

Write 2 to 3 plain sentences, under 70 words total:
- Say where the price is now and how it has moved over the last 30 days (direction, rough size, high and low).
- If the 90-day data shows a longer trend worth knowing, mention it briefly.
- If there are too few changes to say much, say the price has been stable or that there is little data.

Stick to what the numbers show. Do not invent causes (weather, supply, holidays), do not predict future prices, and do not give buying advice. Use ₱ amounts with two decimals. Plain text only: no markdown, no bullet points, no headings.`;

export type Insight = { text: string; model: string; generatedAt: string; basedOn: string };

let client: Anthropic | null = null;
const cache = new Map<string, Insight>();
const inFlight = new Map<string, Promise<Insight>>();

export const insightsEnabled = () => Boolean(env.ANTHROPIC_API_KEY);

export class InsightUnavailableError extends Error {}

/**
 * Returns a Claude-written summary of the price trend for one commodity at one market.
 * Cached per latest price: Claude is called again only after the price actually changes.
 */
export async function getInsight(commodityId: number, market: MarketKey): Promise<Insight | null> {
  const [row] = await getTicker({ commodityId, market });
  if (!row) return null;

  const key = `${commodityId}:${market}`;
  const cached = cache.get(key);
  if (cached?.basedOn === row.recordedAt) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = generate(row.name, row.unit, market, commodityId, row.recordedAt).finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  const insight = await job;
  cache.set(key, insight);
  return insight;
}

async function generate(name: string, unit: string, market: MarketKey, commodityId: number, latestAt: string) {
  const [d30, d90] = await Promise.all([
    getHistory(commodityId, market, '30d'),
    getHistory(commodityId, market, '90d'),
  ]);

  const lines = (h: typeof d30) => [
    `Price in effect at start (${h.since.slice(0, 10)}): ${h.openingPrice ? `₱${h.openingPrice}` : 'unknown'}`,
    ...h.points.map((p) => `${p.recordedAt.slice(0, 10)}: ₱${p.price}`),
  ];

  const data = [
    `Commodity: ${name} (price per ${unit})`,
    `Market: ${DAVAO_MARKETS[market]}, Davao City`,
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Last 30 days (${d30.points.length} changes):`,
    ...lines(d30),
    '',
    `Last 90 days (${d90.points.length} changes):`,
    ...lines(d90),
  ].join('\n');

  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    // If a safety classifier declines, Anthropic re-runs the request on its recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: data }],
  });

  if (response.stop_reason === 'refusal') throw new InsightUnavailableError('The model declined to summarize this data');
  const text = response.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('')
    .trim();
  if (!text) throw new InsightUnavailableError('The model returned no text');

  return { text, model: response.model, generatedAt: new Date().toISOString(), basedOn: latestAt };
}
