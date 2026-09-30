import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const booksTable = pgTable("store_books", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  author: text("author").notNull().default(""),
  shortDescription: text("short_description").notNull().default(""),
  description: text("description").notNull().default(""),
  recommendedAge: text("recommended_age").notNull().default(""),
  pages: integer("pages").notNull().default(1),
  priceEur: doublePrecision("price_eur").notNull().default(0),
  priceUsd: doublePrecision("price_usd").notNull().default(0),
  checkoutUrlEur: text("checkout_url_eur").notNull().default(""),
  checkoutUrlUsd: text("checkout_url_usd").notNull().default(""),
  coverImageUrl: text("cover_image_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const storeSettingsTable = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull(),
  logoUrl: text("logo_url").notNull().default(""),
  heroBadge: text("hero_badge").notNull(),
  heroTitle: text("hero_title").notNull(),
  heroSubtitle: text("hero_subtitle").notNull(),
  heroQuote: text("hero_quote").notNull(),
  contactEmail: text("contact_email").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),
  facebookUrl: text("facebook_url").notNull().default(""),
  initialBookSeeded: boolean("initial_book_seeded").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const adminAuthTable = pgTable("store_admin_auth", {
  id: text("id").primaryKey(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const ordersTable = pgTable("store_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull(),
  bookTitle: text("book_title").notNull(),
  currency: text("currency").notNull(),
  amount: doublePrecision("amount").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});