# AniChain

A live, exchange-style price tracker for agricultural commodities in **Davao City** — meat, fish,
eggs, vegetables and fruits from Bankerohan, Agdao and city-wide bulletins.

Prices are **pushed, never polled**: a row is written only when a source reports a *different*
price, and that write is what broadcasts to every phone.

```
 Davao source ──poll 1–2 min──▶ scraper/ ──POST only changes──┐
 (bulletin, market report)      (delta vs last known price)   │
                                                              ▼
 Admin (mobile app / API) ──POST──────────────────▶ backend/  ingestPrice()
 Future vendor submissions ──POST─────────────────▶ (Hono)    ├─ lock (commodity, market)
                                                              ├─ same as latest? → "unchanged", stop
                                                              └─ INSERT price_history
                                                                        │ AFTER INSERT trigger
                                                                        ▼ pg_notify('price_update')
                                                              PostgreSQL (Aiven)
                                                                        │ LISTEN
                                                                        ▼
                                           WebSocket /ws ──▶ mobile/ (Expo): ticker, charts, alerts
```

| Folder | What | Stack |
| --- | --- | --- |
| [`backend/`](backend/) | REST API, WebSocket, change detection, auth, AI insights | Hono, Drizzle ORM, node-postgres, zod, Anthropic SDK |
| [`scraper/`](scraper/) | Polls sources, posts only changed prices | Python 3.11+ standard library (no dependencies) |
| [`mobile/`](mobile/) | Welcome, live ticker, detail charts + AI insight, alerts, admin entry | Expo SDK 57, Expo Router, victory-native, SecureStore |

---

## 1. Backend

Requirements: Node 20+ and PostgreSQL 14+ (Aiven, or local Docker for development).

```bash
cp .env.example .env        # at the repo root (or backend/.env), then fill it in
cd backend
npm install
npm run db:migrate          # tables, indexes, NOTIFY trigger
npm run db:seed             # Davao commodity catalog (names/categories only, no prices)
npm run dev                 # http://localhost:3000, WebSocket at ws://localhost:3000/ws
```

### Connecting to Aiven

1. Aiven Console → your PostgreSQL service → **Overview**.
2. Copy the **Service URI** into `DATABASE_URL` (it contains `?sslmode=require`).
3. Download the **CA certificate** (`ca.pem`) and set `DATABASE_CA_CERT=/path/to/ca.pem`. The
   backend then verifies the server certificate. Don't commit the file (`*.pem` is gitignored).
4. `npm run db:migrate`.

LISTEN/NOTIFY works on Aiven as-is. The backend holds one dedicated connection for `LISTEN` (it
reconnects with backoff and tells clients to `resync`) and a pool of up to 10 for queries. Every
backend instance LISTENs on its own, so you can run several behind a load balancer without extra
fan-out.

### Local test database

```bash
docker run -d --name anichain-pg -e POSTGRES_USER=anichain -e POSTGRES_PASSWORD=anichain \
  -e POSTGRES_DB=anichain -p 5433:5432 postgres:17-alpine
# DATABASE_URL=postgres://anichain:anichain@localhost:5433/anichain
```

Optional, **development only**: `npm run db:seed-demo -- --yes` generates 90 days of *synthetic*
history (tagged `source='seed-demo'`, never broadcast) so the charts have something to draw.
Remove it with `DELETE FROM price_history WHERE source = 'seed-demo';`.

### WebSocket config

- `WS_PORT` equal to `PORT` (the default): WebSocket is served on the HTTP server at `/ws`. This
  is simplest behind hosts that expose a single port.
- `WS_PORT` different from `PORT`: a separate listener at `ws://host:WS_PORT/ws`.

Protocol (JSON text frames):

| Direction | Message | Meaning |
| --- | --- | --- |
| server → client | `{type:"hello"}` | connected |
| server → client | `{type:"price", data}` | a price changed (sent to everyone) |
| server → client | `{type:"alert", data}` | a price changed for a commodity this client watches |
| server → client | `{type:"resync"}` | the DB listener reconnected, so refetch `/api/commodities` |
| client → server | `{type:"watch", commodityIds:[…]}` | replace this client's watchlist |

`data` has the shape `{ id, commodityId, slug, name, category, unit, marketLocation, price, previousPrice, source, recordedAt }`.
Prices are decimal strings (`"133.50"`) and timestamps are `YYYY-MM-DDTHH:mm:ss.sssZ`.

