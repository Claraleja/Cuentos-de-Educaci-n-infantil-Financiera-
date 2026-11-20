import { createHash, timingSafeEqual } from "node:crypto";
import { logger } from "./logger";

/**
 * Tropipay API v3 (docs: doc.tropipay.com).
 *
 * Variables de entorno (las pone la dueña en Stormkit; nunca van en el código):
 *   TROPIPAY_CLIENT_ID, TROPIPAY_CLIENT_SECRET — credenciales de la aplicación.
 *   TROPIPAY_SERVER — base del API, p. ej. https://sandbox.tropipay.me (pruebas)
 *     o https://www.tropipay.com (producción). Se admite con o sin `/api/v3`.
 *   STORE_URL — dirección pública de la tienda, p. ej. https://tienda.stormkit.dev.
 *
 * Flujo automático:
 *   1) La tienda obtiene un token: POST {server}/access/token
 *      { grant_type: "client_credentials", client_id, client_secret }.
 *   2) Crea el enlace de pago: POST {server}/paymentcards con
 *      reference = nº de pedido, urlNotification = <STORE_URL>/api/webhooks/tropipay.
 *   3) Tropipay avisa a urlNotification con { status: "OK" | "KO", data } y lo
 *      firma: signatureV3 = sha256(bankOrderCode + clientId + sha1(clientSecret)
 *      + originalCurrencyAmount). La tienda verifica la firma antes de confirmar.
 */

const TOKEN_TIMEOUT_MS = 8000;
const CARD_TIMEOUT_MS = 8000;

export interface TropipayConfig {
  clientId: string;
  clientSecret: string;
  server: string;
}

export function tropipayConfig(): TropipayConfig | null {
  const clientId = (process.env.TROPIPAY_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.TROPIPAY_CLIENT_SECRET ?? "").trim();
  const server = (process.env.TROPIPAY_SERVER ?? "").trim();
  if (!clientId || !clientSecret || !server) return null;
  return { clientId, clientSecret, server };
}

export function tropipayConfigured(): boolean {
  return tropipayConfig() !== null;
}

/** Base del API: quita barras finales y un `/api/v3` final si lo trae. */
export function tropipayApiBase(server: string): string {
  const base = server.trim().replace(/\/+$/, "").replace(/\/api\/v3$/i, "");
  return `${base}/api/v3`;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }
  return { status: response.status, json };
}

async function getAccessToken(config: TropipayConfig): Promise<string> {
  const { status, json } = await postJson(
    `${tropipayApiBase(config.server)}/access/token`,
    {
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    },
    {},
    TOKEN_TIMEOUT_MS,
  );
  const token = typeof json.access_token === "string" ? json.access_token : "";
  if (status < 200 || status >= 300 || !token) {
    throw new Error(`Tropipay no dio un token de acceso (HTTP ${status}).`);
  }
  return token;
}

export interface PaymentCardInput {
  orderId: string;
  bookTitle: string;
  amountCents: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  storeUrl: string;
}

/**
 * Crea un enlace de pago en Tropipay para un pedido. Devuelve la URL corta
 * (shortUrl) que se le muestra al cliente. Lanza un error si Tropipay no lo
 * crea; el llamador decide si usar el enlace manual como respaldo.
 */
export async function createPaymentCard(
  config: TropipayConfig,
  input: PaymentCardInput,
): Promise<string> {
  const token = await getAccessToken(config);
  const storeUrl = input.storeUrl.replace(/\/+$/, "");
  const { status, json } = await postJson(
    `${tropipayApiBase(config.server)}/paymentcards`,
    {
      reference: input.orderId,
      concept: input.bookTitle.slice(0, 100),
      description: `Libro digital: ${input.bookTitle}`.slice(0, 200),
      amount: input.amountCents,
      currency: input.currency,
      singleUse: true,
      lang: "es",
      urlSuccess: `${storeUrl}/gracias?pedido=${input.orderId}`,
      urlFailed: `${storeUrl}/gracias?pedido=${input.orderId}&pago=fallido`,
      urlNotification: `${storeUrl}/api/webhooks/tropipay`,
      client: null,
    },
    { Authorization: `Bearer ${token}` },
    CARD_TIMEOUT_MS,
  );
  const shortUrl =
    typeof json.shortUrl === "string" && json.shortUrl
      ? json.shortUrl
      : typeof json.paymentUrl === "string" && json.paymentUrl
        ? json.paymentUrl
        : "";
  if (status < 200 || status >= 300 || !shortUrl) {
    // Nunca se registran secretos ni el token: solo el estado HTTP.
    logger.warn({ status }, "Tropipay no creó el enlace de pago");
    throw new Error(`Tropipay no creó el enlace de pago (HTTP ${status}).`);
  }
  return shortUrl;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a.trim().toLowerCase(), "utf8");
  const right = Buffer.from(b.trim().toLowerCase(), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Verifica la firma de un aviso de Tropipay a `urlNotification`.
 * signatureV3 = sha256(bankOrderCode + clientId + sha1(clientSecret)
 * + originalCurrencyAmount). Acepta el cuerpo entero ({ status, data }) o solo
 * `data`, y la firma como `signaturev3` o `signatureV3`.
 */
export function verifyPaymentNotification(
  payload: unknown,
  config: TropipayConfig,
): boolean {
  if (!payload || typeof payload !== "object") return false;
  const body = payload as Record<string, unknown>;
  const data =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : body;
  const received = data.signaturev3 ?? data.signatureV3;
  if (
    typeof received !== "string" ||
    !received ||
    data.bankOrderCode === undefined ||
    data.originalCurrencyAmount === undefined
  ) {
    return false;
  }
  const secretHash = createHash("sha1").update(config.clientSecret).digest("hex");
  const expected = createHash("sha256")
    .update(
      `${String(data.bankOrderCode)}${config.clientId}${secretHash}${String(data.originalCurrencyAmount)}`,
    )
    .digest("hex");
  return safeEqual(expected, received);
}

/** true cuando el aviso de Tropipay dice que el pedido se pagó ("OK"). */
export function isPaymentSuccessful(payload: unknown): boolean {
  return Boolean(
    payload && typeof payload === "object" && (payload as Record<string, unknown>).status === "OK",
  );
}
