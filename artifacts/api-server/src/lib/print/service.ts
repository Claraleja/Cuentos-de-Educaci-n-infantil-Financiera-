import { and, eq, inArray, lt, or } from "drizzle-orm";
import {
  booksTable,
  db,
  ordersTable,
  printProviderConfigsTable,
} from "@workspace/db";
import { logger } from "../logger";
import { decryptJson, encryptJson } from "./crypto";
import { getPrintProvider, listPrintProviders } from "./registry";
import { PrintProviderError, type PrintProvider } from "./types";

type ConfigRow = typeof printProviderConfigsTable.$inferSelect;

export type SubmitStatus =
  | "draft"
  | "submitted"
  | "failed"
  | "skipped"
  | "busy"
  | "unpaid"
  | "not_found";

export interface SubmitOutcome {
  status: SubmitStatus;
  message: string;
}

const STALE_SUBMITTING_MS = 10 * 60 * 1000;

export async function getProviderConfig(providerId: string): Promise<ConfigRow> {
  const [row] = await db
    .select()
    .from(printProviderConfigsTable)
    .where(eq(printProviderConfigsTable.provider, providerId))
    .limit(1);
  return (
    row ?? {
      provider: providerId,
      enabled: false,
      autoSubmit: true,
      orderMode: "draft",
      credentialsEncrypted: "",
      updatedAt: new Date(),
    }
  );
}

/** Credenciales guardadas en el panel; si faltan, variables de entorno (p. ej. GELATO_API_KEY). */
export async function readCredentials(
  provider: PrintProvider,
  config?: ConfigRow,
): Promise<Record<string, string>> {
  const row = config ?? (await getProviderConfig(provider.id));
  const stored = decryptJson<Record<string, string>>(row.credentialsEncrypted) ?? {};
  const result: Record<string, string> = {};
  for (const field of provider.credentialFields) {
    const value = stored[field.key] || (field.envVar ? process.env[field.envVar] : "") || "";
    if (value) result[field.key] = value;
  }
  return result;
}

/** undefined = sin cambios · "" = borrar · texto = guardar. */
export async function saveProviderConfig(
  provider: PrintProvider,
  update: {
    enabled?: boolean;
    autoSubmit?: boolean;
    orderMode?: "draft" | "live";
    credentials?: Record<string, string>;
  },
): Promise<void> {
  const current = await getProviderConfig(provider.id);
  const stored = decryptJson<Record<string, string>>(current.credentialsEncrypted) ?? {};
  const allowed = new Set(provider.credentialFields.map((field) => field.key));
  for (const [key, raw] of Object.entries(update.credentials ?? {})) {
    if (!allowed.has(key)) continue;
    const value = raw.trim();
    if (value) stored[key] = value;
    else delete stored[key];
  }
  const credentialsEncrypted = Object.keys(stored).length ? encryptJson(stored) : "";
  const values = {
    provider: provider.id,
    enabled: update.enabled ?? current.enabled,
    autoSubmit: update.autoSubmit ?? current.autoSubmit,
    orderMode: update.orderMode ?? current.orderMode,
    credentialsEncrypted,
  };
  await db
    .insert(printProviderConfigsTable)
    .values(values)
    .onConflictDoUpdate({ target: printProviderConfigsTable.provider, set: values });
}

async function setPrintState(
  orderId: string,
  patch: Partial<typeof ordersTable.$inferInsert>,
): Promise<void> {
  await db.update(ordersTable).set(patch).where(eq(ordersTable.id, orderId));
}

/** Marca el pedido como pagado. Devuelve true solo la primera vez (idempotente). */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  const [updated] = await db
    .update(ordersTable)
    .set({ paymentStatus: "paid", paidAt: new Date() })
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.paymentStatus, "pending")))
    .returning({ id: ordersTable.id });
  return Boolean(updated);
}

/**
 * Crea el pedido en la imprenta activa. Es seguro llamarlo varias veces: un
 * "claim" atómico en la base de datos impide que dos peticiones simultáneas
 * (p. ej. reintentos del webhook de pago) creen el pedido dos veces.
 */
