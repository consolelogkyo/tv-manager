"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, ReceiptText, Server, TrendingUp, type LucideIcon } from "lucide-react";
import { EvolutionTab } from "@/components/finance/evolution-tab";
import { ExpensesTab } from "@/components/finance/expenses-tab";
import { MonthSelector } from "@/components/finance/month-selector";
import { OverviewTab } from "@/components/finance/overview-tab";
import { PanelsTab } from "@/components/finance/panels-tab";
import { listDataMonths, summarizeMonth } from "@/lib/finance";
import { getCurrentMonth } from "@/lib/month";
import type { FinanceData, FinanceTab } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { value: FinanceTab; label: string; short: string; Icon: LucideIcon }[] = [
  { value: "overview", label: "Visão Mensal & DRE", short: "DRE", Icon: BarChart3 },
  { value: "evolution", label: "Evolução & Churn", short: "Evolução", Icon: TrendingUp },
  { value: "expenses", label: "Despesas Extras", short: "Despesas", Icon: ReceiptText },
  { value: "panels", label: "Painéis & Créditos", short: "Painéis", Icon: Server },
];

/**
 * Módulo financeiro (somente admin — a página valida o cargo no servidor).
 * Mês e aba ficam na URL (`?month=YYYY-MM&tab=...`) para facilitar o compartilhamento
 * entre os sócios; os recortes por mês são calculados aqui, sem nova ida ao banco.
 */
export function FinanceDashboard({
  data,
  today,
  initialMonth,
  initialTab,
}: {
  data: FinanceData;
  today: string;
  initialMonth: string;
  initialTab: FinanceTab;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [tab, setTab] = useState<FinanceTab>(initialTab);
  const currentMonth = getCurrentMonth(today);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("month", month);
    params.set("tab", tab);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [month, tab]);

  function selectMonth(next: string) {
    setMonth(next);
  }

  const dataMonths = useMemo(() => listDataMonths(data.events, data.expenses), [data.events, data.expenses]);

  const monthEvents = useMemo(() => data.events.filter((e) => e.reference_month === month), [data.events, month]);
  const monthExpenses = useMemo(() => data.expenses.filter((x) => x.reference_month === month), [data.expenses, month]);
  const summary = useMemo(
    () => summarizeMonth(month, monthEvents, monthExpenses, data.panels),
    [month, monthEvents, monthExpenses, data.panels],
  );

  return (
    <div className="space-y-6">
      {/* Barra de controle em superfície sólida: mês de referência + abas */}
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <MonthSelector month={month} dataMonths={dataMonths} currentMonth={currentMonth} onChange={selectMonth} />
        <div
          role="tablist"
          aria-label="Seções do financeiro"
          className="mt-3 flex gap-1.5 overflow-x-auto border-t border-border pt-3 [scrollbar-width:none] sm:grid sm:grid-cols-4"
        >
          {TABS.map(({ value, label, short, Icon }) => {
            const selected = tab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                id={`fin-tab-${value}`}
                aria-selected={selected}
                aria-controls={`fin-panel-${value}`}
                onClick={() => setTab(value)}
                className={cn(
                  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                  selected
                    ? "border-primary/70 bg-muted text-foreground"
                    : "border-transparent bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", selected && "text-primary-ink")} strokeWidth={1.75} aria-hidden="true" />
                <span className="lg:hidden">{short}</span>
                <span className="hidden lg:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`fin-panel-${tab}`} aria-labelledby={`fin-tab-${tab}`}>
        {tab === "overview" && (
          <OverviewTab summary={summary} month={month} monthEvents={monthEvents} data={data} today={today} />
        )}
        {tab === "evolution" && (
          <EvolutionTab
            data={data}
            month={month}
            dataMonths={dataMonths}
            summary={summary}
            today={today}
            onSelectMonth={selectMonth}
          />
        )}
        {tab === "expenses" && <ExpensesTab data={data} month={month} today={today} />}
        {tab === "panels" && (
          <PanelsTab panels={data.panels} batches={data.batches} customers={data.customers} today={today} />
        )}
      </div>
    </div>
  );
}
