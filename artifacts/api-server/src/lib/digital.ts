import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";

/**
 * Venta digital: claves de descarga y estado público del pedido.
 *
 * El enlace de descarga es `/api/descargar/<token>`; el token es un UUID que solo
 * existe cuando el pedido digital está pagado. La URL del PDF del cliente
 * (digitalFileUrl) nunca se expone: la descarga redirige a ella tras comprobar
 * el token y el pago.
 */

/** Base pública de la tienda (variable STORE_URL). Sin ella, enlaces relativos. */
export function storeBaseUrl(): string {
  return (process.env.STORE_URL ?? "").trim().replace(/\/+$/, "");
}

export function downloadUrlFor(token: string): string {
  const base = storeBaseUrl();
  return base ? `${base}/api/descargar/${token}` : `/api/descargar/${token}`;
}

export interface OrderStatus {
  id: string;
  bookTitle: string;
  paymentStatus: string;
  isDigital: boolean;
  downloadUrl?: string;
}

/**
 * Genera la clave de descarga de un pedido digital pagado. Idempotente: si ya
 * existe, la devuelve. Devuelve null si el pedido no existe, no está pagado o
 * no es digital.
 */
export async function generateDownloadToken(orderId: string): Promise<string | null> {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order || order.paymentStatus !== "paid" || !order.isDigital) return null;
  if (order.downloadToken) return order.downloadToken;
  const token = randomUUID();
  const [updated] = await db
    .update(ordersTable)
    .set({ downloadToken: token })
    .where(eq(ordersTable.id, orderId))
    .returning({ downloadToken: ordersTable.downloadToken });
  return updated?.downloadToken ?? null;
}

/**
 * Estado público de un pedido: solo el estado del pago y, si es un pedido
 * digital pagado, su enlace de descarga. No revela datos personales.
 */
export async function getOrderStatus(orderId: string): Promise<OrderStatus | null> {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order) return null;
  const status: OrderStatus = {
    id: order.id,
    bookTitle: order.bookTitle,
    paymentStatus: order.paymentStatus,
    isDigital: order.isDigital,
  };
  if (order.paymentStatus === "paid" && order.isDigital && order.downloadToken) {
    status.downloadUrl = downloadUrlFor(order.downloadToken);
  }
  return status;
}
