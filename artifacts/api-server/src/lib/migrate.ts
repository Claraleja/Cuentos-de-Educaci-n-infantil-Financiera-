import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Migración idempotente de las columnas/tablas de impresión bajo demanda.
 * Se ejecuta al arrancar: así desplegar este código no exige correr `db push` a mano.
 * (Todo usa IF NOT EXISTS, es seguro repetirlo.)
 */
export async function ensurePrintSchema(): Promise<void> {
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
