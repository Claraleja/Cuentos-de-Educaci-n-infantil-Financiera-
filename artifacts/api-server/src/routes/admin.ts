import { count, desc, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AdminLoginBody,
  AdminLoginResponse,
  AdminLogoutResponse,
  CreateBookBody,
  CreateBookResponse,
  DeleteBookParams,
  GetAdminBooksResponse,
  GetAdminOrdersResponse,
  GetAdminSessionResponse,
  GetAdminSettingsResponse,
  GetAdminSummaryResponse,
  InitializeAdminBody,
  InitializeAdminResponse,
  UpdateBookBody,
  UpdateBookParams,
  UpdateBookResponse,
  UpdateStoreSettingsBody,
  UpdateStoreSettingsResponse,
} from "@workspace/api-zod";
import {
  adminAuthTable,
  booksTable,
  db,
  ordersTable,
  storeSettingsTable,
} from "@workspace/db";
import {
  allowLoginAttempt,
  clearAdminSession,
  clearLoginAttempts,
  createAdminSession,
  hashPassword,
  isAdminSession,
  passwordMatches,
  requireAdmin,
} from "../lib/admin-auth";
import { DEFAULT_SETTINGS, ensureStoreDefaults } from "../lib/store-data";

const router: IRouter = Router();

function mapBook(book: typeof booksTable.$inferSelect) {
  return {
    ...book,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

function mapOrder(order: typeof ordersTable.$inferSelect) {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
  };
}

function safeHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function validBookUrls(
  data: { checkoutUrlEur: string; checkoutUrlUsd: string; coverImageUrl: string },
): boolean {
  return (
    safeHttpUrl(data.checkoutUrlEur) &&
    safeHttpUrl(data.checkoutUrlUsd) &&
    safeHttpUrl(data.coverImageUrl)
  );
}

function validSettingsUrls(data: {
  logoUrl: string;
  instagramUrl: string;
  facebookUrl: string;
}): boolean {
  return (
    safeHttpUrl(data.logoUrl) &&
    safeHttpUrl(data.instagramUrl) &&
    safeHttpUrl(data.facebookUrl)
  );
}

function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

router.get("/admin/auth/session", async (req, res): Promise<void> => {
  const [admin] = await db
    .select({ id: adminAuthTable.id })
    .from(adminAuthTable)
    .limit(1);
  res.json(
    GetAdminSessionResponse.parse({
      configured: Boolean(admin),
      authenticated: Boolean(admin && isAdminSession(req)),
    }),
  );
});

router.post("/admin/auth/setup", async (req, res): Promise<void> => {
  const parsed = InitializeAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const password = await hashPassword(parsed.data.password);
  const [admin] = await db
    .insert(adminAuthTable)
    .values({
      id: "store-admin",
      passwordSalt: password.salt,
      passwordHash: password.hash,
    })
    .onConflictDoNothing()
    .returning({ id: adminAuthTable.id });

  if (!admin) {
    res.status(409).json({ error: "La administración ya está configurada." });
    return;
  }

  createAdminSession(res);
  res.status(201).json(
    InitializeAdminResponse.parse({ configured: true, authenticated: true }),
  );
});

router.post("/admin/auth/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ip = req.ip || "unknown";
  if (!allowLoginAttempt(ip)) {
    res.status(429).json({
      error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
    });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminAuthTable)
    .where(eq(adminAuthTable.id, "store-admin"))
    .limit(1);

  if (
    !admin ||
    !(await passwordMatches(
      parsed.data.password,
      admin.passwordSalt,
      admin.passwordHash,
    ))
  ) {
    res.status(401).json({ error: "La contraseña no es correcta." });
    return;
  }

  clearLoginAttempts(ip);
  createAdminSession(res);
  res.json(AdminLoginResponse.parse({ configured: true, authenticated: true }));
});

router.post("/admin/auth/logout", (_req, res): void => {
  clearAdminSession(res);
  res.json(AdminLogoutResponse.parse({ configured: true, authenticated: false }));
});

