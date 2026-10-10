# Publicar la tienda en Stormkit (stormkit.dev)

Stormkit Cloud aloja la tienda como **archivos estáticos** (`.stormkit/public`) y el servidor como
**funciones serverless** (`.stormkit/api`, límite de 15 s por petición). No incluye base de datos
en la nube, así que se necesita un Postgres externo (p. ej. **Neon** o **Supabase**, con plan gratuito
sujeto a sus límites).

El comando `pnpm run build:stormkit` genera ambas carpetas. El servidor crea solo sus tablas
la primera vez que arranca (base de datos vacía incluida).

## 1) Base de datos
1. Crea un proyecto Postgres en Neon (o Supabase) y copia la cadena de conexión **con pooler**,
   terminada en `?sslmode=require`.

## 2) Crear la app en Stormkit
1. En Stormkit: **New app** → conecta tu GitHub y elige este repositorio (rama `main`).
2. En **Environments → Config** de tu entorno:
   - **Build command:** `npm i -g pnpm@10 && pnpm install --frozen-lockfile --prod=false && pnpm run build:stormkit`
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

4. Pulsa **Deploy now**. Cuando termine, abre la dirección `…stormkit.dev`.

## 3) Primer uso
1. Entra a `/admin`, crea la contraseña de administración.
2. **Integraciones** → pega tu `GELATO_API_KEY` → Guardar → *Probar conexión*. Déjalo en **Modo prueba**.
3. En cada cuento: enlace de pago, Gelato Product UID, URL del PDF y páginas.

## 4) Tu dominio / enlace corto
Cuando la tienda de Stormkit funcione, cambia el destino de tu enlace
(`s.qzz.io/cuentosfinanzasinfantil`) a la dirección de Stormkit.

## Avisos importantes
- Cada petición dura como máximo 15 s; el envío a Gelato espera hasta ~10 s.
- La primera visita tras un rato sin tráfico tarda un poco más (arranque en frío).
- El límite de intentos de inicio de sesión es por instancia (no global).
- Si al recargar `/admin` ves un 404, crea en Stormkit una regla de *Redirects and Path Rewrites*
  que envíe las rutas que no empiecen por `/api` a `/index.html`.
