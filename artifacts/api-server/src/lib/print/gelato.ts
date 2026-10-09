import { toIsoCountry } from "./countries";
import {
  PrintProviderError,
  type PrintConnectionResult,
  type PrintOrderInput,
  type PrintOrderResult,
  type PrintProvider,
} from "./types";

const ORDER_API = "https://order.gelatoapis.com";
const TIMEOUT_MS = 20_000;
const STATE_REQUIRED = new Set(["US", "CA", "AU"]);

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = (parts[0] ?? "-").slice(0, 25);
  const lastName = (parts.slice(1).join(" ") || "-").slice(0, 25);
  return { firstName, lastName };
}

// Gelato admite 35 caracteres por línea de dirección.
function splitAddress(address: string): { line1: string; line2?: string } {
  const text = address.trim().replace(/\s+/g, " ");
  if (text.length <= 35) return { line1: text };
  let cut = text.lastIndexOf(" ", 35);
  if (cut < 10) cut = 35;
  const line1 = text.slice(0, cut).trim();
  const line2 = text.slice(cut).trim();
  if (line2.length > 35) {
    throw new PrintProviderError(
      "La dirección es demasiado larga para Gelato (máximo 70 caracteres). Edítala y vuelve a intentarlo.",
    );
  }
  return { line1, line2 };
}

async function gelatoFetch(
  path: string,
  apiKey: string,
  init: { method: "POST" | "GET"; body?: unknown },
): Promise<{ status: number; json: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${ORDER_API}${path}`, {
      method: init.method,
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.name : "error";
    throw new PrintProviderError(
      `Gelato no respondió (${reason}). Revisa el panel de Gelato antes de reintentar para no duplicar el pedido.`,
    );
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text.slice(0, 300) };
  }
  return { status: response.status, json };
}

function gelatoMessage(json: unknown): string {
  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return "respuesta inesperada";
}

async function createOrder(
  credentials: Record<string, string>,
  input: PrintOrderInput,
): Promise<PrintOrderResult> {
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) {
    throw new PrintProviderError(
      "Falta la GELATO_API_KEY. Guárdala en Administración → Integraciones.",
    );
  }
  if (!input.productUid) {
    throw new PrintProviderError("El libro no tiene Gelato Product UID.");
  }
  if (!input.fileUrl) {
    throw new PrintProviderError(
      "El libro no tiene la URL del PDF de impresión (portada + interior).",
    );
  }

  const r = input.recipient;
  const country = toIsoCountry(r.country);
  if (!country) {
    throw new PrintProviderError(
      `No se reconoce el país "${r.country}". Corrígelo en el pedido (nombre completo o código de 2 letras, p. ej. ES, IT, US).`,
    );
  }
  if (STATE_REQUIRED.has(country) && !r.state.trim()) {
    throw new PrintProviderError(`Gelato exige el estado/provincia para ${country}.`);
  }
  if (r.city.trim().length > 30) {
    throw new PrintProviderError("La ciudad supera los 30 caracteres que admite Gelato.");
  }

  const { firstName, lastName } = splitName(r.fullName);
  const { line1, line2 } = splitAddress(r.address);

  const body = {
    orderType: input.mode === "live" ? "order" : "draft",
    orderReferenceId: input.orderId,
    customerReferenceId: r.email.trim().toLowerCase().slice(0, 100),
    currency: input.currency,
    items: [
      {
        itemReferenceId: `${input.orderId}-1`,
        productUid: input.productUid,
        ...(input.pageCount > 0 ? { pageCount: input.pageCount } : {}),
        files: [{ type: "default", url: input.fileUrl }],
        quantity: input.quantity,
      },
    ],
    shippingAddress: {
      firstName,
      lastName,
      addressLine1: line1,
      ...(line2 ? { addressLine2: line2 } : {}),
      city: r.city.trim(),
      postCode: r.postalCode.trim().slice(0, 15),
      ...(r.state.trim() ? { state: r.state.trim().slice(0, 35) } : {}),
      country,
      email: r.email.trim(),
      ...(r.phone.trim() ? { phone: r.phone.trim().slice(0, 25) } : {}),
    },
    metadata: [{ key: "store_order_id", value: input.orderId }],
  };

  const { status, json } = await gelatoFetch("/v4/orders", apiKey, {
    method: "POST",
    body,
  });
  if (status < 200 || status >= 300) {
    throw new PrintProviderError(`Gelato rechazó el pedido (${status}): ${gelatoMessage(json)}`);
  }
  const record = (json ?? {}) as Record<string, unknown>;
  const externalId = typeof record.id === "string" ? record.id : "";
  if (!externalId) {
    throw new PrintProviderError(
      "Gelato respondió sin identificador de pedido. Revisa el panel de Gelato antes de reintentar.",
    );
  }
  return {
    externalId,
    status:
      typeof record.fulfillmentStatus === "string" ? record.fulfillmentStatus : "created",
  };
}

async function testConnection(
  credentials: Record<string, string>,
): Promise<PrintConnectionResult> {
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) return { ok: false, message: "Aún no hay una API key guardada." };
  try {
    const { status, json } = await gelatoFetch("/v4/orders:search", apiKey, {
      method: "POST",
      body: { limit: 1, offset: 0 },
    });
    if (status >= 200 && status < 300) return { ok: true, message: "Gelato aceptó la API key." };
    if (status === 401 || status === 403) {
      return { ok: false, message: "Gelato rechazó la API key (no autorizada)." };
    }
    if (status === 429 || status >= 500) {
      return { ok: false, message: `Gelato no pudo responder ahora (${status}). Inténtalo en unos minutos.` };
    }
    return {
      ok: true,
      message: `La API key fue aceptada, aunque la consulta de prueba devolvió ${status}: ${gelatoMessage(json)}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof PrintProviderError ? error.message : "No se pudo contactar con Gelato.",
    };
  }
}

export const gelatoProvider: PrintProvider = {
  id: "gelato",
  label: "Gelato",
  docsUrl: "https://dashboard.gelato.com/docs/",
  credentialFields: [
    {
      key: "apiKey",
      label: "GELATO_API_KEY",
      envVar: "GELATO_API_KEY",
      help: "Gelato → Ajustes → API. Se guarda cifrada y nunca vuelve a mostrarse.",
      placeholder: "Pega aquí tu API key de Gelato",
    },
  ],
  productField: {
    key: "gelato",
    label: "Gelato Product UID",
    help: "Código del libro de tapa dura en Gelato (Product UID).",
    placeholder: "photobooks-hardcover_pf_...",
  },
  createOrder,
  testConnection,
};
