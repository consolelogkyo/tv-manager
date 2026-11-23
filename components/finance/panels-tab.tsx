"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { archiveCreditBatch, deleteCreditBatch, deletePanel, setPanelActive } from "@/app/actions/panels";
import { ConfirmDeleteButton } from "@/components/finance/confirm-delete-button";
import { CreditBatchFormDialog } from "@/components/finance/credit-batch-form-dialog";
import { getFifoBatchForPanel } from "@/components/finance/credit-source-selector";
import { PanelFormDialog } from "@/components/finance/panel-form-dialog";
import { StatCard } from "@/components/finance/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { SignalDot } from "@/components/ui/signal-dot";
import { round2 } from "@/lib/business";
import { formatDateBR } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { FinanceCustomer, Panel, PanelCreditBatch } from "@/lib/types";
import { cn } from "@/lib/utils";

type PanelStats = {
  active: number;
  internal: number;
  /** Custo unitário projetado (lote FIFO se houver estoque, senão custo de referência do painel). */
  projectedUnitCost: number;
  monthlyCost: number;
  stockCredits: number;
  stockValue: number;
  weightedAvgCost: number | null;
  fifoBatch: PanelCreditBatch | null;
  activeBatches: PanelCreditBatch[];
  archivedOrEmptyBatches: PanelCreditBatch[];
};

/** Cliente na carteira hoje: não cancelado e com vencimento em dia. */
function isActiveNow(c: FinanceCustomer, today: string) {
  return !c.canceled_at && c.expires_at >= today;
}

