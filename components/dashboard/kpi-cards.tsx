"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CircleDollarSign, Coins, HandCoins, Users, XCircle, type LucideIcon } from "lucide-react";
import type { StatusFilter } from "@/components/customers/types";
import { CreditCostEditor } from "@/components/dashboard/credit-cost-editor";
import { RESELLER_COMMISSION, getCreditsTotalCost } from "@/lib/business";
import { formatCurrency } from "@/lib/format";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Kpis = {
  activeCount: number;
  /** Ativos com `plan_value >= 0` (exclui "Desconto / Custo Interno"). */
  payingActiveCount: number;
  expiringCount: number;
  expiredCount: number;
  /** admin: saldo líquido · reseller: comissão total. */
  monthlyRevenue: number;
};

type Props = {
  kpis: Kpis;
  activeFilter: StatusFilter;
  onSelect: (filter: StatusFilter) => void;
  userRole: UserRole;
  /** Custo unitário do crédito — exibe o 5º card apenas para admin. */
  creditUnitCost?: number | null;
};

type KpiItem = {
  id: string;
  label: string;
  value: string;
  hint: string;
  Icon: LucideIcon;
  tone: string;
  glow: string;
  ring: string;
  filter: StatusFilter | null;
  dot?: string;
  alert?: boolean;
  /** Ação ao lado do subtítulo (só em cards não clicáveis, para não aninhar botões). */
  hintAction?: ReactNode;
};

/**
 * Posição de cada card no layout do admin (5 cards), agrupando por assunto:
 * - celular (2 col.): "Clientes ativos" na largura toda · vencendo + vencidos · receita + créditos;
 * - tablet/desktop (6 col.): 3 cards de status em cima · 2 cards financeiros, mais largos, embaixo.
 * `order` só reordena visualmente; os elementos focáveis seguem a mesma sequência no DOM.
 */
const ADMIN_LAYOUT: Record<string, string> = {
  "kpi-active": "order-1 col-span-2",
  "kpi-expiring": "order-2 md:col-span-2",
  "kpi-expired": "order-3 md:col-span-2",
  "kpi-revenue": "order-4 md:col-span-3",
  "kpi-credits": "order-5 md:col-span-3",
};

export function KpiCards({ kpis, activeFilter, onSelect, userRole, creditUnitCost = null }: Props) {
  const isReseller = userRole === "reseller";
  const negativeBalance = kpis.monthlyRevenue < 0;
  const showCredits = userRole === "admin" && creditUnitCost !== null;

  const items: KpiItem[] = [
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
    isReseller
      ? {
          id: "kpi-commission",
          label: "Sua comissão total (R$)",
          value: formatCurrency(kpis.monthlyRevenue),
          hint: `${formatCurrency(RESELLER_COMMISSION)} por cliente ativo`,
          Icon: HandCoins,
          tone: "text-success",
          glow: "from-success/20",
          ring: "ring-success/40",
          filter: null,
        }
      : {
          id: "kpi-revenue",
          label: "Receita / Saldo líquido (R$)",
          value: formatCurrency(kpis.monthlyRevenue),
          hint: "descontando comissões e custos",
          Icon: CircleDollarSign,
          tone: negativeBalance ? "text-destructive" : "text-success",
          glow: negativeBalance ? "from-destructive/20" : "from-success/20",
          ring: "ring-success/40",
          filter: null,
          alert: negativeBalance,
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

  if (showCredits) {
    const n = kpis.payingActiveCount;
    items.push({
      id: "kpi-credits",
      label: "Custo de créditos (R$)",
      value: formatCurrency(getCreditsTotalCost(n, creditUnitCost)),
      hint: `${n} cliente${n === 1 ? "" : "s"} × ${formatCurrency(creditUnitCost)}/crédito`,
      Icon: Coins,
      tone: "text-violet-300",
      glow: "from-accent-violet/25",
      ring: "ring-accent-violet/40",
      filter: null,
      hintAction: <CreditCostEditor value={creditUnitCost} payingActiveCount={n} />,
    });
  }

  return (
    <section
      aria-label="Resumo"
      className={cn(
        "grid grid-cols-2 gap-3 sm:gap-x-4",
        // Admin (5 cards): grade de 6 colunas a partir do tablet → 3 cards de status em cima
        // e 2 cards financeiros, mais largos, embaixo. Revendedor: 4 colunas como antes.
        showCredits ? "md:grid-cols-6" : "lg:grid-cols-4",
      )}
    >
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
              "group relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-left shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 animate-fade-up sm:px-5 sm:py-3.5",
              clickable && "cursor-pointer hover:-translate-y-0.5 hover:border-border hover:bg-card/80",
              selected && `ring-2 ${item.ring}`,
              showCredits && ADMIN_LAYOUT[item.id],
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
            <div className="relative flex items-start justify-between gap-3">
              <span className="min-w-0 pt-0.5 text-xs leading-snug font-medium text-muted-foreground sm:text-sm">
                {item.label}
              </span>
              <span
                className={cn(
                  "relative grid size-8 shrink-0 place-items-center rounded-lg bg-background/60 ring-1 ring-border",
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
            <p
              className={cn(
                "relative mt-1 font-display text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]",
                item.alert && item.tone,
              )}
            >
              {item.value}
            </p>
            {/* Subtítulo quebra em até 2 linhas em vez de ser cortado com reticências. */}
            {item.hintAction ? (
              <div className="relative mt-1 flex min-w-0 items-start gap-1.5">
                <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">{item.hint}</p>
                {item.hintAction}
              </div>
            ) : (
              <p className="relative mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                {item.hint}
              </p>
            )}
          </Comp>
        );
      })}
    </section>
  );
}