### API

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | – | DB ping + connected WS clients |
| `GET /api/commodities?category=&market=&q=` | – | ticker: latest price + previous price per (commodity, market) |
| `GET /api/commodities/:id` | – | commodity + its markets |
| `GET /api/commodities/:id/history?market=&range=7d\|30d\|90d` | – | changes in range + opening price |
| `GET /api/commodities/:id/insight?market=` | – | AI trend summary (Claude); 503 when `ANTHROPIC_API_KEY` is unset |
| `GET /api/catalog` · `/api/markets` · `/api/categories` | – | reference data |
| `POST /api/auth/login` `{username,password}` | – | admin JWT (12 h) |
| `POST /api/admin/prices` `{slug\|commodityId, price, marketLocation}` | admin | manual entry, same change detection |
| `POST /api/admin/commodities` `{slug,name,category,unit}` | admin | add a commodity |
| `POST /api/ingest/prices` `{observations:[…]}` | ingest, admin | batch ingestion (scraper) |

`marketLocation` must be one of `bankerohan`, `agdao`, `davao-city`. Anything else gets a 400,
which is how the Davao-only scope is enforced. Add markets in
[`backend/src/markets.ts`](backend/src/markets.ts) and [`mobile/src/lib/types.ts`](mobile/src/lib/types.ts).

### Change detection

Every source calls `ingestPrice()` in [`backend/src/ingest/changeDetection.ts`](backend/src/ingest/changeDetection.ts).
Inside one transaction it:

1. Takes an advisory lock on (commodity, market), so concurrent writers can't double-insert.
2. Compares the price to the latest stored one at 2-decimal precision.
3. Inserts only if the price differs. The `price_history_notify` trigger then emits the event.

Because the broadcast comes from the database trigger, nothing can broadcast without a real
insert. Adding crowdsourced vendor submissions later means adding a route that authenticates
vendors and calls `ingestBatch(observations, 'vendor')`. The `vendor` source value already exists
in the schema.

### AI price insights (Claude)

Set `ANTHROPIC_API_KEY` to turn on a short, plain-language trend summary on each commodity screen,
for example "Tomato at Bankerohan is ₱88.50/kg, down from ₱133.50…".
[`backend/src/ai/insight.ts`](backend/src/ai/insight.ts) sends the recorded 30- and 90-day price
changes to `claude-opus-5` and returns the text.

- **Cost control:** each (commodity, market) insight is cached until its price changes, so Claude
  runs at most once per real price change, not once per view. The cache is in memory and resets
  when the backend restarts.
- **Guardrails:** the prompt limits Claude to what the numbers show. No invented causes, no
  forecasts, no buying advice. The app labels the card "Written by Claude… Not financial advice."
- **Refusals:** server-side fallbacks are on (`fallbacks: "default"`), so a safety-classifier
  decline is retried on Anthropic's recommended fallback model. If it still fails, the API returns
  502 and the app shows a short message.
- **Key handling:** the key stays on the server. The mobile app only calls the backend.

### Tests

```bash
npm run typecheck
npm run smoke        # against a running dev server + migrated/seeded DB. Writes tomato/onion rows.
```

The smoke test checks: an unchanged price is neither written nor broadcast; a changed price is
broadcast with the correct previous price; watch alerts go only to watchers; batch summary counts;
401/403 role checks; non-Davao markets are rejected; and the ticker and history endpoints.

---

## 2. Scraper

Requirements: Python 3.11+. No third-party packages.

```bash
cd backend && npm run token     # prints a role=ingest JWT → set INGEST_TOKEN in .env
cd ../scraper
python -m anichain_scraper --once     # one fetch → compare → post cycle
python -m anichain_scraper            # poll every SCRAPE_INTERVAL seconds (±10% jitter)
python -m unittest discover -s tests -t .
```

How it works:

- On startup it seeds its baseline from `GET /api/commodities`, so the backend is the source of
  truth. It also persists state to `scraper/state/last_prices.json`, so restarts don't re-post.
- Each cycle fetches `SOURCE_URL`, parses it with the adapter for `SOURCE_FORMAT`, and POSTs
  **only** the observations whose price differs from the last known value.
