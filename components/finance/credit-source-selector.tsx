"use client";

import { useMemo } from "react";
import { AlertTriangle, Coins, Layers, SlidersHorizontal } from "lucide-react";
import { CurrencyPrefix } from "@/components/ui/form-field";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { round2 } from "@/lib/business";
import { formatCurrency, maskCurrency, numberToCurrencyInput, parseCurrency } from "@/lib/format";
import type { CreditSourceMode, CreditSourceValue, PanelCreditBatch, PanelOption } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lotes ativos com saldo > 0 para o painel, já ordenados por FIFO (mais antigo primeiro). */
export function getAvailableBatchesForPanel(batches: PanelCreditBatch[], panelId: string | null | undefined): PanelCreditBatch[] {
  if (!panelId) return [];
  return batches.filter((b) => b.panel_id === panelId && b.is_active && b.quantity_remaining > 0);
}

/** Próximo lote ativo com saldo > 0 (FIFO) para o painel, ou `null` se não houver estoque. */
export function getFifoBatchForPanel(batches: PanelCreditBatch[], panelId: string | null | undefined): PanelCreditBatch | null {
  return getAvailableBatchesForPanel(batches, panelId)[0] ?? null;
}

/** Valor padrão do seletor ao escolher um painel: pré-seleciona o lote FIFO se houver estoque. */
export function getDefaultCreditSourceForPanel(
  panel: Pick<PanelOption, "id" | "credit_cost"> | null | undefined,
  batches: PanelCreditBatch[],
): CreditSourceValue {
  if (!panel) {
    return { mode: "panel_default", batchId: "", customUnitCost: "0,00" };
  }
  const fifo = getFifoBatchForPanel(batches, panel.id);
  if (fifo) {
    return {
      mode: "batch",
      batchId: fifo.id,
      customUnitCost: numberToCurrencyInput(fifo.unit_cost),
    };
  }
  return {
    mode: "panel_default",
    batchId: "",
    customUnitCost: numberToCurrencyInput(panel.credit_cost),
  };
}

/** Calcula o custo unitário, o custo total e o lote selecionado para pré-visualização. */
export function resolveCreditSourcePreview(params: {
  panel: Pick<PanelOption, "id" | "credit_cost"> | null | undefined;
  batches: PanelCreditBatch[];
  value: CreditSourceValue;
  creditsUsed: number;
}): {
  unitCost: number;
  totalCost: number;
  selectedBatch: PanelCreditBatch | null;
  insufficientStock: boolean;
} {
  const { panel, batches, value, creditsUsed } = params;
  const qty = Math.max(0, creditsUsed);
  if (!panel) {
    return { unitCost: 0, totalCost: 0, selectedBatch: null, insufficientStock: false };
  }

  if (value.mode === "batch") {
    const available = getAvailableBatchesForPanel(batches, panel.id);
    const chosen = available.find((b) => b.id === value.batchId) ?? available[0] ?? null;
    if (chosen) {
      return {
        unitCost: chosen.unit_cost,
        totalCost: round2(chosen.unit_cost * qty),
        selectedBatch: chosen,
        insufficientStock: chosen.quantity_remaining < qty,
      };
    }
  }

  if (value.mode === "custom") {
    const parsed = parseCurrency(value.customUnitCost || "0");
    const unit = Number.isFinite(parsed) && parsed >= 0 ? round2(parsed) : 0;
    return {
      unitCost: unit,
      totalCost: round2(unit * qty),
      selectedBatch: null,
      insufficientStock: false,
    };
  }

  return {
    unitCost: panel.credit_cost,
    totalCost: round2(panel.credit_cost * qty),
    selectedBatch: null,
    insufficientStock: false,
  };
}

/**
 * Seletor reutilizável de origem/custo do crédito (exclusivo `admin`):
 * 1. Consumir de um lote em estoque (FIFO pré-selecionado);
 * 2. Custo padrão do painel (sem baixar estoque);
 * 3. Valor avulso / customizado (aceita R$ 0,00 para brinde, sem baixar estoque).
 */
