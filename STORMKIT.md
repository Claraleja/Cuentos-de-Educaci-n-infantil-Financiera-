# Publicar la tienda en Stormkit (stormkit.dev)

Stormkit Cloud aloja la tienda como **archivos estáticos** (`.stormkit/public`) y el servidor como
**funciones serverless** (`.stormkit/api`, límite de 15 s por petición). No incluye base de datos
en la nube, así que se necesita un Postgres externo (p. ej. **Neon** o **Supabase**, con plan gratuito
sujeto a sus límites).

El comando `pnpm run build:stormkit` genera ambas carpetas. El servidor crea solo sus tablas
la primera vez que arranca (base de datos vacía incluida).

> **Versiones:** el repositorio fija Node 22 y pnpm 10 (`mise.toml`; Node también en `.node-version`). Sin esto Stormkit
> instala `node@latest`, que puede no arrancar en su servidor de compilación (falta `libatomic.so.1`).

## 1) Base de datos
1. Crea un proyecto Postgres en Neon (o Supabase) y copia la cadena de conexión **con pooler**,
   terminada en `?sslmode=require`.

## 2) Crear la app en Stormkit
1. En Stormkit: **New app** → conecta tu GitHub y elige este repositorio (rama `main`).
2. En **Environments → Config** de tu entorno:
   - **Build command:** `pnpm run build:stormkit`  (Stormkit ya instala las dependencias en un paso previo; NO uses el comando por defecto `pnpm run build`, que compila también un proyecto de pruebas y falla)
   - **Output folder:** `.stormkit/public`  (si no detecta la API, prueba con `.stormkit`)
3. En **Environment variables** añade:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | la cadena de conexión de Neon/Supabase |
| `SESSION_SECRET` | texto largo y aleatorio (30+ caracteres) |
| `DB_POOL_MAX` | `3` |
| `PAYMENT_WEBHOOK_SECRET` | texto largo y aleatorio (confirmación de pagos) |
| `STRIPE_WEBHOOK_SECRET` | solo si usas Stripe |
| `PRINT_ENCRYPTION_KEY` | opcional: otra clave larga para cifrar la API key de Gelato |
| `STORE_URL` | solo si vendes libros digitales: la URL pública de la tienda, sin barra final (p. ej. `https://tu-tienda.stormkit.dev`) |
| `TROPIPAY_CLIENT_ID` | solo si vendes libros digitales con Tropipay: el client_id de tu cuenta Tropipay |
| `TROPIPAY_CLIENT_SECRET` | solo si vendes libros digitales con Tropipay: el client_secret de tu cuenta Tropipay |
| `TROPIPAY_SERVER` | solo si vendes libros digitales con Tropipay: `https://sandbox.tropipay.me` para pruebas, `https://www.tropipay.com` en producción |

4. Pulsa **Deploy now**. Cuando termine, abre la dirección `…stormkit.dev`.

## 2b) Libros digitales con Tropipay (opcional)
Para vender libros digitales con pago automático:
1. Pon las cuatro variables de arriba (`STORE_URL`, `TROPIPAY_CLIENT_ID`, `TROPIPAY_CLIENT_SECRET`, `TROPIPAY_SERVER`). **Empieza con el sandbox** (`https://sandbox.tropipay.me`): ahí pruebas el pago sin dinero real.
2. En `/admin` → Libros, marca el libro como **Libro digital** y pega la **URL del PDF digital** (el archivo que recibe el cliente; nunca se muestra en la tienda).
3. Al comprar, la tienda crea el enlace de pago en Tropipay y el cliente paga allí. Tropipay avisa solo a la tienda (`<STORE_URL>/api/webhooks/tropipay`) y la descarga se libera en `/gracias?pedido=<id>`.
4. Si el aviso no llega, en `/admin` → Pedidos pulsa **Confirmar pago**: el pedido se marca pagado y la descarga se libera a mano.
5. Cuando todo funcione en sandbox, cambia `TROPIPAY_SERVER` a `https://www.tropipay.com` y vuelve a desplegar.
6. Sin estas variables, los libros digitales usan el enlace de pago manual del libro, como los impresos.

## 3) Primer uso
1. Entra a `/admin`, crea la contraseña de administración.
2. **Integraciones** → pega tu `GELATO_API_KEY` → Guardar → *Probar conexión*. Déjalo en **Modo prueba**.
3. En cada cuento impreso: enlace de pago, Gelato Product UID, URL del PDF y páginas. En cada libro digital: enlace de pago (o Tropipay, si está configurado) y URL del PDF digital.

## 4) Tu dominio / enlace corto
Cuando la tienda de Stormkit funcione, cambia el destino de tu enlace
(`s.qzz.io/cuentosfinanzasinfantil`) a la dirección de Stormkit.

## Avisos importantes
- Cada petición dura como máximo 15 s; el envío a Gelato espera hasta ~10 s.
- La primera visita tras un rato sin tráfico tarda un poco más (arranque en frío).
- El límite de intentos de inicio de sesión es por instancia (no global).
- Si al recargar `/admin` ves un 404, crea en Stormkit una regla de *Redirects and Path Rewrites*
  que envíe las rutas que no empiecen por `/api` a `/index.html`.
