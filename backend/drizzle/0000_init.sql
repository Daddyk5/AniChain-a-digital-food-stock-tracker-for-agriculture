CREATE TYPE "public"."commodity_category" AS ENUM('meat', 'fish', 'eggs', 'vegetables', 'fruits');--> statement-breakpoint
CREATE TYPE "public"."price_source" AS ENUM('scraper', 'admin', 'vendor', 'seed-demo');--> statement-breakpoint
CREATE TABLE "commodities" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "commodity_category" NOT NULL,
	"unit" text DEFAULT 'kg' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commodities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"commodity_id" integer NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"market_location" text NOT NULL,
	"source" "price_source" NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_history_commodity_market_recorded_idx" ON "price_history" USING btree ("commodity_id","market_location","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "price_history_recorded_idx" ON "price_history" USING btree ("recorded_at");