"use client";

import { useDeferredValue, useMemo, useOptimistic, useState, useTransition } from "react";
import { AppWindow, Layers, Plus, Search, SearchX, Star, Tv, X } from "lucide-react";
import { toast } from "sonner";
import { changePriorityTvApp, toggleFavoriteTvApp } from "@/app/actions/tv-apps";
import { PRIORITY_DOT } from "@/components/tv-apps/badges";
import { TvAppCard } from "@/components/tv-apps/tv-app-card";
import { TvAppFormDialog } from "@/components/tv-apps/tv-app-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collectBrands, compareTvApps, normalizeText, PRESET_TV_BRANDS, PRIORITY_META, shortBrandLabel } from "@/lib/tv-apps";
import type { PriorityDirection, TvApp, TvAppPriority } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";

type OptimisticAction =
  | { type: "favorite"; id: string; value: boolean }
  | { type: "priority"; id: string; priority: TvAppPriority };

function applyOptimistic(state: TvApp[], action: OptimisticAction): TvApp[] {
  return state.map((app) => {
    if (app.id !== action.id) return app;
    if (action.type === "favorite") return { ...app, is_favorite: action.value };
    return { ...app, priority: action.priority };
  });
}

export function TvAppsCatalog({ apps }: { apps: TvApp[] }) {
  const [optimisticApps, addOptimistic] = useOptimistic(apps, applyOptimistic);
  const [, startTransition] = useTransition();

  const [brandFilter, setBrandFilter] = useState<string>(ALL);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TvApp | null>(null);
  const [formBrand, setFormBrand] = useState<string>(PRESET_TV_BRANDS[0]);

  const brands = useMemo(() => collectBrands(optimisticApps), [optimisticApps]);
  const appNames = useMemo(
    () => [...new Set(optimisticApps.map((a) => a.app_name))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [optimisticApps],
  );

  const stats = useMemo(() => {
    const brandSet = new Set(optimisticApps.map((a) => a.tv_brand));
    return {
      total: optimisticApps.length,
      favorites: optimisticApps.filter((a) => a.is_favorite).length,
      brands: brandSet.size,
      firstChoice: optimisticApps.filter((a) => a.priority === 1).length,
    };
  }, [optimisticApps]);

  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of optimisticApps) counts.set(app.tv_brand, (counts.get(app.tv_brand) ?? 0) + 1);
    return counts;
  }, [optimisticApps]);

  const groups = useMemo(() => {
    const q = normalizeText(deferredQuery);
    const filtered = optimisticApps.filter((app) => {
      if (brandFilter !== ALL && app.tv_brand !== brandFilter) return false;
      if (favoritesOnly && !app.is_favorite) return false;
      if (!q) return true;
      return normalizeText(app.app_name).includes(q) || normalizeText(app.license_info ?? "").includes(q);
    });

    const byBrand = new Map<string, TvApp[]>();
    for (const app of filtered) {
      const list = byBrand.get(app.tv_brand) ?? [];
      list.push(app);
      byBrand.set(app.tv_brand, list);
    }
    return brands
      .filter((b) => byBrand.has(b))
      .map((brand) => ({ brand, apps: (byBrand.get(brand) ?? []).sort(compareTvApps) }));
  }, [optimisticApps, brands, brandFilter, favoritesOnly, deferredQuery]);

  const visibleCount = groups.reduce((sum, g) => sum + g.apps.length, 0);
  const hasFilters = brandFilter !== ALL || favoritesOnly || query.trim() !== "";

  /* ----------------------------------------------------------- handlers --- */

  function openCreate(brand?: string) {
    setEditing(null);
    setFormBrand(brand ?? (brandFilter !== ALL ? brandFilter : PRESET_TV_BRANDS[0]));
    setFormOpen(true);
  }

  function openEdit(app: TvApp) {
    setEditing(app);
    setFormBrand(app.tv_brand);
    setFormOpen(true);
  }

  function handleToggleFavorite(app: TvApp) {
    const value = !app.is_favorite;
    startTransition(async () => {
      addOptimistic({ type: "favorite", id: app.id, value });
      const result = await toggleFavoriteTvApp(app.id, value);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function handleMove(app: TvApp, direction: PriorityDirection) {
    const next = direction === "up" ? app.priority - 1 : app.priority + 1;
    if (next < 1 || next > 3) return;
    startTransition(async () => {
      addOptimistic({ type: "priority", id: app.id, priority: next as TvAppPriority });
      const result = await changePriorityTvApp(app.id, direction);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function clearFilters() {
    setBrandFilter(ALL);
    setFavoritesOnly(false);
    setQuery("");
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={AppWindow} label="Apps no catálogo" value={stats.total} tone="primary" />
        <StatCard icon={Star} label="Favoritos" value={stats.favorites} tone="warning" />
        <StatCard icon={Tv} label="Marcas com apps" value={stats.brands} tone="violet" />
        <StatCard icon={Layers} label="1ª opção" value={stats.firstChoice} tone="success" />
      </div>

      <section aria-labelledby="tv-apps-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="tv-apps-title" className="font-display text-xl font-semibold tracking-tight">
              Fila de apps por TV
            </h2>
            <p className="text-sm text-muted-foreground">
              {hasFilters ? `${visibleCount} de ${stats.total} exibidos` : "Favoritos primeiro, depois da 1ª opção ao fim da fila."}
            </p>
          </div>
          <Button id="new-tv-app" onClick={() => openCreate()} className="hidden sm:inline-flex">
            <Plus /> Adicionar app
          </Button>
        </div>

        {/* Chips de marca */}
        <div
          role="tablist"
          aria-label="Filtrar por marca/sistema de TV"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <BrandChip
            id="brand-filter-all"
            label="Todas"
            count={stats.total}
            selected={brandFilter === ALL}
            onClick={() => setBrandFilter(ALL)}
          />
          {brands.map((brand, i) => (
            <BrandChip
              key={brand}
              id={`brand-filter-${i}`}
              label={shortBrandLabel(brand)}
              title={brand}
              count={brandCounts.get(brand) ?? 0}
              selected={brandFilter === brand}
              onClick={() => setBrandFilter(brand)}
            />
          ))}
        </div>

        {/* Busca + favoritos */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tv-app-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar app pelo nome..."
              aria-label="Buscar apps"
              className="h-11 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                id="tv-app-clear-search"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            id="tv-app-favorites-only"
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((v) => !v)}
            className={cn(
              "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all active:scale-[0.97]",
              favoritesOnly
                ? "border-warning/50 bg-warning/15 text-warning shadow-sm shadow-warning/20"
                : "border-border/70 bg-card/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Star className={cn("size-4", favoritesOnly && "fill-current")} />
            Apenas favoritos
          </button>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {([1, 2, 3] as const).map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", PRIORITY_DOT[p])} />
              {PRIORITY_META[p].label} · {PRIORITY_META[p].hint}
            </span>
          ))}
        </div>

        {groups.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.map((group, gi) => (
              <BrandSection
                key={group.brand}
                index={gi}
                brand={group.brand}
                apps={group.apps}
                onAdd={() => openCreate(group.brand)}
                onToggleFavorite={handleToggleFavorite}
                onMove={handleMove}
                onEdit={openEdit}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            hasApps={stats.total > 0}
            hasFilters={hasFilters}
            brand={brandFilter !== ALL ? brandFilter : null}
            onCreate={() => openCreate()}
            onClear={clearFilters}
          />
        )}
      </section>

      <Button
        id="new-tv-app-fab"
        onClick={() => openCreate()}
        size="lg"
        aria-label="Adicionar app"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-full p-0 shadow-2xl shadow-primary/40 sm:hidden"
      >
        <Plus className="size-6" />
      </Button>

      <TvAppFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        app={editing}
        brands={brands}
        defaultBrand={formBrand}
        appNames={appNames}
      />
    </div>
  );
}

/* ------------------------------------------------------------ pieces --- */

function BrandSection({
  brand,
  apps,
  index,
  onAdd,
  onToggleFavorite,
  onMove,
  onEdit,
}: {
  brand: string;
  apps: TvApp[];
  index: number;
  onAdd: () => void;
  onToggleFavorite: (app: TvApp) => void;
  onMove: (app: TvApp, direction: PriorityDirection) => void;
  onEdit: (app: TvApp) => void;
}) {
  const favorites = apps.filter((a) => a.is_favorite).length;
  return (
    <section
      aria-label={brand}
      className="flex flex-col rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xl shadow-black/10 backdrop-blur-xl animate-fade-up sm:p-5"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-accent-violet/20 ring-1 ring-primary/30">
            <Tv className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold leading-tight">{brand}</h3>
            <p className="text-xs text-muted-foreground">
              {apps.length} app{apps.length === 1 ? "" : "s"}
              {favorites > 0 && (
                <>
                  {" · "}
                  <span className="text-warning">
                    {favorites} favorito{favorites === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className="shrink-0 text-muted-foreground hover:text-primary"
          aria-label={`Adicionar app em ${brand}`}
        >
          <Plus /> <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </header>

      <ol className="space-y-2.5">
        {apps.map((app, i) => (
          <TvAppCard
            key={app.id}
            app={app}
            position={i + 1}
            onToggleFavorite={onToggleFavorite}
            onMove={onMove}
            onEdit={onEdit}
          />
        ))}
      </ol>
    </section>
  );
}

function BrandChip({
  id,
  label,
  title,
  count,
  selected,
  onClick,
}: {
  id: string;
  label: string;
  title?: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={selected}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-all active:scale-[0.97]",
        selected
          ? "border-primary/50 bg-gradient-to-r from-primary/25 to-accent-violet/20 text-foreground shadow-sm shadow-primary/25"
          : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
          selected ? "bg-primary/30 text-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

const STAT_TONES = {
  primary: "from-primary/25 to-primary/5 text-primary ring-primary/30",
  warning: "from-warning/25 to-warning/5 text-warning ring-warning/30",
  violet: "from-accent-violet/25 to-accent-violet/5 text-accent-violet ring-accent-violet/30",
  success: "from-success/25 to-success/5 text-success ring-success/30",
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-xl animate-fade-up sm:p-4">
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1", STAT_TONES[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold tabular-nums leading-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({
  hasApps,
  hasFilters,
  brand,
  onCreate,
  onClear,
}: {
  hasApps: boolean;
  hasFilters: boolean;
  brand: string | null;
  onCreate: () => void;
  onClear: () => void;
}) {
  const filtered = hasApps && hasFilters;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center backdrop-blur animate-fade-up">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60 ring-1 ring-border">
        {filtered ? <SearchX className="size-6 text-muted-foreground" /> : <AppWindow className="size-6 text-primary" />}
      </div>
      <h3 className="font-display text-lg font-semibold">
        {filtered ? "Nenhum app encontrado" : brand ? `Nenhum app para ${shortBrandLabel(brand)}` : "Catálogo vazio"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {filtered
          ? "Tente outro termo, desative o filtro de favoritos ou escolha outra marca."
          : "Cadastre os apps que funcionam em cada TV e defina a ordem de prioridade."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasFilters && (
          <Button id="tv-app-empty-clear" variant="outline" onClick={onClear}>
            <X /> Limpar filtros
          </Button>
        )}
        <Button id="tv-app-empty-create" onClick={onCreate}>
          <Plus /> Adicionar app
        </Button>
      </div>
    </div>
  );
}
