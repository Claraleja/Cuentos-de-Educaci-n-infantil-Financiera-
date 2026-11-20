import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateCheckoutOrderBody,
  CreateCheckoutOrderResponse,
  GetOrderStatusParams,
  GetOrderStatusResponse,
  GetStoreBooksResponse,
  GetStoreSettingsResponse,
} from "@workspace/api-zod";
import { db, booksTable, ordersTable, storeSettingsTable } from "@workspace/db";
import { getOrderStatus, storeBaseUrl } from "../lib/digital";
import { logger } from "../lib/logger";
import { ensureStoreDefaults } from "../lib/store-data";
import { createPaymentCard, tropipayConfig } from "../lib/tropipay";

const router: IRouter = Router();

// Catálogo público: se excluyen a propósito los datos de impresión (el PDF completo
// del libro no debe ser descargable por los visitantes) y el PDF digital del cliente.
function mapBook(book: typeof booksTable.$inferSelect) {
  const { printProductUids: _uids, printFileUrl: _file, printPageCount: _pages, digitalFileUrl: _digital, ...publicBook } = book;
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

// Para libros impresos la dirección completa sigue siendo obligatoria (el
// esquema solo exige nombre y correo porque los digitales no la necesitan).
function missingPrintShipping(shipping: {
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string | null {
  if ((shipping.phone ?? "").trim().length < 6) return "El teléfono es obligatorio.";
  if ((shipping.address ?? "").trim().length < 4) return "La dirección es obligatoria.";
  if (
    !(shipping.city ?? "").trim() ||
    !(shipping.state ?? "").trim() ||
    !(shipping.postalCode ?? "").trim() ||
    !(shipping.country ?? "").trim()
  ) {
    return "La dirección completa es obligatoria para el envío.";
  }
  return null;
}

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
  if (amount <= 0) {
    res.status(409).json({
      error:
        "Este libro todavía no está listo para el pago en esa moneda. Contacta con la tienda.",
    });
    return;
  }

  // Libro digital: solo hacen falta nombre y correo. Libro impreso: dirección completa.
  if (!book.isDigital) {
    const missing = missingPrintShipping(shipping);
    if (missing) {
      res.status(400).json({ error: missing });
      return;
    }
  }

  const config = tropipayConfig();
  const storeUrl = storeBaseUrl();
  const useTropipay = book.isDigital && Boolean(config && storeUrl);
  const configuredUrl =
    currency === "EUR" ? book.checkoutUrlEur : book.checkoutUrlUsd;
  const manualUrl = configuredUrl ? validExternalUrl(configuredUrl) : null;
  if (!useTropipay && !manualUrl) {
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
      isDigital: book.isDigital,
      fullName: shipping.fullName,
      email: shipping.email,
      phone: shipping.phone ?? "",
      address: shipping.address ?? "",
      city: shipping.city ?? "",
      state: shipping.state ?? "",
      postalCode: shipping.postalCode ?? "",
      country: shipping.country ?? "",
    })
    .returning({ id: ordersTable.id });

  // Libro digital con Tropipay configurado: la tienda crea el enlace de pago
  // en Tropipay (reference = nº de pedido). Si falla, respaldo al enlace manual.
  let redirectUrl: string | null = null;
  if (useTropipay && config) {
    try {
      redirectUrl = await createPaymentCard(config, {
        orderId: order.id,
        bookTitle: book.title,
        amountCents: Math.round(amount * 100),
        currency,
        customerName: shipping.fullName,
        customerEmail: shipping.email,
        storeUrl,
      });
    } catch (error) {
      logger.warn(
        { orderId: order.id },
        "No se pudo crear el enlace de Tropipay; se usa el enlace manual",
      );
      redirectUrl = null;
    }
  }
  if (!redirectUrl) redirectUrl = manualUrl;
  if (!redirectUrl) {
    res.status(409).json({
      error:
        "El pago automático no está disponible ahora mismo. Contacta con la tienda.",
    });
    return;
  }

  res
    .status(201)
    .json(
      CreateCheckoutOrderResponse.parse({
        orderId: order.id,
        redirectUrl: withOrderReference(redirectUrl, order.id),
      }),
    );
});

// Estado público de un pedido: solo el estado del pago y, si es digital y está
// pagado, su enlace de descarga. El id es un UUID aleatorio; no revela datos.
router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const status = await getOrderStatus(params.data.id);
  if (!status) {
    res.status(404).json({ error: "No encontramos ese pedido." });
    return;
  }
  res.json(GetOrderStatusResponse.parse(status));
});

export default router;