export function PanelsTab({
  panels,
  batches,
  customers,
  today,
}: {
  panels: Panel[];
  batches: PanelCreditBatch[];
  customers: FinanceCustomer[];
  today: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Panel | null>(null);

  const [batchFormOpen, setBatchFormOpen] = useState(false);
  const [batchTargetPanel, setBatchTargetPanel] = useState<Panel | null>(null);
  const [editingBatch, setEditingBatch] = useState<PanelCreditBatch | null>(null);

  const { stats, withoutPanel, totals } = useMemo(() => {
    const byPanel = new Map<string, PanelStats>();
    for (const p of panels) {
      const panelBatches = batches.filter((b) => b.panel_id === p.id);
      const activeBatches = panelBatches.filter((b) => b.is_active && b.quantity_remaining > 0);
      const archivedOrEmptyBatches = panelBatches.filter((b) => !b.is_active || b.quantity_remaining <= 0);
      let stockCredits = 0;
      let stockValue = 0;
      for (const b of activeBatches) {
        stockCredits += b.quantity_remaining;
        stockValue += b.quantity_remaining * b.unit_cost;
      }
      stockValue = round2(stockValue);
      const weightedAvgCost = stockCredits > 0 ? round2(stockValue / stockCredits) : null;
      const fifoBatch = getFifoBatchForPanel(panelBatches, p.id);
      const projectedUnitCost = fifoBatch ? fifoBatch.unit_cost : p.credit_cost;

      byPanel.set(p.id, {
        active: 0,
        internal: 0,
        projectedUnitCost,
        monthlyCost: 0,
        stockCredits,
        stockValue,
        weightedAvgCost,
        fifoBatch,
        activeBatches,
        archivedOrEmptyBatches,
      });
    }

    let noPanel = 0;
    for (const c of customers) {
      if (!isActiveNow(c, today)) continue;
      const entry = c.panel_id ? byPanel.get(c.panel_id) : undefined;
      if (!entry) {
        noPanel += 1;
        continue;
      }
      entry.active += 1;
      if (c.is_internal || c.plan_value < 0) entry.internal += 1;
      entry.monthlyCost = round2(entry.monthlyCost + entry.projectedUnitCost);
    }

    let creditsInUse = 0;
    let estimatedMonthlyCost = 0;
    let totalStockCredits = 0;
    let totalStockValue = 0;
    for (const s of byPanel.values()) {
      creditsInUse += s.active;
      estimatedMonthlyCost += s.monthlyCost;
      totalStockCredits += s.stockCredits;
      totalStockValue += s.stockValue;
    }

    return {
      stats: byPanel,
      withoutPanel: noPanel,
      totals: {
        creditsInUse,
        cost: round2(estimatedMonthlyCost),
        activePanels: panels.filter((p) => p.is_active).length,
        stockCredits: totalStockCredits,
        stockValue: round2(totalStockValue),
      },
    };
  }, [panels, batches, customers, today]);

  function openForm(panel: Panel | null) {
    setEditing(panel);
    setFormOpen(true);
  }

  function openNewBatch(panel: Panel) {
    setBatchTargetPanel(panel);
    setEditingBatch(null);
    setBatchFormOpen(true);
  }

  function openEditBatch(panel: Panel, batch: PanelCreditBatch) {
    setBatchTargetPanel(panel);
    setEditingBatch(batch);
    setBatchFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          id="fin-panels-active"
          term="panel"
          label="Painéis ativos"
          value={String(totals.activePanels)}
          hint={`${panels.length} cadastrado(s) no total`}
        />
        <StatCard
          id="fin-panels-stock"
          term="creditBatchesFifo"
          label="Créditos em estoque"
          value={String(totals.stockCredits)}
          hint={`${formatCurrency(totals.stockValue)} em lotes ativos`}
        />
        <StatCard
          id="fin-panels-credits"
          term="panelsCreditsInUse"
          label="Créditos em uso hoje"
          value={String(totals.creditsInUse)}
          hint={withoutPanel > 0 ? `+ ${withoutPanel} cliente(s) ativo(s) sem painel` : "Todos os ativos têm painel"}
        />
        <StatCard
          id="fin-panels-cost"
          term="panelsEstimatedCost"
          label="Custo mensal estimado"
          value={formatCurrency(totals.cost)}
          hint="Carteira ativa × próximo lote (FIFO) ou padrão"
        />
      </div>

      {withoutPanel > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {withoutPanel} cliente(s) ativo(s) sem painel definido — o custo do crédito deles não entra nos cálculos.{" "}
            <Link href="/" className="font-medium text-primary-ink underline-offset-2 hover:underline">
              Definir em Clientes
            </Link>
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-lg font-medium">
            <span>Painéis, lotes e custos de crédito</span>
            <InfoTip term="inventoryVsDre" />
          </h3>
          <p className="text-sm text-muted-foreground">
            Registre compras de lotes promocionais ou em volume para controlar o custo real por cliente (FIFO)
          </p>
        </div>
        <Button id="fin-panel-new" onClick={() => openForm(null)}>
          <Plus /> Novo painel
        </Button>
      </div>

      {panels.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Server className="mb-2 size-6 text-subtle-foreground" strokeWidth={1.5} />
          <p className="font-medium">Nenhum painel cadastrado</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Cadastre seus painéis/servidores com o custo de cada crédito para calcular o custo real por cliente.
          </p>
          <Button id="fin-panel-empty-new" variant="outline" className="mt-4" onClick={() => openForm(null)}>
            <Plus /> Novo painel
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {panels.map((p) => (
            <PanelCard
              key={p.id}
              panel={p}
              stats={
                stats.get(p.id) ?? {
                  active: 0,
                  internal: 0,
                  projectedUnitCost: p.credit_cost,
                  monthlyCost: 0,
                  stockCredits: 0,
                  stockValue: 0,
                  weightedAvgCost: null,
                  fifoBatch: null,
                  activeBatches: [],
                  archivedOrEmptyBatches: [],
                }
              }
              onEdit={() => openForm(p)}
              onNewBatch={() => openNewBatch(p)}
              onEditBatch={(b) => openEditBatch(p, b)}
            />
          ))}
        </ul>
      )}

      <PanelFormDialog open={formOpen} onOpenChange={setFormOpen} panel={editing} />
      <CreditBatchFormDialog
        open={batchFormOpen}
        onOpenChange={setBatchFormOpen}
        panel={batchTargetPanel}
        batch={editingBatch}
        today={today}
      />
    </div>
  );
}

function PanelCard({
  panel,
  stats,
  onEdit,
  onNewBatch,
  onEditBatch,
}: {
  panel: Panel;
  stats: PanelStats;
  onEdit: () => void;
  onNewBatch: () => void;
  onEditBatch: (batch: PanelCreditBatch) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [showArchived, setShowArchived] = useState(false);

  function toggleActive() {
    startTransition(async () => {
      const result = await setPanelActive(panel.id, !panel.is_active);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <li
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-5",
        !panel.is_active && "opacity-70",
      )}
    >
      {/* Cabeçalho do Painel + Custo de Referência */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-medium">{panel.name}</p>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <SignalDot tone={panel.is_active ? "active" : "canceled"} />
              {panel.is_active ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-2xl font-medium tabular-nums">{formatCurrency(panel.credit_cost)}</span>
            <span className="text-xs text-subtle-foreground">
              custo de referência (padrão quando sem lote)
            </span>
          </p>
        </div>

        <Button id={`fin-panel-buy-batch-${panel.id}`} variant="outline" size="sm" onClick={onNewBatch}>
          <PackagePlus /> Comprar / registrar lote
        </Button>
      </div>

      {/* Resumo de Estoque + Projeção da Carteira */}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-subtle-foreground">Estoque disponível</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {stats.stockCredits} {stats.stockCredits === 1 ? "crédito" : "créditos"}
          </dd>
          <dd className="text-[11px] text-subtle-foreground tabular-nums">
            {formatCurrency(stats.stockValue)} em estoque
          </dd>
        </div>

        <div>
          <dt className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
            Custo médio estoque <InfoTip term="panelAverageCost" />
          </dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {stats.weightedAvgCost !== null ? `${formatCurrency(stats.weightedAvgCost)}/cr` : "—"}
          </dd>
          <dd className="text-[11px] text-subtle-foreground">
            {stats.fifoBatch ? `FIFO: ${formatCurrency(stats.fifoBatch.unit_cost)}/cr` : "Usa referência"}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-subtle-foreground">Clientes ativos</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {stats.active}
            {stats.internal > 0 && (
              <span className="ml-1 text-xs font-normal text-subtle-foreground">({stats.internal} int.)</span>
            )}
          </dd>
        </div>

        <div>
          <dt className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
            Custo mensal est. <InfoTip term="panelsEstimatedCost" />
          </dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatCurrency(stats.monthlyCost)}</dd>
          <dd className="text-[11px] text-subtle-foreground tabular-nums">
            a {formatCurrency(stats.projectedUnitCost)}/cr
          </dd>
        </div>
      </dl>

      {/* Lista de Lotes do Painel */}
      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Layers className="size-3.5 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
            Lotes ativos em estoque ({stats.activeBatches.length})
            <InfoTip term="creditBatchesFifo" />
          </span>
          {stats.archivedOrEmptyBatches.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary-ink hover:underline"
            >
              {showArchived ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showArchived ? "Ocultar" : "Ver"} esgotados/arquivados ({stats.archivedOrEmptyBatches.length})
            </button>
          )}
        </div>

        {stats.activeBatches.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-background px-3 py-2.5 text-xs text-subtle-foreground">
            Nenhum lote com saldo em estoque. Novos consumos usarão o custo de referência (
            <strong className="text-muted-foreground">{formatCurrency(panel.credit_cost)}/cr</strong>) até que um lote
            seja registrado.
          </p>
        ) : (
          <ul className="grid gap-2">
            {stats.activeBatches.map((batch, idx) => (
              <BatchRow
                key={batch.id}
                batch={batch}
                isFifo={idx === 0}
                onEdit={() => onEditBatch(batch)}
              />
            ))}
          </ul>
        )}

        {showArchived && stats.archivedOrEmptyBatches.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-medium text-subtle-foreground">Lotes esgotados ou arquivados</p>
            <ul className="grid gap-1.5">
              {stats.archivedOrEmptyBatches.map((batch) => (
                <BatchRow
                  key={batch.id}
                  batch={batch}
                  isFifo={false}
                  onEdit={() => onEditBatch(batch)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {panel.notes && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{panel.notes}</p>}

      <div className="flex-1" aria-hidden="true" />
      <div className="mt-4 flex items-center justify-end gap-1 border-t border-border pt-3">
        <Button id={`fin-panel-edit-${panel.id}`} variant="outline" size="sm" onClick={onEdit} aria-label={`Editar ${panel.name}`}>
          <Pencil /> Editar painel
        </Button>
        <Button
          id={`fin-panel-toggle-${panel.id}`}
          variant="ghost"
          size="sm"
          onClick={toggleActive}
          disabled={pending}
          className="text-muted-foreground"
        >
          {pending ? <Loader2 className="animate-spin" /> : panel.is_active ? <PowerOff /> : <Power />}
          {panel.is_active ? "Desativar" : "Ativar"}
        </Button>
        <ConfirmDeleteButton
          id={`fin-panel-delete-${panel.id}`}
          ariaLabel={`Excluir painel ${panel.name}`}
          title="Excluir painel"
          description={
            <>
              <strong className="text-foreground">{panel.name}</strong> será excluído. Se houver clientes, lotes,
              lançamentos ou despesas vinculados, a exclusão será bloqueada — nesse caso, desative o painel.
            </>
          }
          onConfirm={() => deletePanel(panel.id)}
        />
      </div>
    </li>
  );
}

function BatchRow({
  batch,
  isFifo,
  onEdit,
}: {
  batch: PanelCreditBatch;
  isFifo: boolean;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const pctRemaining = batch.quantity_total > 0 ? Math.round((batch.quantity_remaining / batch.quantity_total) * 100) : 0;
  const isExhausted = batch.quantity_remaining <= 0;

  function handleToggleArchive() {
    startTransition(async () => {
      const result = await archiveCreditBatch(batch.id, !batch.is_active);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-background px-3 py-2.5 text-xs",
        (!batch.is_active || isExhausted) && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium text-foreground">{batch.label}</span>
            <Badge variant={isFifo ? "accent" : "outline"}>
              {formatCurrency(batch.unit_cost)}/cr
            </Badge>
            {isFifo && <Badge variant="success">FIFO · próximo</Badge>}
            {!batch.is_active && <Badge variant="outline">Arquivado</Badge>}
            {batch.is_active && isExhausted && <Badge variant="outline">Esgotado</Badge>}
          </div>
          <p className="mt-0.5 text-[11px] text-subtle-foreground tabular-nums">
            Comprado em {formatDateBR(batch.purchased_at)} ·{" "}
            <strong className="text-muted-foreground">
              {batch.quantity_remaining}/{batch.quantity_total}
            </strong>{" "}
            restantes ({formatCurrency(round2(batch.quantity_remaining * batch.unit_cost))} em estoque)
          </p>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            id={`fin-batch-edit-${batch.id}`}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            className="text-muted-foreground"
            aria-label={`Editar lote ${batch.label}`}
            title="Editar saldo ou custo do lote"
          >
            <Pencil />
          </Button>
          <Button
            id={`fin-batch-archive-${batch.id}`}
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleToggleArchive}
            disabled={pending}
            className="text-muted-foreground"
            aria-label={batch.is_active ? `Arquivar lote ${batch.label}` : `Reativar lote ${batch.label}`}
            title={batch.is_active ? "Encerrar / arquivar lote" : "Reativar lote"}
          >
            {pending ? <Loader2 className="animate-spin" /> : batch.is_active ? <Archive /> : <ArchiveRestore />}
          </Button>
          <ConfirmDeleteButton
            id={`fin-batch-delete-${batch.id}`}
            ariaLabel={`Excluir lote ${batch.label}`}
            title="Excluir lote de créditos"
            description={
              <>
                O lote <strong className="text-foreground">{batch.label}</strong> será removido. Se já houver
                lançamentos vinculados a ele, arquive-o em vez de excluir.
              </>
            }
            onConfirm={() => deleteCreditBatch(batch.id)}
          />
        </div>
      </div>

      {/* Barra de progresso discreta do saldo restante */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className={cn(
            "h-full rounded-full transition-colors",
            isExhausted ? "bg-subtle-foreground/40" : isFifo ? "bg-primary" : "bg-success/80",
          )}
          style={{ width: `${pctRemaining}%` }}
        />
      </div>
    </li>
  );
}
