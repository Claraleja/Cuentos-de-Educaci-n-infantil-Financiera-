// Convierte "España", "Spain", "Italia", "es"… al código ISO 3166-1 de 2 letras
// que exigen las imprentas. Usa los nombres de región de Intl (sin dependencias).

const LOCALES = ["es", "en", "it", "pt", "fr", "de"];
const NOT_COUNTRIES = new Set(["EU", "UN", "EZ", "XA", "XB", "ZZ", "QO", "AC", "CP", "DG", "EA", "IC", "TA", "XK"]);

const ALIASES: Record<string, string> = {
  uk: "GB",
  "reino unido": "GB",
  "gran bretana": "GB",
  inglaterra: "GB",
  usa: "US",
  eeuu: "US",
  "ee uu": "US",
  "estados unidos de america": "US",
  kosovo: "XK",
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let byName: Map<string, string> | null = null;

function buildIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const locale of LOCALES) {
    let names: Intl.DisplayNames;
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      continue;
    }
    for (const a of letters) {
      for (const b of letters) {
        const code = `${a}${b}`;
        if (NOT_COUNTRIES.has(code)) continue;
        let name: string | undefined;
        try {
          name = names.of(code);
        } catch {
          continue;
        }
        if (!name || name === code) continue;
        const key = normalize(name);
        if (key && !index.has(key)) index.set(key, code);
      }
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) index.set(alias, code);
  return index;
}

export function toIsoCountry(input: string): string | null {
  const text = input.trim();
  if (/^[A-Za-z]{2}$/.test(text)) {
    const code = text.toUpperCase();
    return code === "UK" ? "GB" : code;
  }
  byName ??= buildIndex();
  return byName.get(normalize(text)) ?? null;
}