export function CreditSourceSelector({
  panel,
  batches,
  creditsUsed = 1,
  value,
  onChange,
  idPrefix = "credit-source",
  label = "Origem e custo do crédito",
  className,
}: {
  panel: Pick<PanelOption, "id" | "name" | "credit_cost"> | null;
  batches: PanelCreditBatch[];
  creditsUsed?: number;
  value: CreditSourceValue;
  onChange: (next: CreditSourceValue) => void;
  idPrefix?: string;
  label?: string;
  className?: string;
}) {
  const availableBatches = useMemo(
    () => getAvailableBatchesForPanel(batches, panel?.id),
    [batches, panel?.id],
  );
  const hasStock = availableBatches.length > 0;
  const preview = resolveCreditSourcePreview({ panel, batches, value, creditsUsed });

  if (!panel) return null;

  function setMode(nextMode: CreditSourceMode) {
    if (nextMode === "batch") {
      const target = availableBatches.find((b) => b.id === value.batchId) ?? availableBatches[0];
      if (!target) return;
      onChange({
        mode: "batch",
        batchId: target.id,
        customUnitCost: numberToCurrencyInput(target.unit_cost),
      });
      return;
    }
    if (nextMode === "panel_default") {
      onChange({
        mode: "panel_default",
        batchId: "",
        customUnitCost: numberToCurrencyInput(panel!.credit_cost),
      });
      return;
    }
    onChange({
      mode: "custom",
      batchId: "",
      customUnitCost: value.customUnitCost || numberToCurrencyInput(panel!.credit_cost),
    });
  }

  return (
    <div className={cn("space-y-2 rounded-lg border border-border bg-background p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
          {label}
          <InfoTip term="creditBatchesFifo" />
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {creditsUsed > 1 ? (
            <>
              {creditsUsed} cr × {formatCurrency(preview.unitCost)} ={" "}
              <strong className="text-foreground">{formatCurrency(preview.totalCost)}</strong>
            </>
          ) : (
            <>
              Custo: <strong className="text-foreground">{formatCurrency(preview.totalCost)}</strong>
            </>
          )}
        </span>
      </div>

      {/* 3 Modos */}
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={label}>
        <button
          type="button"
          role="radio"
          id={`${idPrefix}-mode-batch`}
          aria-checked={value.mode === "batch"}
          disabled={!hasStock}
          onClick={() => setMode("batch")}
          title={hasStock ? "Descontar de um lote ativo em estoque" : "Nenhum lote em estoque neste painel"}
          className={cn(
            "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
            value.mode === "batch"
              ? "border-primary/70 bg-muted text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          <Layers className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">{hasStock ? "Lote em estoque" : "Sem lote"}</span>
        </button>

        <button
          type="button"
          role="radio"
          id={`${idPrefix}-mode-default`}
          aria-checked={value.mode === "panel_default"}
          onClick={() => setMode("panel_default")}
          className={cn(
            "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap transition-colors duration-150",
            value.mode === "panel_default"
              ? "border-primary/70 bg-muted text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          <Coins className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">Padrão ({formatCurrency(panel.credit_cost)})</span>
        </button>

        <button
          type="button"
          role="radio"
          id={`${idPrefix}-mode-custom`}
          aria-checked={value.mode === "custom"}
          onClick={() => setMode("custom")}
          className={cn(
            "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium whitespace-nowrap transition-colors duration-150",
            value.mode === "custom"
              ? "border-primary/70 bg-muted text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">Valor avulso</span>
        </button>
      </div>

      {/* Detalhe do modo ativo */}
      {value.mode === "batch" && hasStock && (
        <div className="space-y-1.5 pt-0.5">
          <NativeSelect
            id={`${idPrefix}-batch-select`}
            value={preview.selectedBatch?.id ?? ""}
            onChange={(e) => {
              const b = availableBatches.find((x) => x.id === e.target.value);
              if (!b) return;
              onChange({
                mode: "batch",
                batchId: b.id,
                customUnitCost: numberToCurrencyInput(b.unit_cost),
              });
            }}
            className="h-9 bg-card text-xs sm:text-sm"
            aria-label="Selecionar lote de créditos"
          >
            {availableBatches.map((b, idx) => (
              <option key={b.id} value={b.id}>
                {b.label} — {formatCurrency(b.unit_cost)}/cr (restam {b.quantity_remaining}/{b.quantity_total})
                {idx === 0 ? " · FIFO" : ""}
              </option>
            ))}
          </NativeSelect>
          {preview.insufficientStock && preview.selectedBatch && (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>
                Este lote possui apenas <strong>{preview.selectedBatch.quantity_remaining}</strong> crédito(s)
                restante(s) para os <strong>{creditsUsed}</strong> solicitados. Você ainda pode confirmar ou trocar a
                origem.
              </span>
            </p>
          )}
        </div>
      )}

      {value.mode === "panel_default" && (
        <p className="text-[11px] leading-snug text-subtle-foreground">
          Usa o custo de referência de <strong className="text-muted-foreground">{panel.name}</strong> (
          {formatCurrency(panel.credit_cost)}/crédito), sem movimentar o estoque de lotes.
        </p>
      )}

      {value.mode === "custom" && (
        <div className="space-y-1 pt-0.5">
          <div className="relative">
            <CurrencyPrefix />
            <Input
              id={`${idPrefix}-custom-unit-cost`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0,00"
              value={value.customUnitCost}
              onChange={(e) =>
                onChange({
                  mode: "custom",
                  batchId: "",
                  customUnitCost: maskCurrency(e.target.value) || "0,00",
                })
              }
              className="h-9 bg-card pl-10 text-sm tabular-nums"
              aria-label="Custo unitário do crédito (R$)"
            />
          </div>
          <p className="text-[11px] leading-snug text-subtle-foreground">
            Custo unitário por crédito (use <strong className="text-muted-foreground">0,00</strong> para crédito
            brinde). Não altera o estoque de lotes.
          </p>
        </div>
      )}
    </div>
  );
}
