import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateCheckoutOrderBody,
  CreateCheckoutOrderResponse,
  GetStoreBooksResponse,
  GetStoreSettingsResponse,
} from "@workspace/api-zod";
import { db, booksTable, ordersTable, storeSettingsTable } from "@workspace/db";
import { ensureStoreDefaults } from "../lib/store-data";

const router: IRouter = Router();

// Catálogo público: se excluyen a propósito los datos de impresión (el PDF completo
// del libro no debe ser descargable por los visitantes).
function mapBook(book: typeof booksTable.$inferSelect) {
  const { printProductUids: _uids, printFileUrl: _file, printPageCount: _pages, ...publicBook } = book;
  return {
    ...publicBook,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

function publicSettings(settings: typeof storeSettingsTable.$inferSelect) {
  const {
    storeName,
    logoUrl,
    heroBadge,
    heroTitle,
    heroSubtitle,
    heroQuote,
    contactEmail,
    instagramUrl,
    facebookUrl,
  } = settings;
  return {
    storeName,
    logoUrl,
    heroBadge,
    heroTitle,
    heroSubtitle,
    heroQuote,
    contactEmail,
    instagramUrl,
    facebookUrl,
  };
}

function validExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

// Enlaces de pago de Stripe: client_reference_id llega de vuelta en el webhook de pago
// y permite saber qué pedido se pagó (activa el envío automático a la imprenta).
function withOrderReference(redirectUrl: string, orderId: string): string {
  const url = new URL(redirectUrl);
  if (url.hostname === "buy.stripe.com" || url.hostname === "checkout.stripe.com") {
    url.searchParams.set("client_reference_id", orderId);
  }
  return url.toString();
}

router.get("/books", async (_req, res): Promise<void> => {
  await ensureStoreDefaults();
  const books = await db.select().from(booksTable).orderBy(booksTable.createdAt);
  res.json(GetStoreBooksResponse.parse(books.map(mapBook)));
});

router.get("/settings", async (_req, res): Promise<void> => {
  await ensureStoreDefaults();
  const [settings] = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, 1))
    .limit(1);
  res.json(GetStoreSettingsResponse.parse(publicSettings(settings)));
});

router.post("/checkout", async (req, res): Promise<void> => {
  const parsed = CreateCheckoutOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { bookId, currency, shipping } = parsed.data;
  const [book] = await db
    .select()
    .from(booksTable)
    .where(eq(booksTable.id, bookId))
    .limit(1);
  if (!book) {
    res.status(404).json({ error: "No encontramos ese libro." });
    return;
  }

  const amount = currency === "EUR" ? book.priceEur : book.priceUsd;
  const configuredUrl =
    currency === "EUR" ? book.checkoutUrlEur : book.checkoutUrlUsd;
  const redirectUrl = configuredUrl ? validExternalUrl(configuredUrl) : null;

  if (!redirectUrl || amount <= 0) {
    res.status(409).json({
      error:
        "Este libro todavía no está listo para el pago en esa moneda. Contacta con la tienda.",
    });
    return;
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      bookId: book.id,
      bookTitle: book.title,
      currency,
      amount,
      ...shipping,
    })
    .returning({ id: ordersTable.id });

  res
    .status(201)
    .json(
      CreateCheckoutOrderResponse.parse({
        orderId: order.id,
        redirectUrl: withOrderReference(redirectUrl, order.id),
      }),
    );
});

export default router;