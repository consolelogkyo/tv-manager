"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layers, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { createCreditBatch, updateCreditBatch } from "@/app/actions/panels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrencyPrefix, FormField } from "@/components/ui/form-field";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { round2 } from "@/lib/business";
import { creditBatchFormSchema, type CreditBatchFormValues } from "@/lib/finance-validations";
import { formatCurrency, maskCurrency, numberToCurrencyInput, parseCurrency } from "@/lib/format";
import type { Panel, PanelCreditBatch } from "@/lib/types";

function getDefaults(panel: Panel | null, batch: PanelCreditBatch | null, today: string): CreditBatchFormValues {
  if (batch) {
    return {
      panel_id: batch.panel_id,
      label: batch.label,
      unit_cost: numberToCurrencyInput(batch.unit_cost),
      quantity_total: batch.quantity_total,
      quantity_remaining: batch.quantity_remaining,
      purchased_at: batch.purchased_at,
      is_active: batch.is_active,
      notes: batch.notes ?? "",
    };
  }
  return {
    panel_id: panel?.id ?? "",
    label: "",
    unit_cost: panel ? numberToCurrencyInput(panel.credit_cost) : "0,00",
    quantity_total: 10,
    quantity_remaining: 10,
    purchased_at: today,
    is_active: true,
    notes: "",
  };
}

/**
 * Modal "+ Comprar / Registrar Lote" ou "Editar Lote":
 * sincroniza em tempo real Quantidade × Valor Unitário (R$/cr) ⇄ Valor Total Pago (R$).
 */
