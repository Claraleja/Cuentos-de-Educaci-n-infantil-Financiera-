import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { DownloadOrderFileParams } from "@workspace/api-zod";
import { db, booksTable, ordersTable } from "@workspace/db";

const router: IRouter = Router();

function validFileUrl(value: string): string | null {
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

/**
 * Descarga del PDF de un pedido digital pagado.
 * GET /api/descargar/:token → redirige (302) al archivo del cliente.
 * El token solo existe cuando el pedido está pagado; si no, 404 (sin distinguir
 * si el token existe o el pedido sigue pendiente).
 */
router.get("/descargar/:token", async (req, res): Promise<void> => {
  const params = DownloadOrderFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Descarga no disponible." });
    return;
  }
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.downloadToken, params.data.token))
    .limit(1);
  if (!order || order.paymentStatus !== "paid" || !order.isDigital) {
    res.status(404).json({ error: "Descarga no disponible." });
    return;
  }
  const [book] = await db
    .select()
    .from(booksTable)
    .where(eq(booksTable.id, order.bookId))
    .limit(1);
  const fileUrl = book?.digitalFileUrl ? validFileUrl(book.digitalFileUrl) : null;
  if (!book?.isDigital || !fileUrl) {
    res.status(404).json({ error: "Descarga no disponible." });
    return;
  }
  if (!order.downloadedAt) {
    await db
      .update(ordersTable)
      .set({ downloadedAt: new Date() })
      .where(eq(ordersTable.id, order.id));
  }
  res.redirect(302, fileUrl);
});

export default router;
