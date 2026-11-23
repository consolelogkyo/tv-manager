"use client";

import { useState } from "react";
import { FilePlus2, Pencil, Receipt, RefreshCw } from "lucide-react";
import { deleteBillingEvent } from "@/app/actions/finance";
import { BillingEventFormDialog } from "@/components/finance/billing-event-form-dialog";
import { ConfirmDeleteButton } from "@/components/finance/confirm-delete-button";
import { StatCard } from "@/components/finance/stat-card";
import { SyncCustomersDialog } from "@/components/finance/sync-customers-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip, LabelWithInfo } from "@/components/ui/info-tip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PARTNERS_COUNT, round2 } from "@/lib/business";
import { formatDateBR } from "@/lib/date";
import { BILLING_EVENT_TYPE_LABEL, EXPENSE_CATEGORY_META } from "@/lib/expenses";
import { creditsOfEvent, type MonthSummary } from "@/lib/finance";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { GlossaryKey } from "@/lib/glossary";
import { formatMonthLabel } from "@/lib/month";
import type { BillingEvent, FinanceData } from "@/lib/types";
import { cn } from "@/lib/utils";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function OverviewTab({
  summary,
  month,
  monthEvents,
  data,
  today,
}: {
  summary: MonthSummary;
  month: string;
  monthEvents: BillingEvent[];
  data: FinanceData;
  today: string;
}) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BillingEvent | null>(null);

  const negative = summary.net < 0;

  function openManual(event: BillingEvent | null) {
    setEditing(event);
    setChooserOpen(false);
    setFormOpen(true);
  }

  return (
    <div className="space-y-8">
      {/* Números principais do mês */}
      <section aria-label="Resumo do mês" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          id="fin-gross"
          term="gross"
          label="Faturamento bruto"
          value={formatCurrency(summary.gross)}
          hint={`${plural(summary.newCount, "nova", "novas")} + ${plural(summary.renewalCount, "renovação", "renovações")}`}
        />
        <StatCard
          id="fin-deductions"
          term="deductions"
          label="Total de gastos"
          value={formatCurrency(summary.totalDeductions)}
          hint="Comissões, créditos e despesas extras"
        />
        <StatCard
          id="fin-net"
          term="netProfit"
          label="Lucro líquido"
          value={formatCurrency(summary.net)}
          valueClassName={negative ? "text-destructive" : "text-primary-ink"}
          hint={summary.margin !== null ? `Margem de ${formatPercent(summary.margin)}` : "Sem faturamento no mês"}
        />
        <StatCard
          id="fin-partner"
          term="perPartner"
          label={`Lucro por sócio (÷ ${PARTNERS_COUNT})`}
          value={formatCurrency(summary.perPartner)}
          valueClassName={negative ? "text-destructive" : undefined}
          hint="Quanto fica para cada sócio"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <DreStatement summary={summary} month={month} className="xl:col-span-3" />

        <div className="flex flex-col gap-6 xl:col-span-2">
          {/* Lançamento / importação retroativa */}
          <section aria-labelledby="fin-import-title" className="rounded-xl border border-border bg-card p-5">
            <h3 id="fin-import-title" className="flex items-center gap-1 text-[15px] font-medium">
              Lançar / importar histórico
              <InfoTip term="importHistory" />
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Preencha meses anteriores ao Livro-Razão, como o Mês 1, ou registre uma entrada avulsa em{" "}
              {formatMonthLabel(month)}.
            </p>
            <Button id="fin-import-open" variant="outline" onClick={() => setChooserOpen(true)} className="mt-4">
              <FilePlus2 /> Lançar / importar
            </Button>
          </section>

          <section aria-labelledby="fin-indicators-title" className="rounded-xl border border-border bg-card p-5">
            <h3 id="fin-indicators-title" className="text-[15px] font-medium">
              Indicadores do mês
            </h3>
            <dl className="mt-3 divide-y divide-border text-sm">
              <Indicator term="payingCustomers" label="Clientes pagantes" value={String(summary.payingCustomers)} />
              <Indicator term="arpu" label="Ticket médio" value={summary.arpu !== null ? formatCurrency(summary.arpu) : "—"} />
              <Indicator
                term="margin"
                label="Margem líquida"
                value={summary.margin !== null ? formatPercent(summary.margin) : "—"}
              />
              <Indicator term="ledger" label="Lançamentos" value={String(summary.eventCount)} />
            </dl>
          </section>
        </div>
      </div>

      <MovementsList
        month={month}
        events={monthEvents}
        onEdit={(event) => openManual(event)}
        onImport={() => setChooserOpen(true)}
      />

      {/* Escolha: lançamento manual ou sincronização em lote */}
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lançar / importar histórico</DialogTitle>
            <DialogDescription>Mês de referência: {formatMonthLabel(month)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <ChoiceButton
              id="fin-choose-sync"
              Icon={RefreshCw}
              title="Sincronizar clientes atuais neste mês"
              description={`Importa em 1 clique os clientes ativos que ainda não têm lançamento em ${formatMonthLabel(month)}.`}
              recommended
              onClick={() => {
                setChooserOpen(false);
                setSyncOpen(true);
              }}
            />
            <ChoiceButton
              id="fin-choose-manual"
              Icon={Receipt}
              title="Registrar entrada manual"
              description="Um lançamento em qualquer mês, com valores livres (bruto, comissão e crédito)."
              onClick={() => openManual(null)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <BillingEventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editing}
        month={month}
        today={today}
        customers={data.customers}
        panels={data.panels}
        batches={data.batches}
      />
      <SyncCustomersDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        month={month}
        customers={data.customers}
        events={data.events}
        panels={data.panels}
      />
    </div>
  );
}