export function CreditBatchFormDialog({
  open,
  onOpenChange,
  panel,
  batch,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: Panel | null;
  batch: PanelCreditBatch | null;
  today: string;
}) {
  const isEdit = Boolean(batch);
  const [pending, startTransition] = useTransition();
  const [totalPaidInput, setTotalPaidInput] = useState("0,00");

  const form = useForm<CreditBatchFormValues>({
    resolver: zodResolver(creditBatchFormSchema),
    defaultValues: getDefaults(panel, batch, today),
    mode: "onTouched",
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!open) return;
    const defaults = getDefaults(panel, batch, today);
    reset(defaults);
    const unit = parseCurrency(defaults.unit_cost || "0");
    const total = round2((Number.isFinite(unit) ? unit : 0) * defaults.quantity_total);
    setTotalPaidInput(numberToCurrencyInput(total));
  }, [open, panel, batch, today, reset]);

  const quantityTotal = watch("quantity_total");
  const quantityRemaining = watch("quantity_remaining");
  const unitCostStr = watch("unit_cost");

  const opts = { shouldDirty: true, shouldValidate: true } as const;

  function handleQuantityTotalChange(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const qty = Number.isFinite(parsed) && parsed > 0 ? Math.min(10000, parsed) : 1;
    setValue("quantity_total", qty, opts);
    if (!isEdit) {
      setValue("quantity_remaining", qty, opts);
    } else if (quantityRemaining > qty) {
      setValue("quantity_remaining", qty, opts);
    }
    const unit = parseCurrency(unitCostStr || "0");
    if (Number.isFinite(unit) && unit >= 0) {
      setTotalPaidInput(numberToCurrencyInput(round2(unit * qty)));
    }
  }

  function handleUnitCostChange(raw: string) {
    const masked = maskCurrency(raw) || "0,00";
    setValue("unit_cost", masked, opts);
    const unit = parseCurrency(masked);
    const qty = Math.max(1, Number(quantityTotal) || 1);
    if (Number.isFinite(unit) && unit >= 0) {
      setTotalPaidInput(numberToCurrencyInput(round2(unit * qty)));
    }
  }

  function handleTotalPaidChange(raw: string) {
    const masked = maskCurrency(raw) || "0,00";
    setTotalPaidInput(masked);
    const total = parseCurrency(masked);
    const qty = Math.max(1, Number(quantityTotal) || 1);
    if (Number.isFinite(total) && total >= 0) {
      const unit = round2(total / qty);
      setValue("unit_cost", numberToCurrencyInput(unit), opts);
    }
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = batch ? await updateCreditBatch(batch.id, values) : await createCreditBatch(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) setError(field as keyof CreditBatchFormValues, { message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
    });
  });

  const unitNumeric = parseCurrency(unitCostStr || "0");
  const safeUnit = Number.isFinite(unitNumeric) ? unitNumeric : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <span>{isEdit ? "Editar lote de créditos" : `Comprar / registrar lote${panel ? ` · ${panel.name}` : ""}`}</span>
            <InfoTip term="inventoryVsDre" />
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ajuste o rótulo, o custo unitário ou o saldo restante deste lote."
              : "Registre uma compra de créditos (ex.: pacote promocional ou compra em volume). O custo entra no DRE conforme cada crédito é consumido."}
          </DialogDescription>
        </DialogHeader>

        <form id="credit-batch-form" onSubmit={onSubmit} noValidate className="-mx-1 grid gap-4 overflow-y-auto px-1">
          <input type="hidden" {...register("panel_id")} />

          <FormField
            label="Identificação / rótulo do lote"
            htmlFor="batch-label"
            error={errors.label?.message}
            hint="Ex.: Promoção 10 créditos, Pacote Black Friday, Lote Novembro."
          >
            <Input
              id="batch-label"
              maxLength={80}
              autoComplete="off"
              placeholder="Ex.: Promoção 10 créditos"
              {...register("label")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Quantidade comprada"
              htmlFor="batch-quantity-total"
              error={errors.quantity_total?.message}
            >
              <Input
                id="batch-quantity-total"
                type="number"
                min={1}
                max={10000}
                value={quantityTotal}
                onChange={(e) => handleQuantityTotalChange(e.target.value)}
                className="tabular-nums"
              />
            </FormField>

            <FormField
              label="Saldo restante em estoque"
              htmlFor="batch-quantity-remaining"
              error={errors.quantity_remaining?.message}
              hint={isEdit ? "Ajuste se já consumiu créditos fora do sistema." : "Igual ao total comprado."}
            >
              <Input
                id="batch-quantity-remaining"
                type="number"
                min={0}
                max={quantityTotal || 10000}
                value={quantityRemaining}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setValue("quantity_remaining", Number.isFinite(n) && n >= 0 ? n : 0, opts);
                }}
                className="tabular-nums"
              />
            </FormField>
          </div>

          <div className="grid gap-4 rounded-lg border border-border bg-background p-3 sm:grid-cols-2">
            <FormField
              label="Valor unitário (R$/crédito)"
              htmlFor="batch-unit-cost"
              error={errors.unit_cost?.message}
              hint="Preencha o unitário ou o total ao lado."
            >
              <div className="relative">
                <CurrencyPrefix />
                <Input
                  id="batch-unit-cost"
                  inputMode="numeric"
                  autoComplete="off"
                  value={unitCostStr}
                  onChange={(e) => handleUnitCostChange(e.target.value)}
                  className="bg-card pl-10 tabular-nums"
                />
              </div>
            </FormField>

            <FormField
              label="Valor total pago no lote"
              htmlFor="batch-total-paid"
              hint={`${quantityTotal || 0} cr × ${formatCurrency(safeUnit)}/cr`}
            >
              <div className="relative">
                <CurrencyPrefix />
                <Input
                  id="batch-total-paid"
                  inputMode="numeric"
                  autoComplete="off"
                  value={totalPaidInput}
                  onChange={(e) => handleTotalPaidChange(e.target.value)}
                  className="bg-card pl-10 tabular-nums"
                />
              </div>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data da compra" htmlFor="batch-purchased-at" error={errors.purchased_at?.message}>
              <Input id="batch-purchased-at" type="date" {...register("purchased_at")} />
            </FormField>

            <div className="flex items-end">
              <label
                htmlFor="batch-active"
                className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <input
                  id="batch-active"
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                  {...register("is_active")}
                />
                Lote ativo para uso
              </label>
            </div>
          </div>

          <FormField label="Observações" htmlFor="batch-notes" error={errors.notes?.message} optional>
            <Textarea
              id="batch-notes"
              rows={2}
              maxLength={500}
              placeholder="Ex.: pacote promocional comprado via Pix..."
              {...register("notes")}
            />
          </FormField>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button id="credit-batch-submit" type="submit" form="credit-batch-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {isEdit ? "Salvar lote" : "Registrar lote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
