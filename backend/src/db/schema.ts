import {
  bigserial,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const CATEGORIES = ['meat', 'fish', 'eggs', 'vegetables', 'fruits'] as const;
export type Category = (typeof CATEGORIES)[number];

// Where a price observation came from. `vendor` is reserved for future crowdsourced submissions;
// every source goes through the same change-detection pipeline (src/ingest/changeDetection.ts).
export const PRICE_SOURCES = ['scraper', 'admin', 'vendor', 'seed-demo'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

export const categoryEnum = pgEnum('commodity_category', CATEGORIES);
export const priceSourceEnum = pgEnum('price_source', PRICE_SOURCES);

export const commodities = pgTable('commodities', {
  id: serial('id').primaryKey(),
  // Stable identifier used by the scraper/admin payloads, e.g. "pork-kasim".
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: categoryEnum('category').notNull(),
  unit: text('unit').notNull().default('kg'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const priceHistory = pgTable(
  'price_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    commodityId: integer('commodity_id')
      .notNull()
      .references(() => commodities.id, { onDelete: 'cascade' }),
    // Stored in PHP. numeric keeps exact centavos; node-postgres returns it as a string.
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    marketLocation: text('market_location').notNull(),
    source: priceSourceEnum('source').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('price_history_commodity_market_recorded_idx').on(
      t.commodityId,
      t.marketLocation,
      t.recordedAt.desc(),
    ),
    index('price_history_recorded_idx').on(t.recordedAt),
  ],
);

export type Commodity = typeof commodities.$inferSelect;
export type PriceRow = typeof priceHistory.$inferSelect;

export const PRICE_CHANNEL = 'price_update';
