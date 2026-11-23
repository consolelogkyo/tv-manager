"use client";

import { useMemo } from "react";
import { BarChart3, MessageCircle, ShieldCheck } from "lucide-react";
import { StatCard } from "@/components/finance/stat-card";
import { InfoTip, LabelWithInfo } from "@/components/ui/info-tip";
import { SignalDot } from "@/components/ui/signal-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHURN_GRACE_DAYS } from "@/lib/business";
import { formatDateBR } from "@/lib/date";
import { buildEvolution, computeChurn, type ChurnCustomer, type EvolutionRow, type MonthSummary, type RiskCustomer } from "@/lib/finance";
import { buildRecoveryWhatsAppLink, formatCurrency, formatPercent } from "@/lib/format";
import { formatMonthLabel, formatMonthShort } from "@/lib/month";
import type { FinanceData } from "@/lib/types";
import { cn } from "@/lib/utils";

type Churn = ReturnType<typeof computeChurn>;

export function EvolutionTab({
  data,
  month,
  dataMonths,
  summary,
  today,
  onSelectMonth,
}: {
  data: FinanceData;
  month: string;
  dataMonths: string[];
  summary: MonthSummary;
  today: string;
  onSelectMonth: (month: string) => void;
}) {
  const rows = useMemo(
    () => buildEvolution(dataMonths, data.events, data.expenses, data.panels),
    [dataMonths, data.events, data.expenses, data.panels],
  );
  const churn = useMemo(
    () => computeChurn(month, data.customers, data.events, today),
    [month, data.customers, data.events, today],
  );

  return (
    <div className="space-y-8">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <BarChart3 className="mb-3 size-6 text-subtle-foreground" strokeWidth={1.5} />
          <p className="font-medium">Ainda não há meses com lançamentos</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Importe o histórico na aba DRE para comparar a evolução mês a mês.
          </p>
        </div>
      ) : (
        <>
          <EvolutionChart rows={rows} selected={month} onSelect={onSelectMonth} />
          <EvolutionTable rows={rows} selected={month} onSelect={onSelectMonth} />
        </>
      )}

      <ChurnPanel churn={churn} summary={summary} month={month} />
      <ChurnList churn={churn} month={month} />
    </div>
  );
}

/* --------------------------------------------------------------- Gráfico --- */

