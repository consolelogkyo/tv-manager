"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import type { StatusFilter } from "@/components/customers/types";
import { InfoTip } from "@/components/ui/info-tip";
import { SignalDot, type SignalTone } from "@/components/ui/signal-dot";
import { RESELLER_COMMISSION } from "@/lib/business";
import { formatCurrency } from "@/lib/format";
import type { GlossaryKey } from "@/lib/glossary";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CreditsKpi = {
  /** Soma do `credit_cost` do painel de cada cliente ativo (inclui uso interno). */
  total: number;
  breakdown: { name: string; count: number; total: number }[];
  /** Clientes ativos sem painel definido (sem custo calculável). */
  withoutPanel: number;
};

export type Kpis = {
  activeCount: number;
  expiringCount: number;
  expiredCount: number;
  /** admin: saldo líquido · reseller: comissão total. */
  monthlyRevenue: number;
  /** Custo real de créditos por painel (exibido só para admin). */
  credits: CreditsKpi;
};

type Props = {
  kpis: Kpis;
  activeFilter: StatusFilter;
  onSelect: (filter: StatusFilter) => void;
  userRole: UserRole;
};

type KpiItem = {
  id: string;
  label: string;
  value: string;
  hint: string;
  term: GlossaryKey;
  filter: StatusFilter | null;
  dot?: SignalTone;
  pulse?: boolean;
  valueTone?: string;
  hintTone?: string;
  action?: ReactNode;
  className?: string;
};

/** "8x Painel A + 4x Painel B" */
function describeCredits(credits: CreditsKpi): string {
  const parts = credits.breakdown.map((p) => `${p.count}× ${p.name}`);
  return parts.length > 0 ? parts.join(" + ") : "Nenhum crédito em uso";
}

export function KpiCards({ kpis, activeFilter, onSelect, userRole }: Props) {
  const isAdmin = userRole === "admin";
  const negativeBalance = kpis.monthlyRevenue < 0;

  const items: KpiItem[] = [
    {
      id: "kpi-active",
      label: "Clientes ativos",
      value: String(kpis.activeCount),
      hint: kpis.expiringCount > 0 ? `Inclui ${kpis.expiringCount} vencendo em breve` : "Em dia com a assinatura",
      term: "activeCustomers",
      dot: "active",
      filter: "all",
    },
    {
      id: "kpi-expiring",
      label: "Vencendo em 3 dias",
      value: String(kpis.expiringCount),
      hint: kpis.expiringCount > 0 ? "Envie o lembrete no WhatsApp" : "Nenhum vencimento próximo",
      term: "expiring",
      dot: "expiring",
      pulse: kpis.expiringCount > 0,
      filter: "expiring",
      valueTone: kpis.expiringCount > 0 ? "text-warning" : undefined,
    },
    {
      id: "kpi-expired",
      label: "Clientes vencidos",
      value: String(kpis.expiredCount),
      hint: kpis.expiredCount > 0 ? "Aguardando renovação" : "Nenhum cliente vencido",
      term: "expired",
      dot: "expired",
      filter: "expired",
      valueTone: kpis.expiredCount > 0 ? "text-destructive" : undefined,
    },
    isAdmin
      ? {
          id: "kpi-revenue",
          label: "Receita / saldo líquido",
          value: formatCurrency(kpis.monthlyRevenue),
          hint: "Carteira ativa, já sem comissões",
          term: "houseBalance",
          filter: null,
          valueTone: negativeBalance ? "text-destructive" : undefined,
        }
      : {
          id: "kpi-commission",
          label: "Sua comissão total",
          value: formatCurrency(kpis.monthlyRevenue),
          hint: `${formatCurrency(RESELLER_COMMISSION)} por cliente ativo`,
          term: "resellerCommission",
          filter: null,
        },
  ];

  if (isAdmin) {
    const { credits } = kpis;
    items.push({
      id: "kpi-credits",
      label: "Custo de créditos",
      value: formatCurrency(credits.total),
      hint: credits.withoutPanel > 0 ? `${describeCredits(credits)} · ${credits.withoutPanel} sem painel` : describeCredits(credits),
      hintTone: credits.withoutPanel > 0 ? "text-warning" : undefined,
      term: "creditsCost",
      filter: null,
      action: (
        <Link
          id="kpi-credits-panels"
          href="/finance?tab=panels"
          title="Gerenciar painéis e custos de crédito"
          aria-label="Gerenciar painéis e custos de crédito"
          className="relative z-10 grid size-5 place-items-center rounded-full text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Settings2 className="size-3.5" strokeWidth={1.75} />
        </Link>
      ),
    });
  }

  return (
    <section
      aria-label="Resumo"
      className={cn(
        "grid grid-cols-2 gap-3",
        // Admin (5 cards): 3 de status + 2 financeiros, mais largos. Revendedor: 4 colunas.
        isAdmin ? "md:grid-cols-6" : "lg:grid-cols-4",
      )}
    >
      {items.map((item, index) => {
        const clickable = item.filter !== null;
        const selected = clickable && item.filter !== "all" && activeFilter === item.filter;
        const layout = isAdmin
          ? index === 0
            ? "col-span-2 md:col-span-2"
            : index < 3
              ? "md:col-span-2"
              : "col-span-2 sm:col-span-1 md:col-span-3"
          : undefined;

        return (
          <div
            key={item.id}
            id={item.id}
            className={cn(
              "relative rounded-xl border bg-card px-4 py-3.5 transition-colors duration-150 sm:px-5 sm:py-4",
              selected ? "border-primary/70" : "border-border",
              clickable && !selected && "hover:border-primary/50",
              layout,
            )}
          >
            {clickable && (
              <button
                type="button"
                id={`${item.id}-filter`}
                onClick={() => onSelect(selected ? "all" : (item.filter as StatusFilter))}
                aria-pressed={selected}
                aria-label={`${item.label}: ${item.value}. Filtrar lista`}
                className="absolute inset-0 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            )}
            <div className="pointer-events-none relative flex items-center gap-2">
              {item.dot && <SignalDot tone={item.dot} pulse={item.pulse} />}
              <span className="text-[13px] text-muted-foreground">{item.label}</span>
              <span className="pointer-events-auto ml-auto flex items-center gap-0.5">
                {item.action}
                <InfoTip term={item.term} align="end" />
              </span>
            </div>
            <p className={cn("pointer-events-none relative mt-2 text-[28px] leading-8 font-medium tabular-nums", item.valueTone)}>
              {item.value}
            </p>
            <p className={cn("pointer-events-none relative mt-1 line-clamp-2 text-xs text-subtle-foreground", item.hintTone)}>
              {item.hint}
            </p>
          </div>
        );
      })}
    </section>
  );
}
