import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.PRINT_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "Define PRINT_ENCRYPTION_KEY (o SESSION_SECRET) para guardar credenciales de imprentas.",
    );
  }
  cachedKey = scryptSync(secret, "store-print-credentials-v1", 32);
  return cachedKey;
}

/** Cifra un objeto JSON con AES-256-GCM. Formato: v1:<iv>:<tag>:<datos> (base64url). */
export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(":");
}

/** Devuelve null si el texto está vacío, es inválido o la clave de cifrado cambió. */
export function decryptJson<T>(payload: string): T | null {
  if (!payload) return null;
  try {
    const [version, iv, tag, data] = payload.split(":");
    if (version !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}
