/**
 * Contrato común de las imprentas bajo demanda (Gelato, Printify…).
 *
 * Para añadir una imprenta nueva:
 *  1. crea `src/lib/print/<imprenta>.ts` exportando un `PrintProvider`;
 *  2. regístrala en `registry.ts`.
 * El panel de administración (credenciales y campo de producto de cada libro)
 * se genera solo a partir de `credentialFields` y `productField`.
 */

export interface PrintFieldDef {
  key: string;
  label: string;
  help?: string;
  placeholder?: string;
}

export interface PrintCredentialFieldDef extends PrintFieldDef {
  /** Variable de entorno que se usa si no hay valor guardado en el panel. */
  envVar?: string;
}

export interface PrintRecipient {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PrintOrderInput {
  /** Id interno del pedido de la tienda (sirve de referencia en la imprenta). */
  orderId: string;
  currency: "EUR" | "USD";
  quantity: number;
  /** Código del producto en esa imprenta (Gelato: Product UID). */
  productUid: string;
  /** URL pública del PDF listo para imprimir. */
  fileUrl: string;
  pageCount: number;
  /** "draft" no imprime ni cobra; "live" produce de verdad. */
  mode: "draft" | "live";
  recipient: PrintRecipient;
}

export interface PrintOrderResult {
  externalId: string;
  status: string;
}

export interface PrintConnectionResult {
  ok: boolean;
  message: string;
}

export interface PrintProvider {
  id: string;
  label: string;
  docsUrl: string;
  credentialFields: PrintCredentialFieldDef[];
  /** Campo que aparece en el formulario de cada libro. */
  productField: PrintFieldDef;
  createOrder(
    credentials: Record<string, string>,
    input: PrintOrderInput,
  ): Promise<PrintOrderResult>;
  testConnection(
    credentials: Record<string, string>,
  ): Promise<PrintConnectionResult>;
}

/** Error con mensaje apto para mostrarse en el panel de administración. */
export class PrintProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrintProviderError";
  }
}
