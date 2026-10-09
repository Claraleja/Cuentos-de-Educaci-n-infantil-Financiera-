import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetPrintProvidersResponse,
  SubmitOrderToPrinterBody,
  SubmitOrderToPrinterParams,
  SubmitOrderToPrinterResponse,
  TestPrintProviderParams,
  TestPrintProviderResponse,
  UpdatePrintProviderBody,
  UpdatePrintProviderParams,
  UpdatePrintProviderResponse,
} from "@workspace/api-zod";
import { db, ordersTable } from "@workspace/db";
import { requireAdmin } from "../lib/admin-auth";
import { getPrintProvider, listPrintProviders } from "../lib/print/registry";
import {
  getProviderConfig,
  readCredentials,
  saveProviderConfig,
  submitOrderToPrinter,
} from "../lib/print/service";
import type { PrintProvider } from "../lib/print/types";
import { mapOrder } from "../lib/map-order";

const router: IRouter = Router();

// Solo se revelan los últimos 4 caracteres; la clave completa nunca sale del servidor.
function keyHint(value: string | undefined): string {
  if (!value) return "";
  return value.length > 8 ? `••••${value.slice(-4)}` : "••••";
}

async function describeProvider(provider: PrintProvider) {
  const config = await getProviderConfig(provider.id);
  const credentials = await readCredentials(provider, config);
  return {
    id: provider.id,
    label: provider.label,
    docsUrl: provider.docsUrl,
    enabled: config.enabled,
    autoSubmit: config.autoSubmit,
    orderMode: config.orderMode === "live" ? ("live" as const) : ("draft" as const),
    credentials: provider.credentialFields.map((field) => ({
      key: field.key,
      label: field.label,
      help: field.help,
      placeholder: field.placeholder,
      configured: Boolean(credentials[field.key]),
      hint: keyHint(credentials[field.key]),
    })),
    productField: provider.productField,
  };
}

router.get("/admin/print-providers", requireAdmin, async (_req, res): Promise<void> => {
  const providers = await Promise.all(listPrintProviders().map(describeProvider));
  res.json(GetPrintProvidersResponse.parse(providers));
});

router.put("/admin/print-providers/:provider", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdatePrintProviderParams.safeParse(req.params);
  const body = UpdatePrintProviderBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Los datos enviados no son válidos." });
    return;
  }
  const provider = getPrintProvider(params.data.provider);
  if (!provider) {
    res.status(404).json({ error: "Esa imprenta no existe." });
    return;
  }
  await saveProviderConfig(provider, body.data);
  res.json(UpdatePrintProviderResponse.parse(await describeProvider(provider)));
});

router.post("/admin/print-providers/:provider/test", requireAdmin, async (req, res): Promise<void> => {
  const params = TestPrintProviderParams.safeParse(req.params);
  const provider = params.success ? getPrintProvider(params.data.provider) : undefined;
  if (!provider) {
    res.status(404).json({ error: "Esa imprenta no existe." });
    return;
  }
  const credentials = await readCredentials(provider);
  res.json(TestPrintProviderResponse.parse(await provider.testConnection(credentials)));
});

router.post("/admin/orders/:id/print", requireAdmin, async (req, res): Promise<void> => {
  const params = SubmitOrderToPrinterParams.safeParse(req.params);
  const body = SubmitOrderToPrinterBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Los datos enviados no son válidos." });
    return;
  }
  const outcome = await submitOrderToPrinter(params.data.id, {
    trigger: "manual",
    markPaid: body.data.markPaid === true,
  });
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id)).limit(1);
  if (!order) {
    res.status(404).json({ error: "No encontramos ese pedido." });
    return;
  }
  res.json(SubmitOrderToPrinterResponse.parse({ ...outcome, order: mapOrder(order) }));
});

export default router;