- If the backend is unreachable, nothing is marked as sent, so the changes retry next cycle.
- Source labels ("Pork Kasim", "Bankerohan Public Market") are mapped to backend slugs and markets
  in [`scraper/commodity_map.json`](scraper/commodity_map.json). Unmapped labels are logged once
  and skipped.
- Price ranges such as `180-200` are stored as the midpoint.

**Real Davao sources aren't wired up yet.** Bulletin formats from the Davao City Agriculture and
Fisheries Council and the Bankerohan/Agdao markets still need to be confirmed. Two adapters exist
today: `json` and `html_table` (loose header matching: Commodity/Item, Prevailing Price/Price,
optional Market). A PDF bulletin needs a new adapter in
[`scraper/anichain_scraper/sources.py`](scraper/anichain_scraper/sources.py). Until then, use admin
manual entry.

To try the scraper locally without a real source:

```bash
python mock_source.py                   # fake bulletin at http://localhost:8765/bulletin.json (+ .html)
python -m anichain_scraper --once       # first run: posts all 6 prices
python -m anichain_scraper --once       # second run: "no changes", posts nothing
curl -X POST localhost:8765/bump        # change one random price
python -m anichain_scraper --once       # posts exactly 1 → one WebSocket event
```

---

## 3. Mobile (Expo)

Requirements: Node 20+. Expo Go (SDK 57) on a device or emulator, or a development build.

```bash
cd mobile
npm install
npx expo start
```

- **API location:** in development the app calls `http://<dev-server-host>:3000`, so a phone on
  the same Wi-Fi reaches your backend without config. To override, set `EXPO_PUBLIC_API_URL` (and
  optionally `EXPO_PUBLIC_WS_URL`) in `mobile/.env`. Production builds must use `https://` and
  `wss://`; release builds block cleartext HTTP.
- **Android emulator:** `adb reverse tcp:3000 tcp:3000` and `EXPO_PUBLIC_API_URL=http://localhost:3000`
  is the most reliable setup.
- **Windows:** if Expo Go can't download the bundle when using `--localhost`, Metro may be bound to
  IPv6 only. Start it with `NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --localhost`.

Screens:

- **Welcome** (`src/app/welcome.tsx`): shown on first launch; tap the logo on the home screen to
  see it again. It uses four real photos of Davao from Wikimedia Commons (Bankerohan and Agdao
  public markets, durian at a Davao stall, the city skyline), listed with author and license in
  [`src/constants/welcomePhotos.ts`](mobile/src/constants/welcomePhotos.ts). Each slide shows the
  credit and links to the photo's Commons page, as CC BY-SA requires. Photos load from
  `upload.wikimedia.org` and are cached on the device. If that host is unreachable, the slide shows
  a tinted background instead.
- **Markets** (`src/app/index.tsx`): top-movers ticker tape, search, category and market filters,
  and rows that flash green or red when a pushed change lands.
- **Commodity** (`src/app/commodity/[id].tsx`): live price, market switcher, and a 7D/30D/90D step
  chart (victory-native) that appends pushed changes. ☆ adds the commodity to the watchlist, which
  triggers in-app alerts.
- **Admin** (`src/app/admin.tsx`): sign in (JWT kept in SecureStore), pick a commodity and
  market, and submit a price. It goes through the same change detection as the scraper.

The app holds one WebSocket while in the foreground and closes it in the background. Each
reconnect refetches the snapshot, so changes missed while away are recovered without polling. The
watchlist is stored on the device (`expo-sqlite/kv-store`).

**Logo and icons:** the mark is a gold leaf with a rising price line cut through it. It's defined
once in [`mobile/scripts/make-icons.mjs`](mobile/scripts/make-icons.mjs) and `npm run icons`
regenerates the app icon, Android adaptive and monochrome icons, splash, favicon, `logo.png`, and
`assets/brand/logo.svg`. App IDs are `ph.anichain.app` (iOS bundle ID and Android package). Change
them in `app.json` before the first store build if you use a different domain.

Checks: `npx tsc --noEmit` and `npx expo lint`.

---

## Environment variables

See [`.env.example`](.env.example). The backend and scraper read `backend/.env` or `scraper/.env`
first, then the repo-root `.env`. The mobile app reads only `mobile/.env`.

## Out of scope for the MVP

Regions other than Davao, blockchain or smart contracts, payments, and push notifications while the
app is closed. Alerts are delivered in-app over the WebSocket.
