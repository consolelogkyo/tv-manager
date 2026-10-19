import type { AppSuggestion, TvApp, TvAppPriority } from "@/lib/types";

/** Marcas/sistemas sempre disponíveis nos filtros e no formulário. */
export const PRESET_TV_BRANDS = [
  "LG (webOS)",
  "Samsung (Tizen)",
  "Roku TV (AOC / Philco / TCL)",
  "VIDAA (Hisense / Toshiba)",
  "Android TV / Google TV (TCL / Philips)",
  "Linux Antigas (Philco / AOC / Philips Saphi)",
] as const;

const BRAND_SHORT_LABELS: Record<string, string> = {
  "LG (webOS)": "LG (webOS)",
  "Samsung (Tizen)": "Samsung (Tizen)",
  "Roku TV (AOC / Philco / TCL)": "Roku TV",
  "VIDAA (Hisense / Toshiba)": "VIDAA",
  "Android TV / Google TV (TCL / Philips)": "Android / Google TV",
  "Linux Antigas (Philco / AOC / Philips Saphi)": "Linux Antigas",
};

export function shortBrandLabel(brand: string): string {
  return BRAND_SHORT_LABELS[brand] ?? brand;
}

export const LICENSE_PRESETS = ["Gratuito", "Pago (Mensal)", "Pago (Anual)", "Pago (Vitalício)"] as const;

export const PRIORITY_META: Record<TvAppPriority, { label: string; hint: string }> = {
  1: { label: "1ª Opção", hint: "Prioridade alta" },
  2: { label: "2ª Opção", hint: "Reserva" },
  3: { label: "Fim da fila", hint: "Último caso" },
};

export function toPriority(value: unknown): TvAppPriority {
  const n = Number(value);
  return n === 1 || n === 2 || n === 3 ? n : 3;
}

export type LicenseKind = "free" | "paid" | "other";

export function licenseKind(info: string | null | undefined): LicenseKind {
  const v = normalizeText(info ?? "");
  if (!v) return "other";
  if (v.startsWith("gratis") || v.startsWith("gratuito") || v.startsWith("free")) return "free";
  if (v.startsWith("pago") || v.includes("assinatura")) return "paid";
  return "other";
}

/** Ordem oficial da fila: favoritos primeiro, depois prioridade (1 → 3), depois nome. */
export function compareTvApps(a: TvApp, b: TvApp): number {
  if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.app_name.localeCompare(b.app_name, "pt-BR", { sensitivity: "base" });
}

/** Presets primeiro (na ordem definida), depois marcas novas em ordem alfabética. */
export function collectBrands(apps: Pick<TvApp, "tv_brand">[]): string[] {
  const presets: string[] = [...PRESET_TV_BRANDS];
  const extra = new Set<string>();
  for (const app of apps) if (!presets.includes(app.tv_brand)) extra.add(app.tv_brand);
  return [...presets, ...[...extra].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))];
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Deduplica apps pelo nome para sugerir no cadastro de clientes (favoritos primeiro). */
export function buildAppSuggestions(apps: TvApp[]): AppSuggestion[] {
  const map = new Map<string, AppSuggestion>();
  for (const app of apps) {
    const key = normalizeText(app.app_name);
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        name: app.app_name,
        isFavorite: app.is_favorite,
        bestPriority: app.priority,
        brands: [app.tv_brand],
      });
      continue;
    }
    current.isFavorite ||= app.is_favorite;
    current.bestPriority = Math.min(current.bestPriority, app.priority) as TvAppPriority;
    if (!current.brands.includes(app.tv_brand)) current.brands.push(app.tv_brand);
  }
  return [...map.values()].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    if (a.bestPriority !== b.bestPriority) return a.bestPriority - b.bestPriority;
    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  });
}

/* ------------------------------------------------------------- URLs --- */

/** Adiciona https:// quando o usuário digita só o domínio (ex.: "site.com/ativar"). */
export function normalizeUrlInput(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

/**
 * Apenas http(s) — bloqueia esquemas perigosos como `javascript:` e `data:`
 * (XSS via href). Usado tanto na validação quanto na renderização.
 */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}
