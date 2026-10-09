import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { db, ordersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { handlePaymentConfirmed } from "../lib/print/service";

const router: IRouter = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function verifyStripeSignature(raw: Buffer, header: string, secret: string): boolean {
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest("hex");
  return signatures.some((signature) => safeEqual(signature, expected));
}

async function confirm(orderId: unknown): Promise<"ok" | "invalid" | "unknown"> {
  if (typeof orderId !== "string" || !UUID.test(orderId)) return "invalid";
  const [order] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order) return "unknown";
  await handlePaymentConfirmed(orderId);
  return "ok";
}

/**
 * Stripe (Payment Links / Checkout): evento checkout.session.completed.
 * Variable de entorno: STRIPE_WEBHOOK_SECRET. El pedido se identifica con
 * client_reference_id, que /checkout añade al enlace de pago de Stripe.
 */
router.post("/webhooks/stripe", async (req: Request, res): Promise<void> => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.header("stripe-signature");
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!secret) {
    res.status(503).json({ error: "STRIPE_WEBHOOK_SECRET no está configurado." });
    return;
  }
  if (!signature || !raw || !verifyStripeSignature(raw, signature, secret)) {
    res.status(400).json({ error: "Firma no válida." });
    return;
  }

  const event = req.body as {
    type?: string;
    data?: { object?: { client_reference_id?: string; payment_status?: string; metadata?: Record<string, string> } };
  };
  const paidEvents = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  const session = event.data?.object;
  if (!event.type || !paidEvents.includes(event.type) || !session) {
    res.json({ received: true, ignored: true });
    return;
  }
  if (session.payment_status && session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    res.json({ received: true, ignored: "pago pendiente" });
    return;
  }

  const result = await confirm(session.client_reference_id ?? session.metadata?.orderId ?? session.metadata?.order_id);
  if (result === "unknown") logger.warn("Webhook de Stripe con un pedido desconocido");
  // Siempre 200 si la firma es válida, para que Stripe no reintente eventos inservibles.
  res.json({ received: true });
});

type Flat = Record<string, unknown>;

function asRecord(value: unknown): Flat {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Flat) : {};
}

function firstString(sources: Flat[], keys: string[]): string {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
  }
  return "";
}

const SUCCESS_STATES = new Set([
  "paid", "completed", "complete", "success", "succeeded", "successful", "ok",
  "approved", "charged", "captured", "confirmed", "settled",
]);

/**
 * Confirmación de pago GENÉRICA: sirve para cualquier proveedor (Tropipay, PayPal,
 * Revolut, Wise, Zapier/Make/n8n leyendo el aviso del banco…).
 *
 *   POST /api/webhooks/payment-confirmed
 *   Secreto (variable PAYMENT_WEBHOOK_SECRET), en una de estas formas:
 *     · cabecera  Authorization: Bearer <secreto>   (o x-webhook-secret)
 *     · parámetro ?secret=<secreto>  (para proveedores que no permiten cabeceras)
 *
 *   Cuerpo JSON — el pedido se identifica por UNO de estos dos caminos:
 *     1) id del pedido:  orderId | order_id | reference | client_reference_id
 *     2) email del cliente + importe:  email|clientEmail|customer_email  +  amount|originalCurrencyAmount|total
 *        (importe en unidades o en céntimos; currency opcional)
 *   Si el cuerpo trae un estado (status/state/payment_status) distinto de pagado, se ignora.
 */
router.post("/webhooks/payment-confirmed", async (req, res): Promise<void> => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ error: "PAYMENT_WEBHOOK_SECRET no está configurado." });
    return;
  }
  const bearer = (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const query = typeof req.query.secret === "string" ? req.query.secret : "";
  const provided = req.header("x-webhook-secret") || bearer || query;
  if (!provided || !safeEqual(provided, secret)) {
    res.status(401).json({ error: "No autorizado." });
    return;
  }

  const body = asRecord(req.body);
  const sources = [body, asRecord(body.data), asRecord(asRecord(body.data).object)];

  const state = firstString(sources, ["status", "state", "payment_status", "paymentStatus"]).toLowerCase();
  if (state && !SUCCESS_STATES.has(state)) {
    logger.info({ state }, "Aviso de pago ignorado: estado no pagado");
    res.json({ received: true, ignored: "estado no pagado" });
    return;
  }

  // 1) Por id de pedido.
  const reference = firstString(sources, ["orderId", "order_id", "reference", "client_reference_id", "externalReference"]);
  if (UUID.test(reference)) {
    const result = await confirm(reference);
    if (result === "unknown") res.status(404).json({ error: "Pedido no encontrado." });
    else res.json({ received: true });
    return;
  }

  // 2) Por email + importe (el enlace de pago no puede llevar nuestra referencia).
  const email = (
    firstString(sources, ["email", "clientEmail", "customer_email", "payerEmail"]) ||
    firstString([asRecord(body.client), asRecord(body.customer)], ["email"])
  ).toLowerCase();
  const rawAmount = firstString(sources, ["amount", "originalCurrencyAmount", "total", "value"]);
  const amount = Number(rawAmount.replace(",", "."));
  if (!email || !rawAmount || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Envía orderId, o bien email + amount del cliente." });
    return;
  }
  const currency = firstString(sources, ["currency", "originalCurrency"]).toUpperCase();

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const pending = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.paymentStatus, "pending"), gte(ordersTable.createdAt, since)));
  const close = (a: number, b: number) => Math.abs(a - b) < 0.005;
  const matches = pending.filter(
    (order) =>
      order.email.trim().toLowerCase() === email &&
      (close(order.amount, amount) || close(order.amount, amount / 100)) &&
      (!currency || order.currency === currency),
  );
  if (matches.length === 0) {
    res.status(404).json({ error: "No hay un pedido pendiente que coincida." });
    return;
  }
  if (matches.length > 1) {
    // Ambiguo: mejor no imprimir nada y que lo confirmes tú desde Pedidos.
    logger.warn({ count: matches.length }, "Aviso de pago ambiguo: varios pedidos coinciden");
    res.status(409).json({ error: "Varios pedidos coinciden; confirma el pedido manualmente." });
    return;
  }
  await handlePaymentConfirmed(matches[0].id);
  res.json({ received: true });
});

export default router;
