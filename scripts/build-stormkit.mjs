// Prepara la tienda para Stormkit Cloud:
//   .stormkit/public → la tienda y el panel (archivos estáticos)
//   .stormkit/api    → el servidor, como funciones serverless (una por ruta, todas con el mismo código)
// Uso: pnpm run build:stormkit
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, ".stormkit");
const apiOut = path.join(out, "api");
const { build } = createRequire(path.join(root, "artifacts/api-server/package.json"))("esbuild");

rmSync(out, { recursive: true, force: true });
mkdirSync(apiOut, { recursive: true });

// 1) Frontend
console.log("→ Compilando la tienda (frontend)…");
execFileSync("pnpm", ["--filter", "@workspace/cuentos-financieros", "run", "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: process.env.PORT || "3000", BASE_PATH: "/" },
});
const publicDir = path.join(root, "artifacts/cuentos-financieros/dist/public");
if (!existsSync(publicDir)) throw new Error(`No se generó ${publicDir}`);
cpSync(publicDir, path.join(out, "public"), { recursive: true });

// 2) Servidor: un único paquete (_app.js; el "_" hace que Stormkit no lo trate como ruta)
console.log("→ Empaquetando el servidor (API)…");
await build({
  entryPoints: [path.join(root, "artifacts/api-server/src/serverless.ts")],
  outfile: path.join(apiOut, "_app.js"),
  platform: "node",
  target: "node20",
  format: "cjs",
  bundle: true,
  logLevel: "warning",
  external: ["pg-native", "*.node"],
  banner: { js: 'process.env.NODE_ENV = process.env.NODE_ENV || "production";' },
});

// 3) Rutas: se leen de openapi.yaml (+ los webhooks), sin mantener otra lista a mano.
const spec = readFileSync(path.join(root, "lib/api-spec/openapi.yaml"), "utf8");
const pathsBlock = spec.slice(spec.indexOf("\npaths:"), spec.indexOf("\ncomponents:"));
const routes = new Set(["/", "/webhooks/stripe", "/webhooks/payment-confirmed"]);
for (const match of pathsBlock.matchAll(/^ {2}(\/\S*):\s*$/gm)) routes.add(match[1]);

for (const route of routes) {
  const segments = route.split("/").filter(Boolean).map((s) => s.replace(/^\{(.+)\}$/, "[$1]"));
  const dir = path.join(apiOut, ...segments);
  mkdirSync(dir, { recursive: true });
  const rel = path.relative(dir, path.join(apiOut, "_app.js")).split(path.sep).join("/");
  // Sin sufijo de método (index.js) → responde a GET, POST, PUT, DELETE…
  writeFileSync(path.join(dir, "index.js"), `module.exports = require(${JSON.stringify(rel)});\n`);
}
console.log(`✔ Listo: ${routes.size} rutas de API + frontend en .stormkit/`);
