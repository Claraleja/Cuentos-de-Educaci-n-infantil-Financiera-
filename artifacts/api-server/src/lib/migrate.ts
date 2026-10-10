import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Crea las tablas de la tienda si no existen (base de datos nueva: Neon, Supabase, etc.).
 * Es idempotente: en una base que ya tiene las tablas no cambia nada.
 */
async function ensureBaseTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "store_admin_auth" (
    	"id" text PRIMARY KEY NOT NULL,
    	"password_salt" text NOT NULL,
    	"password_hash" text NOT NULL,
    	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "store_books" (
    	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    	"title" text NOT NULL,
    	"subtitle" text DEFAULT '' NOT NULL,
    	"author" text DEFAULT '' NOT NULL,
    	"short_description" text DEFAULT '' NOT NULL,
    	"description" text DEFAULT '' NOT NULL,
    	"recommended_age" text DEFAULT '' NOT NULL,
    	"pages" integer DEFAULT 1 NOT NULL,
    	"price_eur" double precision DEFAULT 0 NOT NULL,
    	"price_usd" double precision DEFAULT 0 NOT NULL,
    	"checkout_url_eur" text DEFAULT '' NOT NULL,
    	"checkout_url_usd" text DEFAULT '' NOT NULL,
    	"cover_image_url" text DEFAULT '' NOT NULL,
    	"print_product_uids" jsonb DEFAULT '{}'::jsonb NOT NULL,
    	"print_file_url" text DEFAULT '' NOT NULL,
    	"print_page_count" integer DEFAULT 0 NOT NULL,
    	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
    	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "store_orders" (
    	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    	"book_id" uuid NOT NULL,
    	"book_title" text NOT NULL,
    	"currency" text NOT NULL,
    	"amount" double precision NOT NULL,
    	"full_name" text NOT NULL,
    	"email" text NOT NULL,
    	"phone" text NOT NULL,
    	"address" text NOT NULL,
    	"city" text NOT NULL,
    	"state" text NOT NULL,
    	"postal_code" text NOT NULL,
    	"country" text NOT NULL,
    	"payment_status" text DEFAULT 'pending' NOT NULL,
    	"paid_at" timestamp with time zone,
    	"print_provider" text DEFAULT '' NOT NULL,
    	"print_status" text DEFAULT 'none' NOT NULL,
    	"print_external_id" text DEFAULT '' NOT NULL,
    	"print_error" text DEFAULT '' NOT NULL,
    	"print_submitted_at" timestamp with time zone,
    	"created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "store_print_providers" (
    	"provider" text PRIMARY KEY NOT NULL,
    	"enabled" boolean DEFAULT false NOT NULL,
    	"auto_submit" boolean DEFAULT true NOT NULL,
    	"order_mode" text DEFAULT 'draft' NOT NULL,
    	"credentials_encrypted" text DEFAULT '' NOT NULL,
    	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "store_settings" (
    	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
    	"store_name" text NOT NULL,
    	"logo_url" text DEFAULT '' NOT NULL,
    	"hero_badge" text NOT NULL,
    	"hero_title" text NOT NULL,
    	"hero_subtitle" text NOT NULL,
    	"hero_quote" text NOT NULL,
    	"contact_email" text DEFAULT '' NOT NULL,
    	"instagram_url" text DEFAULT '' NOT NULL,
    	"facebook_url" text DEFAULT '' NOT NULL,
    	"initial_book_seeded" boolean DEFAULT false NOT NULL,
    	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
}

/**
 * Migración idempotente de las columnas/tablas de impresión bajo demanda.
 * Se ejecuta al arrancar: así desplegar este código no exige correr `db push` a mano.
 * (Todo usa IF NOT EXISTS, es seguro repetirlo.)
 */
export async function ensurePrintSchema(): Promise<void> {
  await ensureBaseTables();
  await db.execute(sql`
    ALTER TABLE store_books
      ADD COLUMN IF NOT EXISTS print_product_uids jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS print_file_url text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS print_page_count integer NOT NULL DEFAULT 0
  `);
  await db.execute(sql`
    ALTER TABLE store_orders
      ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS paid_at timestamptz,
      ADD COLUMN IF NOT EXISTS print_provider text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS print_status text NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS print_external_id text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS print_error text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS print_submitted_at timestamptz
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS store_print_providers (
      provider text PRIMARY KEY,
      enabled boolean NOT NULL DEFAULT false,
      auto_submit boolean NOT NULL DEFAULT true,
      order_mode text NOT NULL DEFAULT 'draft',
      credentials_encrypted text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}
