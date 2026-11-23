"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Plus, Search, SearchX, Tv, X } from "lucide-react";
import { CustomerDetailsDialog } from "@/components/customers/customer-details-dialog";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerList } from "@/components/customers/customer-list";
import type { EnrichedCustomer, StatusFilter } from "@/components/customers/types";
import { KpiCards, type Kpis } from "@/components/dashboard/kpi-cards";
import { getFifoBatchForPanel } from "@/components/finance/credit-source-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignalDot, type SignalTone } from "@/components/ui/signal-dot";
import { getKpiContribution, round2 } from "@/lib/business";
import { getDaysRemaining, getStatus } from "@/lib/date";
import { onlyDigits } from "@/lib/format";
import type { AppSuggestion, Customer, PanelCreditBatch, PanelOption, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: StatusFilter; label: string; dot?: SignalTone }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Ativos", dot: "active" },
  { value: "expiring", label: "Vencendo (3 dias)", dot: "expiring" },
  { value: "expired", label: "Vencidos", dot: "expired" },
  { value: "canceled", label: "Cancelados", dot: "canceled" },
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
  userRole,
  panels = [],
  batches = [],
}: {
  customers: Customer[];
  today: string;
  appSuggestions?: AppSuggestion[];
  userRole: UserRole;
  /** Painéis cadastrados (somente admin; lista vazia para o revendedor). */
  panels?: PanelOption[];
  /** Lotes de crédito cadastrados (somente admin; lista vazia para o revendedor). */
  batches?: PanelCreditBatch[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  // Status calculado em tempo de execução (nunca salvo no banco).
  const enriched = useMemo<EnrichedCustomer[]>(() => {
    const panelById = new Map(panels.map((p) => [p.id, p]));
    return customers.map((c): EnrichedCustomer => {
      const expiryStatus = getStatus(c.expires_at, today);
      return {
        ...c,
        days: getDaysRemaining(c.expires_at, today),
        expiryStatus,
        status: c.canceled_at ? "canceled" : expiryStatus,
        panel: c.panel_id ? (panelById.get(c.panel_id) ?? null) : null,
        panelBatches: c.panel_id ? batches.filter((b) => b.panel_id === c.panel_id) : [],
      };
    });
  }, [customers, today, panels, batches]);

  // KPI financeiro depende do cargo:
  // - reseller → comissão de R$ 10,00 por cliente ativo;
  // - admin    → saldo líquido + projeção do custo de créditos por painel (usando o próximo lote FIFO ou custo padrão).
  // Clientes cancelados (churn) ficam fora de todos os KPIs.
  const kpis = useMemo<Kpis>(() => {
    let activeCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let monthlyRevenue = 0;
    let creditTotal = 0;
    let withoutPanel = 0;
    const perPanel = new Map<string, { name: string; count: number; total: number }>();

    for (const c of enriched) {
      if (c.status === "canceled") continue;
      const isActive = c.days >= 0;
      if (isActive) {
        activeCount += 1;
        monthlyRevenue += getKpiContribution(c, userRole);
        // Todo acesso ativo consome 1 crédito no painel — projeção usa o lote ativo mais antigo (FIFO) ou o custo padrão.
        if (c.panel) {
          const fifo = getFifoBatchForPanel(c.panelBatches, c.panel.id);
          const projectedCost = fifo ? fifo.unit_cost : c.panel.credit_cost;
          creditTotal += projectedCost;
          const entry = perPanel.get(c.panel.id) ?? { name: c.panel.name, count: 0, total: 0 };
          entry.count += 1;
          entry.total += projectedCost;
          perPanel.set(c.panel.id, entry);
        } else {
          withoutPanel += 1;
        }
      } else {
        expiredCount += 1;
      }
      if (c.status === "expiring") expiringCount += 1;
    }
    return {
      activeCount,
      expiringCount,
      expiredCount,
      monthlyRevenue: round2(monthlyRevenue),
      credits: {
        total: round2(creditTotal),
        breakdown: [...perPanel.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR")),
        withoutPanel,
      },
    };
  }, [enriched, userRole]);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: 0, active: 0, expiring: 0, expired: 0, canceled: 0 };
    for (const c of enriched) {
      result[c.status] += 1;
      if (c.status !== "canceled") result.all += 1;
    }
    return result;
  }, [enriched]);

  const detailsCustomer = useMemo(
    () => (detailsId ? (enriched.find((c) => c.id === detailsId) ?? null) : null),
    [enriched, detailsId],
  );

  const filtered = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    const qDigits = onlyDigits(deferredQuery);
    const qHex = deferredQuery.replace(/[^0-9a-fA-F]/g, "").toUpperCase();

    return enriched.filter((c) => {
      // "Todos" = carteira atual; cancelados só aparecem no filtro próprio.
      if (filter === "all" ? c.status === "canceled" : c.status !== filter) return false;
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
    setDetailsId(null);
    setEditing(customer);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <KpiCards
        kpis={kpis}
        activeFilter={filter}
        onSelect={setFilter}
        userRole={userRole}
      />

      <section aria-labelledby="customers-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="customers-title" className="text-lg font-medium">
              Clientes
            </h2>
            <p className="text-sm text-muted-foreground">
              {filter === "all" && !deferredQuery.trim()
                ? `${counts.all} na carteira${counts.canceled > 0 ? ` · ${counts.canceled} cancelado${counts.canceled === 1 ? "" : "s"}` : ""}`
                : `${filtered.length} de ${enriched.length} exibidos`}
            </p>
          </div>
          <Button id="new-customer" onClick={openCreate} className="hidden sm:inline-flex">
            <Plus /> Novo cliente
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" strokeWidth={1.75} />
            <Input
              id="customer-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, telefone ou MAC"
              aria-label="Buscar clientes"
              className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                id="clear-search"
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 cursor-pointer text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Filtrar por status"
            className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-1"
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
                    "inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-[13px] font-medium transition-colors duration-150",
                    selected
                      ? "border-primary/70 bg-muted text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground lg:border-transparent lg:bg-transparent lg:hover:bg-muted",
                  )}
                >
                  {f.dot && <SignalDot tone={f.dot} />}
                  {f.label}
                  <span className="font-mono text-[11px] text-subtle-foreground tabular-nums">
                    {counts[f.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length > 0 ? (
          <CustomerList customers={filtered} onEdit={openEdit} onOpenDetails={(c) => setDetailsId(c.id)} userRole={userRole} />
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
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 size-14 rounded-full p-0 shadow-lg shadow-black/50 sm:hidden"
      >
        <Plus className="size-6" />
      </Button>

      {/* Ficha do cliente: lida da lista atual, então reflete renovação/cancelamento e fecha se ele for excluído. */}
      <CustomerDetailsDialog
        customer={detailsCustomer}
        onOpenChange={(open) => !open && setDetailsId(null)}
        onEdit={openEdit}
        userRole={userRole}
      />

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        appSuggestions={appSuggestions}
        userRole={userRole}
        panels={panels}
        batches={batches}
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <div className="mb-3 text-subtle-foreground">{hasCustomers ? <SearchX className="size-6 text-subtle-foreground" strokeWidth={1.5} /> : <Tv className="size-6 text-subtle-foreground" strokeWidth={1.5} />}</div>
      <h3 className="text-base font-medium">
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
