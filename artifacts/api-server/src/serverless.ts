/**
 * Entrada para funciones serverless (Stormkit Cloud → AWS Lambda).
 *
 * Stormkit llama a `default(req, res)` con sus propios objetos de petición/respuesta.
 * Para no depender de sus detalles internos, la petición se reinyecta en la app de
 * Express con `light-my-request` (objetos HTTP estándar) y el resultado se copia a `res`.
 */
import { STATUS_CODES, type IncomingMessage, type ServerResponse } from "node:http";
import inject from "light-my-request";
import app from "./app";
import { logger } from "./lib/logger";
import { ensureCategorySchema, ensureDigitalSchema, ensurePrintSchema } from "./lib/migrate";
import { ensureStoreDefaults } from "./lib/store-data";

let ready: Promise<void> | null = null;

// Se ejecuta una vez por instancia (arranque en frío), no en cada petición.
function init(): Promise<void> {
  ready ??= (async () => {
    await ensurePrintSchema();
    await ensureDigitalSchema();
    await ensureCategorySchema();
    await ensureStoreDefaults();
    // Los libros NO se siembran por código: se añaden desde /admin (la forma
    // propia de la tienda, con su portada y su PDF). La siembra automática
    // tumbó la tienda al desplegar (2026-11-20), así que ya no corre al arrancar.
  })().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
  const preParsed = (req as IncomingMessage & { body?: unknown }).body;
  if (typeof preParsed === "string") return Buffer.from(preParsed);
  if (Buffer.isBuffer(preParsed)) return preParsed;
  if (preParsed && typeof preParsed === "object") return Buffer.from(JSON.stringify(preParsed));
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function send(res: ServerResponse, status: number, headers: Record<string, unknown>, body: Buffer): void {
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || name.toLowerCase() === "content-length") continue;
    res.setHeader(name, value as string | string[]);
  }
  res.writeHead(status, STATUS_CODES[status] ?? "");
  res.end(body);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await init();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    const code = (error as { code?: unknown } | null)?.code;
    logger.error({ err: detail }, "No se pudo iniciar la tienda");
    // DIAGNÓSTICO TEMPORAL (2026-11-20): Stormkit convierte el 500 en su página
    // de error y no deja leer el motivo, así que se devuelve con 200 para poder
    // leer el error real y luego se revierte a 500.
    send(res, 200, { "content-type": "application/json" }, Buffer.from(JSON.stringify({ initError: detail, code: code ?? null })));
    return;
  }

  // Stormkit entrega la ruta completa (/api/...); por si acaso, se garantiza el prefijo.
  let url = req.url ?? "/";
  if (!url.startsWith("/api")) url = `/api${url.startsWith("/") ? "" : "/"}${url}`;

  const headers = Object.fromEntries(
    Object.entries(req.headers ?? {}).filter(([, value]) => value !== undefined),
  ) as Record<string, string | string[]>;
  const forwarded = String(headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();

  const response = await inject(app, {
    method: (req.method ?? "GET") as "GET",
    url,
    headers,
    payload: await readBody(req),
    remoteAddress: forwarded || "127.0.0.1",
  });
  send(res, response.statusCode, response.headers as Record<string, unknown>, response.rawPayload);
}
