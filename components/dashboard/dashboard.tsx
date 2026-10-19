"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Plus, Search, SearchX, Tv, X } from "lucide-react";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerList } from "@/components/customers/customer-list";
import type { EnrichedCustomer, StatusFilter } from "@/components/customers/types";
import { KpiCards, type Kpis } from "@/components/dashboard/kpi-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDaysRemaining, getStatus } from "@/lib/date";
import { onlyDigits } from "@/lib/format";
import type { AppSuggestion, Customer } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: StatusFilter; label: string; dot?: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos", dot: "bg-success" },
  { value: "expiring", label: "Vencendo (3 dias)", dot: "bg-warning" },
  { value: "expired", label: "Vencidos", dot: "bg-destructive" },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function Dashboard({
  customers,
  today,
  appSuggestions = [],
}: {
  customers: Customer[];
  today: string;
  appSuggestions?: AppSuggestion[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const deferredQuery = useDeferredValue(query);

  // Status calculado em tempo de execução (nunca salvo no banco).
  const enriched = useMemo<EnrichedCustomer[]>(
    () =>
      customers.map((c) => ({
        ...c,
        days: getDaysRemaining(c.expires_at, today),
        status: getStatus(c.expires_at, today),
      })),
    [customers, today],
  );

  const kpis = useMemo<Kpis>(() => {
    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let monthlyRevenue = 0;
    for (const c of enriched) {
      if (c.days >= 0) {
        activeCount += 1;
        monthlyRevenue += c.plan_value;
      } else {
        expiredCount += 1;
      }
      if (c.status === "expiring") expiringCount += 1;
    }
    return { activeCount, expiringCount, expiredCount, monthlyRevenue: Math.round(monthlyRevenue * 100) / 100 };
  }, [enriched]);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: enriched.length, active: 0, expiring: 0, expired: 0 };
    for (const c of enriched) result[c.status] += 1;
    return result;
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    const qDigits = onlyDigits(deferredQuery);
    const qHex = deferredQuery.replace(/[^0-9a-fA-F]/g, "").toUpperCase();

    return enriched.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!q) return true;
      if (normalizeText(c.name).includes(q)) return true;
      if (qDigits.length >= 2 && c.phone?.includes(qDigits)) return true;
      if (qHex.length >= 2 && c.mac_address.replace(/:/g, "").includes(qHex)) return true;
      if (c.mac_address.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [enriched, filter, deferredQuery]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <KpiCards kpis={kpis} activeFilter={filter} onSelect={setFilter} />

      <section aria-labelledby="customers-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="customers-title" className="font-display text-xl font-semibold tracking-tight">
              Clientes
            </h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length === enriched.length
                ? `${enriched.length} cadastrado${enriched.length === 1 ? "" : "s"}`
                : `${filtered.length} de ${enriched.length} exibidos`}
            </p>
          </div>
          <Button id="new-customer" onClick={openCreate} className="hidden sm:inline-flex">
            <Plus /> Novo cliente
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="customer-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, telefone ou MAC..."
              aria-label="Buscar clientes"
              className="h-11 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                id="clear-search"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Filtrar por status"
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:rounded-xl lg:border lg:border-border/70 lg:bg-card/60 lg:p-1 lg:pb-1 lg:backdrop-blur"
          >
            {FILTERS.map((f) => {
              const selected = filter === f.value;
              return (
                <button
                  key={f.value}
                  id={`filter-${f.value}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-all cursor-pointer",
                    selected
                      ? "border-primary/50 bg-primary/15 text-foreground shadow-sm shadow-primary/20"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted hover:text-foreground lg:border-transparent lg:bg-transparent",
                  )}
                >
                  {f.dot && <span className={cn("size-2 rounded-full", f.dot)} />}
                  {f.label}
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
                      selected ? "bg-primary/25 text-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[f.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length > 0 ? (
          <CustomerList customers={filtered} onEdit={openEdit} />
        ) : (
          <EmptyState hasCustomers={enriched.length > 0} onCreate={openCreate} onClear={() => { setQuery(""); setFilter("all"); }} />
        )}
      </section>

      {/* Botão flutuante no celular */}
      <Button
        id="new-customer-fab"
        onClick={openCreate}
        size="lg"
        aria-label="Novo cliente"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-full p-0 shadow-2xl shadow-primary/40 sm:hidden"
      >
        <Plus className="size-6" />
      </Button>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        appSuggestions={appSuggestions}
      />
    </div>
  );
}

function EmptyState({
  hasCustomers,
  onCreate,
  onClear,
}: {
  hasCustomers: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center backdrop-blur animate-fade-up">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted/60 ring-1 ring-border">
        {hasCustomers ? <SearchX className="size-6 text-muted-foreground" /> : <Tv className="size-6 text-primary" />}
      </div>
      <h3 className="font-display text-lg font-semibold">
        {hasCustomers ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasCustomers
          ? "Tente outro termo de busca ou altere o filtro de status."
          : "Cadastre o primeiro cliente para começar a acompanhar vencimentos e renovações."}
      </p>
      <div className="mt-5">
        {hasCustomers ? (
          <Button id="empty-clear" variant="outline" onClick={onClear}>
            <X /> Limpar filtros
          </Button>
        ) : (
          <Button id="empty-create" onClick={onCreate}>
            <Plus /> Cadastrar cliente
          </Button>
        )}
      </div>
    </div>
  );
}
