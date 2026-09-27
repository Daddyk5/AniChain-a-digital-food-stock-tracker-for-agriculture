-- Broadcast every *new latest* price on the `price_update` channel.
-- The backend LISTENs on this channel and fans events out over WebSocket. Because the notify lives
-- in the database, any writer (API, scraper, a psql session) triggers a broadcast, and because
-- ingestion only inserts on change, unchanged prices never produce an event.
CREATE OR REPLACE FUNCTION notify_price_update() RETURNS trigger AS $$
DECLARE
  prev_price numeric;
  c record;
BEGIN
  -- Backfilled/historical rows (older than the current latest) and demo seed data are not live events.
  IF NEW.source = 'seed-demo' OR EXISTS (
    SELECT 1 FROM price_history
    WHERE commodity_id = NEW.commodity_id
      AND market_location = NEW.market_location
      AND (recorded_at > NEW.recorded_at OR (recorded_at = NEW.recorded_at AND id > NEW.id))
  ) THEN
    RETURN NEW;
  END IF;

  SELECT price INTO prev_price
  FROM price_history
  WHERE commodity_id = NEW.commodity_id
    AND market_location = NEW.market_location
    AND id <> NEW.id
  ORDER BY recorded_at DESC, id DESC
  LIMIT 1;

  SELECT slug, name, category, unit INTO c FROM commodities WHERE id = NEW.commodity_id;

  PERFORM pg_notify('price_update', json_build_object(
    'id', NEW.id,
    'commodityId', NEW.commodity_id,
    'slug', c.slug,
    'name', c.name,
    'category', c.category,
    'unit', c.unit,
    'marketLocation', NEW.market_location,
    'price', NEW.price::text,
    'previousPrice', prev_price::text,
    'source', NEW.source,
    'recordedAt', to_char(NEW.recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS price_history_notify ON price_history;
--> statement-breakpoint
CREATE TRIGGER price_history_notify
AFTER INSERT ON price_history
FOR EACH ROW EXECUTE FUNCTION notify_price_update();
