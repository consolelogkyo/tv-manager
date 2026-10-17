"use client";

import { AlertTriangle, CircleDollarSign, Users, XCircle } from "lucide-react";
import type { StatusFilter } from "@/components/customers/types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Kpis = {
  activeCount: number;
  expiringCount: number;
  expiredCount: number;
  monthlyRevenue: number;
};

type Props = {
  kpis: Kpis;
  activeFilter: StatusFilter;
  onSelect: (filter: StatusFilter) => void;
};

export function KpiCards({ kpis, activeFilter, onSelect }: Props) {
  const items = [
    {
      id: "kpi-active",
      label: "Clientes ativos",
      value: String(kpis.activeCount),
      hint: kpis.expiringCount > 0 ? `inclui ${kpis.expiringCount} vencendo em breve` : "em dia com a assinatura",
      Icon: Users,
      tone: "text-primary",
      glow: "from-primary/25",
      ring: "ring-primary/40",
      filter: "all" as StatusFilter,
    },
    {
      id: "kpi-revenue",
      label: "Receita mensal estimada",
      value: formatCurrency(kpis.monthlyRevenue),
      hint: "soma dos planos ativos",
      Icon: CircleDollarSign,
      tone: "text-success",
      glow: "from-success/20",
      ring: "ring-success/40",
      filter: null,
    },
    {
      id: "kpi-expiring",
      label: "Vencendo em 3 dias",
      value: String(kpis.expiringCount),
      hint: kpis.expiringCount > 0 ? "envie o lembrete no WhatsApp" : "nenhum vencimento próximo",
      Icon: AlertTriangle,
      tone: "text-warning",
      dot: "bg-warning",
      glow: "from-warning/25",
      ring: "ring-warning/50",
      filter: "expiring" as StatusFilter,
      alert: kpis.expiringCount > 0,
    },
    {
      id: "kpi-expired",
      label: "Clientes vencidos",
      value: String(kpis.expiredCount),
      hint: kpis.expiredCount > 0 ? "aguardando renovação" : "nenhum cliente vencido",
      Icon: XCircle,
      tone: "text-destructive",
      dot: "bg-destructive",
      glow: "from-destructive/25",
      ring: "ring-destructive/50",
      filter: "expired" as StatusFilter,
      alert: kpis.expiredCount > 0,
    },
  ];

  return (
    <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {items.map((item, index) => {
        const clickable = item.filter !== null;
        const selected = clickable && item.filter !== "all" && activeFilter === item.filter;
        const Comp = clickable ? "button" : "div";

        return (
          <Comp
            key={item.id}
            id={item.id}
            type={clickable ? "button" : undefined}
            onClick={clickable ? () => onSelect(selected ? "all" : (item.filter as StatusFilter)) : undefined}
            style={{ animationDelay: `${index * 60}ms` }}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-4 text-left shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 animate-fade-up sm:p-5",
              clickable && "cursor-pointer hover:-translate-y-0.5 hover:border-border hover:bg-card/80",
              selected && `ring-2 ${item.ring}`,
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-gradient-to-br to-transparent blur-2xl transition-opacity duration-300 group-hover:opacity-100",
                item.glow,
                item.alert ? "opacity-100" : "opacity-60",
              )}
            />
            <div className="relative flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">{item.label}</span>
              <span
                className={cn(
                  "relative grid size-8 shrink-0 place-items-center rounded-lg bg-background/60 ring-1 ring-border sm:size-9",
                  item.tone,
                )}
              >
                <item.Icon className="size-4 sm:size-[18px]" />
                {item.alert && item.dot && (
                  <span className="absolute -top-1 -right-1 flex size-2.5">
                    <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-70", item.dot)} />
                    <span className={cn("relative inline-flex size-2.5 rounded-full", item.dot)} />
                  </span>
                )}
              </span>
            </div>
            <p className={cn("relative mt-3 font-display text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl", item.alert && item.tone)}>
              {item.value}
            </p>
            <p className="relative mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{item.hint}</p>
          </Comp>
        );
      })}
    </section>
  );
}
