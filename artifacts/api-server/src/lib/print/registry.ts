import { gelatoProvider } from "./gelato";
import type { PrintProvider } from "./types";

// Para añadir Printify u otra imprenta: crea su archivo (ver types.ts) y añádela aquí.
const providers: PrintProvider[] = [gelatoProvider];

export function listPrintProviders(): PrintProvider[] {
  return providers;
}

export function getPrintProvider(id: string): PrintProvider | undefined {
  return providers.find((provider) => provider.id === id);
}