function Indicator({ term, label, value }: { term: GlossaryKey; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-muted-foreground">
        <LabelWithInfo term={term}>{label}</LabelWithInfo>
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function ChoiceButton({
  id,
  Icon,
  title,
  description,
  recommended,
  onClick,
}: {
  id: string;
  Icon: typeof Receipt;
  title: string;
  description: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-left transition-colors duration-150",
        recommended ? "border-primary/50 bg-muted hover:bg-muted/70" : "border-border bg-background hover:bg-muted",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      {recommended && <span className="text-xs text-primary-ink">Recomendado</span>}
    </button>
  );
}

/* --------------------------------------------------------------- DRE --- */

type Sign = "+" | "−" | "=";

function DreLine({
  sign,
  label,
  detail,
  value,
  term,
  kind = "line",
}: {
  sign?: Sign;
  label: string;
  detail?: string;
  value: number;
  term?: GlossaryKey;
  kind?: "line" | "sub" | "subtotal" | "total";
}) {
  const isSub = kind === "sub";
  const isTotal = kind === "total";
  const shown = sign === "−" && value > 0 ? `−${formatCurrency(value)}` : formatCurrency(value);

  return (
    <div
      className={cn(
        "grid grid-cols-[20px_minmax(0,1fr)_auto] items-baseline gap-x-2",
        isSub ? "py-1 text-[13px]" : "py-2.5 text-sm",
        kind === "subtotal" && "border-t border-border font-medium",
        isTotal && "mt-1 border-t-[3px] border-double border-foreground/25 pt-3 pb-1",
      )}
    >
      <span aria-hidden="true" className="font-mono text-[13px] text-subtle-foreground">
        {sign ?? ""}
      </span>
      <div className={cn("min-w-0", isSub && "text-muted-foreground")}>
        <span className={cn("inline-flex items-center gap-1", isTotal && "text-[15px] font-medium")}>
          {label}
          {term && <InfoTip term={term} />}
        </span>
        {detail && <p className="text-xs text-subtle-foreground">{detail}</p>}
      </div>
      <span
        className={cn(
          "text-right whitespace-nowrap tabular-nums",
          isSub && "text-muted-foreground",
          isTotal && cn("text-xl font-medium", value < 0 ? "text-destructive" : "text-primary-ink"),
        )}
      >
        {shown}
      </span>
    </div>
  );
}

function DreStatement({ summary, month, className }: { summary: MonthSummary; month: string; className?: string }) {
  return (
    <section aria-labelledby="fin-dre-title" className={cn("rounded-xl border border-border bg-card p-5 sm:p-6", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="fin-dre-title" className="flex items-center gap-1 text-[15px] font-medium">
          Demonstrativo do resultado (DRE)
          <InfoTip term="dre" />
        </h3>
        <span className="text-[13px] text-muted-foreground">{formatMonthLabel(month)}</span>
      </div>

      <DreLine
        sign="+"
        label="Receita de assinaturas novas"
        detail={plural(summary.newCount, "assinatura", "assinaturas")}
        value={summary.newAmount}
      />
      <DreLine
        sign="+"
        label="Receita de renovações"
        detail={plural(summary.renewalCount, "renovação", "renovações")}
        value={summary.renewalAmount}
      />
      <DreLine sign="=" label="Faturamento bruto" value={summary.gross} term="gross" kind="subtotal" />

      <DreLine
        sign="−"
        label="Comissões de revendedores"
        detail={plural(summary.commissionCount, "comissão", "comissões")}
        value={summary.commissions}
        term="commissions"
      />

      <DreLine
        sign="−"
        label="Custo de créditos por painel"
        detail={plural(summary.creditCount, "crédito consumido", "créditos consumidos")}
        value={summary.credits}
        term="creditsByPanel"
      />
      {summary.panelLines.map((line) => {
        const tierBreakdown = line.mixedCost
          ? line.priceTiers.map((t) => `${t.count}× ${formatCurrency(t.unitCost)}`).join(" + ")
          : null;
        const usageDetail = `${plural(line.payingCount, "pagante", "pagantes")} · ${line.internalCount} uso interno`;
        return (
          <DreLine
            key={line.key}
            kind="sub"
            label={
              line.mixedCost
                ? `${line.name} · ${line.count} cr (média ${formatCurrency(line.unitCost)}/cr)`
                : `${line.name} · ${line.count} cr × ${formatCurrency(line.unitCost)}`
            }
            detail={tierBreakdown ? `${tierBreakdown} · ${usageDetail}` : usageDetail}
            value={line.total}
          />
        );
      })}

      <DreLine
        sign="−"
        label="Despesas extras / custos invisíveis"
        detail={plural(summary.expenseCount, "despesa", "despesas")}
        value={summary.expenses}
        term="extraExpenses"
      />
      {summary.expenseLines.map((line) => (
        <DreLine
          key={line.category}
          kind="sub"
          label={`${EXPENSE_CATEGORY_META[line.category].label} (${line.count})`}
          value={line.amount}
        />
      ))}

      <DreLine
        sign="="
        label="Lucro líquido final"
        detail={
          summary.margin !== null
            ? `Margem de ${formatPercent(summary.margin)} · ${formatCurrency(summary.perPartner)} por sócio`
            : `${formatCurrency(summary.perPartner)} por sócio`
        }
        value={summary.net}
        term="netProfit"
        kind="total"
      />

      {summary.eventCount === 0 && summary.expenseCount === 0 && (
        <p className="mt-4 text-xs text-subtle-foreground">
          Sem lançamentos neste mês. Use Lançar / importar para preenchê-lo.
        </p>
      )}
    </section>
  );
}

/* --------------------------------------------------------- Movimentações --- */

function MovementsList({
  month,
  events,
  onEdit,
  onImport,
}: {
  month: string;
  events: BillingEvent[];
  onEdit: (event: BillingEvent) => void;
  onImport: () => void;
}) {
  const netOf = (e: BillingEvent) => round2(e.gross_amount - e.commission_amount - e.credit_cost);

  const deleteProps = (e: BillingEvent, suffix = "") => ({
    id: `fin-event-delete${suffix}-${e.id}`,
    ariaLabel: `Excluir lançamento de ${e.customer_name_snapshot}`,
    title: "Excluir lançamento",
    description: (
      <>
        O lançamento de <strong className="text-foreground">{e.customer_name_snapshot}</strong> (
        {formatCurrency(e.gross_amount)} em {formatDateBR(e.event_date)}) será removido do Livro-Razão. O cadastro do
        cliente não é alterado.
      </>
    ),
    onConfirm: () => deleteBillingEvent(e.id),
  });

  const tags = (e: BillingEvent) => (
    <span className="inline-flex flex-wrap gap-1">
      <Badge variant={e.event_type === "new_subscription" ? "accent" : "default"}>{BILLING_EVENT_TYPE_LABEL[e.event_type]}</Badge>
      {e.is_internal && <Badge variant="outline">Uso interno</Badge>}
      {e.is_reseller && <Badge variant="outline">Revenda</Badge>}
    </span>
  );

  return (
    <section aria-labelledby="fin-movements-title" className="space-y-3">
      <div>
        <h3 id="fin-movements-title" className="flex items-center gap-1 text-lg font-medium">
          Movimentações do mês
          <InfoTip term="ledger" />
        </h3>
        <p className="text-sm text-muted-foreground">
          {plural(events.length, "lançamento", "lançamentos")} em {formatMonthLabel(month)}
        </p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <Receipt className="mb-3 size-6 text-subtle-foreground" strokeWidth={1.5} />
          <p className="font-medium">Nenhum lançamento em {formatMonthLabel(month)}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Novos cadastros e renovações entram aqui automaticamente. Para meses antigos, importe o histórico.
          </p>
          <Button id="fin-empty-import" variant="outline" className="mt-4" onClick={onImport}>
            <FilePlus2 /> Lançar / importar
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Painel</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{formatDateBR(e.event_date)}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="flex flex-col gap-1">
                        <span className="truncate font-medium" title={e.notes ?? undefined}>
                          {e.customer_name_snapshot}
                        </span>
                        {tags(e)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.panel_name_snapshot ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(e.gross_amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {e.commission_amount > 0 ? `−${formatCurrency(e.commission_amount)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      <span className="text-xs text-subtle-foreground">{creditsOfEvent(e)} cr · </span>
                      {e.credit_cost > 0 ? `−${formatCurrency(e.credit_cost)}` : formatCurrency(0)}
                    </TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", netOf(e) < 0 && "text-destructive")}>
                      {formatCurrency(netOf(e))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          id={`fin-event-edit-${e.id}`}
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onEdit(e)}
                          className="text-muted-foreground"
                          aria-label={`Editar lançamento de ${e.customer_name_snapshot}`}
                          title="Editar"
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDeleteButton {...deleteProps(e)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {events.map((e) => (
              <li key={e.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.customer_name_snapshot}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateBR(e.event_date)} · {e.panel_name_snapshot ?? "Sem painel"}
                    </p>
                    <div className="mt-1.5">{tags(e)}</div>
                  </div>
                  <span className={cn("text-base font-medium tabular-nums", netOf(e) < 0 && "text-destructive")}>
                    {formatCurrency(netOf(e))}
                  </span>
                </div>
                <p className="mt-2 text-xs text-subtle-foreground tabular-nums">
                  Bruto {formatCurrency(e.gross_amount)} · Comissão {formatCurrency(e.commission_amount)} ·{" "}
                  {creditsOfEvent(e)} cr ({formatCurrency(e.credit_cost)})
                </p>
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
                  <Button
                    id={`fin-event-edit-m-${e.id}`}
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(e)}
                    aria-label={`Editar lançamento de ${e.customer_name_snapshot}`}
                  >
                    <Pencil /> Editar
                  </Button>
                  <ConfirmDeleteButton {...deleteProps(e, "-m")} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
