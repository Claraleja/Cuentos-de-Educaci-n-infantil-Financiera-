import {
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import type { RequestHandler } from "express";

const ADMIN_ID = "store-admin";
const COOKIE_NAME = "store_admin_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SCRYPT_BYTES = 64;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for administrator sessions.");
  }
  return secret;
}

function derivePasswordHash(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_BYTES, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<{
  salt: string;
  hash: string;
}> {
  const salt = randomBytes(16).toString("hex");
  const hash = await derivePasswordHash(password, salt);
  return { salt, hash: hash.toString("hex") };
}

export async function passwordMatches(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = await derivePasswordHash(password, salt);
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

function makeSessionToken(expiresAt: number): string {
  const nonce = randomBytes(24).toString("hex");
  const payload = `${ADMIN_ID}.${expiresAt}.${nonce}`;
  const signature = createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function hasValidSession(req: Request): boolean {
  const token = req.cookies?.[COOKIE_NAME];
  if (typeof token !== "string") return false;

  const [adminId, expiryRaw, nonce, signature, ...extra] = token.split(".");
  if (adminId !== ADMIN_ID || extra.length > 0 || !expiryRaw || !nonce || !signature) {
    return false;
  }

  const expiresAt = Number(expiryRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;

  let expectedSignature: string;
  try {
    expectedSignature = createHmac("sha256", sessionSecret())
      .update(`${adminId}.${expiryRaw}.${nonce}`)
      .digest("base64url");
  } catch {
    return false;
  }
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isAdminSession(req: Request): boolean {
  return hasValidSession(req);
}

export function createAdminSession(res: Response): void {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  res.cookie(COOKIE_NAME, makeSessionToken(expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: SESSION_DURATION_MS,
  });
}

export function clearAdminSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
  });
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!hasValidSession(req)) {
    res.status(401).json({ error: "Se requiere iniciar sesión como administrador." });
    return;
  }
  next();
};

export function allowLoginAttempt(ip: string): boolean {
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}