export async function submitOrderToPrinter(
  orderId: string,
  options: { trigger: "auto" | "manual"; markPaid?: boolean },
): Promise<SubmitOutcome> {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return { status: "not_found", message: "No encontramos ese pedido." };

  if (order.paymentStatus !== "paid") {
    if (!options.markPaid) {
      return { status: "unpaid", message: "El pedido todavía no figura como pagado." };
    }
    await markOrderPaid(orderId);
  }

  // Imprentas activas (en el orden del registro).
  const candidates: Array<{ provider: PrintProvider; config: ConfigRow }> = [];
  for (const provider of listPrintProviders()) {
    const config = await getProviderConfig(provider.id);
    if (!config.enabled) continue;
    if (options.trigger === "auto" && !config.autoSubmit) continue;
    candidates.push({ provider, config });
  }
  if (!candidates.length) {
    return {
      status: "skipped",
      message:
        options.trigger === "auto"
          ? "Envío automático desactivado o ninguna imprenta activa."
          : "No hay ninguna imprenta activa. Actívala en Integraciones.",
    };
  }

  const claimable = options.trigger === "auto" ? ["none"] : ["none", "failed", "skipped", "draft"];
  const staleBefore = new Date(Date.now() - STALE_SUBMITTING_MS);
  const [claimed] = await db
    .update(ordersTable)
    .set({ printStatus: "submitting", printError: "", printSubmittedAt: new Date() })
    .where(
      and(
        eq(ordersTable.id, orderId),
        or(
          inArray(ordersTable.printStatus, claimable),
          and(eq(ordersTable.printStatus, "submitting"), lt(ordersTable.printSubmittedAt, staleBefore)),
        ),
      ),
    )
    .returning();
  if (!claimed) {
    return {
      status: "busy",
      message: "Este pedido ya se envió o se está enviando a la imprenta.",
    };
  }

  try {
    const [book] = await db.select().from(booksTable).where(eq(booksTable.id, order.bookId)).limit(1);
    if (!book) throw new PrintProviderError("El libro de este pedido ya no existe en la tienda.");

    const match = candidates.find(({ provider }) => book.printProductUids?.[provider.id]?.trim());
    if (!match) {
      const names = candidates.map(({ provider }) => provider.productField.label).join(", ");
      const message = `El libro no tiene ${names}; no se envió a imprenta.`;
      await setPrintState(orderId, { printStatus: "skipped", printError: message });
      return { status: "skipped", message };
    }

    const { provider, config } = match;
    const credentials = await readCredentials(provider, config);
    const mode = config.orderMode === "live" ? "live" : "draft";
    const result = await provider.createOrder(credentials, {
      orderId: order.id,
      currency: order.currency === "USD" ? "USD" : "EUR",
      quantity: 1,
      productUid: book.printProductUids[provider.id].trim(),
      fileUrl: book.printFileUrl,
      pageCount: book.printPageCount > 0 ? book.printPageCount : book.pages,
      mode,
      recipient: {
        fullName: order.fullName,
        email: order.email,
        phone: order.phone,
        address: order.address,
        city: order.city,
        state: order.state,
        postalCode: order.postalCode,
        country: order.country,
      },
    });

    const status = mode === "live" ? "submitted" : "draft";
    await setPrintState(orderId, {
      printProvider: provider.id,
      printStatus: status,
      printExternalId: result.externalId,
      printError: "",
      printSubmittedAt: new Date(),
    });
    logger.info({ orderId, provider: provider.id, mode }, "Pedido enviado a la imprenta");
    return {
      status,
      message:
        mode === "live"
          ? `Pedido enviado a ${provider.label}.`
          : `Borrador creado en ${provider.label} (modo prueba: no se imprime ni se cobra).`,
    };
  } catch (error) {
    const message =
      error instanceof PrintProviderError
        ? error.message
        : "Error inesperado al contactar con la imprenta.";
    if (!(error instanceof PrintProviderError)) {
      logger.error({ orderId, err: error instanceof Error ? error.message : "unknown" }, "Fallo al enviar a imprenta");
    }
    await setPrintState(orderId, { printStatus: "failed", printError: message.slice(0, 500) });
    return { status: "failed", message };
  }
}

/** Punto de entrada cuando se confirma un pago: marca pagado y envía en segundo plano. */
export async function handlePaymentConfirmed(orderId: string): Promise<{ firstTime: boolean }> {
  const firstTime = await markOrderPaid(orderId);
  // También se intenta si el pago ya constaba: el claim evita duplicados y permite
  // recuperar pedidos cuyo envío automático no llegó a ejecutarse.
  void submitOrderToPrinter(orderId, { trigger: "auto" }).catch((error: unknown) => {
    logger.error({ orderId, err: error instanceof Error ? error.message : "unknown" }, "Fallo en envío automático");
  });
  return { firstTime };
}

export { getPrintProvider, listPrintProviders };