router.get("/admin/summary", requireAdmin, async (_req, res): Promise<void> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [books] = await db.select({ value: count() }).from(booksTable);
  const [orders] = await db.select({ value: count() }).from(ordersTable);
  const [recentOrders] = await db
    .select({ value: count() })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, sevenDaysAgo));

  res.json(
    GetAdminSummaryResponse.parse({
      bookCount: books.value,
      orderCount: orders.value,
      recentOrderCount: recentOrders.value,
    }),
  );
});

router.get("/admin/books", requireAdmin, async (_req, res): Promise<void> => {
  const books = await db.select().from(booksTable).orderBy(desc(booksTable.createdAt));
  res.json(GetAdminBooksResponse.parse(books.map(mapBook)));
});

router.post("/admin/books", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!validBookUrls(parsed.data)) {
    res.status(400).json({ error: "Las URL deben comenzar con http:// o https://." });
    return;
  }

  const [book] = await db.insert(booksTable).values(parsed.data).returning();
  res.status(201).json(CreateBookResponse.parse(mapBook(book)));
});

router.patch("/admin/books/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateBookParams.safeParse(req.params);
  const parsed = UpdateBookBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!validBookUrls(parsed.data)) {
    res.status(400).json({ error: "Las URL deben comenzar con http:// o https://." });
    return;
  }

  const [book] = await db
    .update(booksTable)
    .set(parsed.data)
    .where(eq(booksTable.id, params.data.id))
    .returning();
  if (!book) {
    res.status(404).json({ error: "No encontramos ese libro." });
    return;
  }
  res.json(UpdateBookResponse.parse(mapBook(book)));
});

router.delete("/admin/books/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [book] = await db
    .delete(booksTable)
    .where(eq(booksTable.id, params.data.id))
    .returning({ id: booksTable.id });
  if (!book) {
    res.status(404).json({ error: "No encontramos ese libro." });
    return;
  }
  res.sendStatus(204);
});

router.get("/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  await ensureStoreDefaults();
  const [settings] = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, 1))
    .limit(1);
  if (!settings) {
    res.status(503).json({ error: "La tienda todavía no está inicializada." });
    return;
  }
  res.json(GetAdminSettingsResponse.parse({ ...DEFAULT_SETTINGS, ...settings }));
});

router.put("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateStoreSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!validSettingsUrls(parsed.data)) {
    res.status(400).json({ error: "Las URL deben comenzar con http:// o https://." });
    return;
  }
  if (parsed.data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.data.contactEmail)) {
    res.status(400).json({ error: "Introduce un correo electrónico válido." });
    return;
  }

  await ensureStoreDefaults();
  const [settings] = await db
    .update(storeSettingsTable)
    .set(parsed.data)
    .where(eq(storeSettingsTable.id, 1))
    .returning();
  res.json(
    UpdateStoreSettingsResponse.parse({
      storeName: settings.storeName,
      logoUrl: settings.logoUrl,
      heroBadge: settings.heroBadge,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      heroQuote: settings.heroQuote,
      contactEmail: settings.contactEmail,
      instagramUrl: settings.instagramUrl,
      facebookUrl: settings.facebookUrl,
    }),
  );
});

router.get("/admin/orders", requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt));
  res.json(GetAdminOrdersResponse.parse(orders.map(mapOrder)));
});

router.get("/admin/orders/export.csv", requireAdmin, async (_req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt));
  const headings = [
    "Nombre",
    "Email",
    "Teléfono",
    "Dirección",
    "Ciudad",
    "Estado",
    "Código Postal",
    "País",
    "Libro solicitado",
    "Moneda",
  ];
  const rows = orders.map((order) =>
    [
      order.fullName,
      order.email,
      order.phone,
      order.address,
      order.city,
      order.state,
      order.postalCode,
      order.country,
      order.bookTitle,
      order.currency,
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = [headings.map(csvCell).join(","), ...rows].join("\r\n");
  res
    .status(200)
    .setHeader("Content-Type", "text/csv; charset=utf-8")
    .setHeader("Content-Disposition", 'attachment; filename="pedidos-gelato.csv"')
    .send(`\uFEFF${csv}`);
});

export default router;