function EvolutionChart({ rows, selected, onSelect }: { rows: EvolutionRow[]; selected: string; onSelect: (m: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.gross, r.totalDeductions)));
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const current = rows.find((r) => r.month === selected) ?? rows[rows.length - 1];

  return (
    <section aria-labelledby="fin-chart-title" className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="fin-chart-title" className="flex items-center gap-1 text-[15px] font-medium">
            Comparativo mês a mês
            <InfoTip term="evolution" />
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Mês {current.index} · {formatMonthLabel(current.month)}
          </p>
        </div>
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-xs text-subtle-foreground">Faturamento</dt>
            <dd className="text-lg font-medium tabular-nums">{formatCurrency(current.gross)}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle-foreground">Lucro</dt>
            <dd className={cn("text-lg font-medium tabular-nums", current.net < 0 ? "text-destructive" : "text-primary-ink")}>
              {formatCurrency(current.net)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 -mx-1 overflow-x-auto px-1">
        <div className="relative flex h-64 min-w-full items-end gap-2 border-b border-border sm:gap-4" role="group" aria-label="Meses">
          {/* Grade discreta */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="border-t border-dashed border-border" />
            ))}
          </div>
          {rows.map((r) => {
            const active = r.month === selected;
            const kept = Math.max(0, r.net);
            const barTotal = Math.max(r.gross, r.totalDeductions);
            return (
              <button
                key={r.month}
                type="button"
                id={`fin-chart-${r.month}`}
                onClick={() => onSelect(r.month)}
                title={`${formatMonthLabel(r.month)} — Faturamento ${formatCurrency(r.gross)} · Gastos ${formatCurrency(r.totalDeductions)} · Lucro ${formatCurrency(r.net)}`}
                aria-label={`Mês ${r.index}, ${formatMonthLabel(r.month)}: faturamento ${formatCurrency(r.gross)}, lucro ${formatCurrency(r.net)}`}
                aria-pressed={active}
                className="group relative flex h-full min-w-12 flex-1 cursor-pointer flex-col justify-end rounded-t-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "relative mx-auto flex w-full max-w-14 flex-col justify-end overflow-hidden rounded-t-md transition-colors duration-150",
                    active ? "bg-[#2a2f3d]" : "bg-[#2a2a2d] group-hover:bg-[#323236]",
                    r.net < 0 && "ring-1 ring-destructive/50 ring-inset",
                  )}
                  style={{ height: pct(barTotal) }}
                >
                  <span
                    className={cn(
                      "block w-full transition-colors duration-150",
                      active ? "bg-primary" : "bg-[#5c5c63] group-hover:bg-[#6c6c73]",
                    )}
                    style={{ height: barTotal > 0 ? `${(kept / barTotal) * 100}%` : "0%" }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-full gap-2 pt-2 sm:gap-4">
          {rows.map((r) => (
            <span
              key={r.month}
              className={cn(
                "min-w-12 flex-1 text-center font-mono text-[11px] leading-4",
                r.month === selected ? "text-foreground" : "text-subtle-foreground",
              )}
            >
              M{r.index}
              <span className="block">{formatMonthShort(r.month)}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" /> Lucro líquido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-[#2a2f3d]" /> Gastos (restante do faturamento)
        </span>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Tabela --- */

function Growth({ value }: { value: number | null }) {
  if (value === null) return <span className="text-subtle-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={cn("tabular-nums", positive ? "text-success" : "text-destructive")}>
      {positive ? "+" : "−"}
      {formatPercent(Math.abs(value))}
    </span>
  );
}

function EvolutionTable({ rows, selected, onSelect }: { rows: EvolutionRow[]; selected: string; onSelect: (m: string) => void }) {
  return (
    <section aria-labelledby="fin-evolution-title" className="space-y-3">
      <h3 id="fin-evolution-title" className="text-lg font-medium">
        Evolução mensal
      </h3>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Novos / renov.</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Créditos</TableHead>
              <TableHead className="text-right">Comissões</TableHead>
              <TableHead className="text-right">Despesas</TableHead>
              <TableHead className="text-right">Lucro líquido</TableHead>
              <TableHead className="text-right">
                <LabelWithInfo term="growth" align="end">
                  Cresc. fat.
                </LabelWithInfo>
              </TableHead>
              <TableHead className="text-right">Cresc. lucro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...rows].reverse().map((r) => {
              const active = r.month === selected;
              return (
                <TableRow
                  key={r.month}
                  onClick={() => onSelect(r.month)}
                  aria-selected={active}
                  className={cn("cursor-pointer", active && "bg-muted/60 hover:bg-muted/60")}
                >
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      {active && <span aria-hidden="true" className="h-4 w-0.5 rounded-full bg-primary" />}
                      <span className="font-medium">Mês {r.index}</span>
                      <span className="text-muted-foreground">{formatMonthLabel(r.month)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {r.newCount} / {r.renewalCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.gross)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{formatCurrency(r.credits)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{formatCurrency(r.commissions)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{formatCurrency(r.expenses)}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", r.net < 0 && "text-destructive")}>
                    {formatCurrency(r.net)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Growth value={r.grossGrowth} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Growth value={r.netGrowth} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- Churn --- */

function ChurnPanel({ churn, summary, month }: { churn: Churn; summary: MonthSummary; month: string }) {
  return (
    <section aria-labelledby="fin-churn-title" className="space-y-3">
      <div>
        <h3 id="fin-churn-title" className="text-lg font-medium">
          Métricas e churn
        </h3>
        <p className="text-sm text-muted-foreground">{formatMonthLabel(month)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          id="fin-churn-rate"
          term="churn"
          label="Taxa de churn"
          value={churn.churnRate !== null ? formatPercent(churn.churnRate) : "—"}
          valueClassName={churn.churnRate !== null && churn.churnRate >= 10 ? "text-destructive" : undefined}
          hint={`${churn.lostCount} perdido(s) de ${churn.baseCount} na base`}
        />
        <StatCard
          id="fin-retention"
          term="retention"
          label="Taxa de retenção"
          value={churn.retentionRate !== null ? formatPercent(churn.retentionRate) : "—"}
          hint={`${churn.activeCount} cliente(s) ativos no mês`}
        />
        <StatCard
          id="fin-lost-revenue"
          term="lostRevenue"
          label="Receita perdida"
          value={formatCurrency(churn.lostRevenue)}
          hint={`${churn.canceledCount} cancelado(s) · ${churn.expiredCount} vencido(s) há mais de ${CHURN_GRACE_DAYS} dias`}
        />
        <StatCard
          id="fin-arpu"
          term="arpu"
          label="Ticket médio (ARPU)"
          value={summary.arpu !== null ? formatCurrency(summary.arpu) : "—"}
          hint={`${formatCurrency(summary.gross)} ÷ ${summary.payingCustomers} pagante(s)`}
        />
      </div>
    </section>
  );
}

function RecoveryButton({ customer, id }: { customer: { phone: string | null; name: string }; id: string }) {
  const href = customer.phone ? buildRecoveryWhatsAppLink({ phone: customer.phone, name: customer.name }) : null;
  if (!href) return <span className="shrink-0 text-xs text-subtle-foreground">Sem WhatsApp</span>;
  return (
    <a
      id={id}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
      title="Enviar mensagem de recuperação no WhatsApp"
    >
      <MessageCircle className="size-3.5 text-muted-foreground" strokeWidth={1.75} /> Recuperar
    </a>
  );
}

function ChurnList({ churn, month }: { churn: Churn; month: string }) {
  const empty = churn.lost.length === 0 && churn.atRisk.length === 0;
  return (
    <section aria-labelledby="fin-churn-list-title" className="space-y-3">
      <h3 id="fin-churn-list-title" className="flex items-center gap-1 text-lg font-medium">
        Clientes em churn / risco
        <InfoTip term="churnList" />
      </h3>
      {empty ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <ShieldCheck className="mb-3 size-6 text-subtle-foreground" strokeWidth={1.5} />
          <p className="font-medium">Nenhum cliente perdido em {formatMonthLabel(month)}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {churn.lost.map((c) => (
            <ChurnItem key={c.id} customer={c} />
          ))}
          {churn.atRisk.map((c) => (
            <RiskItem key={c.id} customer={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ChurnItem({ customer }: { customer: ChurnCustomer }) {
  const canceled = customer.reason === "canceled";
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <SignalDot tone={canceled ? "canceled" : "expired"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{customer.name}</p>
        <p className="text-xs text-muted-foreground">
          {canceled ? `Cancelado em ${formatDateBR(customer.churnDate)}` : `Vencido desde ${formatDateBR(customer.expires_at)}`} ·{" "}
          {formatCurrency(Math.max(0, customer.plan_value))}/mês
        </p>
      </div>
      <RecoveryButton customer={customer} id={`fin-recover-${customer.id}`} />
    </li>
  );
}

function RiskItem({ customer }: { customer: RiskCustomer }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <SignalDot tone="expiring" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{customer.name}</p>
        <p className="text-xs text-warning">
          Em risco · vencido há {customer.daysOverdue} dia{customer.daysOverdue === 1 ? "" : "s"}
        </p>
      </div>
      <RecoveryButton customer={customer} id={`fin-recover-risk-${customer.id}`} />
    </li>
  );
}
