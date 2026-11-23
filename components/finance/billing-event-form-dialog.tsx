"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Home, Loader2, Receipt, Save, Store } from "lucide-react";
import { toast } from "sonner";
import { createBillingEvent, updateBillingEvent } from "@/app/actions/finance";
import { CurrencyPrefix, FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip, LabelWithInfo } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { RESELLER_COMMISSION, isInternalCustomer } from "@/lib/business";
import { BILLING_EVENT_TYPE_LABEL } from "@/lib/expenses";
import { billingEventFormSchema, type BillingEventFormValues } from "@/lib/finance-validations";
import { formatCurrency, maskCurrency, numberToCurrencyInput, parseCurrency } from "@/lib/format";
import { getCurrentMonth } from "@/lib/month";
import { getAvailableBatchesForPanel, getFifoBatchForPanel } from "@/components/finance/credit-source-selector";
import { round2 } from "@/lib/business";
import type { BillingEvent, FinanceCustomer, Panel, PanelCreditBatch } from "@/lib/types";
import { BILLING_EVENT_TYPES } from "@/lib/types";
import { cn } from "@/lib/utils";

const ZERO = "0,00";

function getDefaults(event: BillingEvent | null, month: string, today: string): BillingEventFormValues {
  if (event) {
    return {
      customer_id: event.customer_id ?? "",
      customer_name_snapshot: event.customer_name_snapshot,
      panel_id: event.panel_id ?? "",
      event_type: event.event_type,
      reference_month: event.reference_month,
      event_date: event.event_date,
      gross_amount: numberToCurrencyInput(event.gross_amount),
      commission_amount: numberToCurrencyInput(event.commission_amount),
      credit_cost: numberToCurrencyInput(event.credit_cost),
      credits_used: event.credits_used ?? 1,
      credit_batch_id: event.credit_batch_id ?? "",
      is_reseller: event.is_reseller,
      is_internal: event.is_internal,
      notes: event.notes ?? "",
    };
  }
  return {
    customer_id: "",
    customer_name_snapshot: "",
    panel_id: "",
    event_type: "renewal",
    reference_month: month,
    event_date: month === getCurrentMonth(today) ? today : `${month}-01`,
    gross_amount: "",
    commission_amount: ZERO,
    credit_cost: ZERO,
    credits_used: 1,
    credit_batch_id: "",
    is_reseller: false,
    is_internal: false,
    notes: "",
  };
}

/** Lançamento manual / correção de um registro do Livro-Razão (`billing_events`). */
export function BillingEventFormDialog({
  open,
  onOpenChange,
  event,
  month,
  today,
  customers,
  panels,
  batches = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: BillingEvent | null;
  month: string;
  today: string;
  customers: FinanceCustomer[];
  panels: Panel[];
  batches?: PanelCreditBatch[];
}) {
  const isEdit = Boolean(event);
  const [pending, startTransition] = useTransition();
  const form = useForm<BillingEventFormValues>({
    resolver: zodResolver(billingEventFormSchema),
    defaultValues: getDefaults(event, month, today),
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
    if (open) reset(getDefaults(event, month, today));
  }, [open, event, month, today, reset]);

  const isInternal = watch("is_internal");
  const selectedPanelId = watch("panel_id") ?? "";
  const creditsUsed = watch("credits_used") ?? 1;
  const selectedBatchId = watch("credit_batch_id") ?? "";
  const gross = parseCurrency(watch("gross_amount") || "0");
  const commission = parseCurrency(watch("commission_amount") || "0");
  const credit = parseCurrency(watch("credit_cost") || "0");
  const net = (isInternal ? 0 : (gross || 0) - (commission || 0)) - (credit || 0);

  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [customers],
  );
  const panelById = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels]);
  const panelBatches = useMemo(
    () => getAvailableBatchesForPanel(batches, selectedPanelId),
    [batches, selectedPanelId],
  );

  const opts = { shouldDirty: true, shouldValidate: true } as const;

  function applyPanelAndBatch(nextPanelId: string, qty: number) {
    const panel = panelById.get(nextPanelId);
    if (!panel) {
      setValue("credit_batch_id", "", opts);
      setValue("credit_cost", ZERO, opts);
      return;
    }
    const fifo = !isEdit ? getFifoBatchForPanel(batches, panel.id) : null;
    if (fifo) {
      setValue("credit_batch_id", fifo.id, opts);
      setValue("credit_cost", numberToCurrencyInput(round2(fifo.unit_cost * qty)), opts);
    } else {
      setValue("credit_batch_id", "", opts);
      setValue("credit_cost", numberToCurrencyInput(round2(panel.credit_cost * qty)), opts);
    }
  }

  /** Ao escolher um cliente, preenche nome, painel, valores e flags a partir do cadastro. */
  function applyCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    const internal = isInternalCustomer(c);
    const panel = c.panel_id ? panelById.get(c.panel_id) : undefined;
    setValue("customer_name_snapshot", c.name, opts);
    setValue("panel_id", panel ? panel.id : "", opts);
    setValue("is_internal", internal, opts);
    setValue("is_reseller", c.is_reseller, opts);
    setValue("gross_amount", internal ? ZERO : numberToCurrencyInput(Math.max(0, c.plan_value)), opts);
    setValue("commission_amount", c.is_reseller && !internal ? numberToCurrencyInput(RESELLER_COMMISSION) : ZERO, opts);
    applyPanelAndBatch(panel ? panel.id : "", Math.max(1, Number(creditsUsed) || 1));
  }

  function withMask(registration: UseFormRegisterReturn): UseFormRegisterReturn {
    return {
      ...registration,
      onChange: (e) => {
        const target = e.target as HTMLInputElement;
        target.value = maskCurrency(target.value);
        return registration.onChange(e);
      },
    };
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = event ? await updateBillingEvent(event.id, values) : await createBillingEvent(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) setError(field as keyof BillingEventFormValues, { message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" strokeWidth={1.75} />
            {isEdit ? "Editar lançamento" : "Lançamento manual"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Corrija os valores deste registro do Livro-Razão."
              : "Registre uma entrada em qualquer mês — ideal para preencher o histórico retroativo."}
          </DialogDescription>
        </DialogHeader>

        <form id="billing-event-form" onSubmit={onSubmit} noValidate className="-mx-1 overflow-y-auto px-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Cliente cadastrado" htmlFor="event-customer" error={errors.customer_id?.message} optional>
              <NativeSelect
                id="event-customer"
                aria-invalid={Boolean(errors.customer_id)}
                {...register("customer_id", { onChange: (e) => applyCustomer(e.target.value) })}
              >
                <option value="">— Avulso / sem vínculo —</option>
                {sortedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.canceled_at ? " (cancelado)" : ""}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label="Nome no lançamento" htmlFor="event-name" error={errors.customer_name_snapshot?.message}>
              <Input id="event-name" maxLength={120} autoComplete="off" {...register("customer_name_snapshot")} />
            </FormField>

            <FormField label="Tipo" htmlFor="event-type" error={errors.event_type?.message}>
              <NativeSelect id="event-type" {...register("event_type")}>
                {BILLING_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {BILLING_EVENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label="Painel" htmlFor="event-panel" error={errors.panel_id?.message} optional>
              <NativeSelect
                id="event-panel"
                aria-invalid={Boolean(errors.panel_id)}
                {...register("panel_id", {
                  onChange: (e) => applyPanelAndBatch(e.target.value, Math.max(1, Number(creditsUsed) || 1)),
                })}
              >
                <option value="">Sem painel</option>
                {panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.credit_cost)}/crédito{p.is_active ? "" : " (inativo)"}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            {selectedPanelId && (
              <FormField
                label="Lote de créditos"
                htmlFor="event-batch"
                info="creditBatchesFifo"
                error={errors.credit_batch_id?.message}
                optional
                className="sm:col-span-2"
                hint={
                  isEdit
                    ? "Altere o custo total abaixo se precisar corrigir o valor histórico."
                    : "Ao escolher um lote, o banco desconta os créditos do estoque automaticamente."
                }
              >
                <NativeSelect
                  id="event-batch"
                  value={selectedBatchId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setValue("credit_batch_id", nextId, opts);
                    const qty = Math.max(1, Number(creditsUsed) || 1);
                    const batch = batches.find((b) => b.id === nextId);
                    if (batch) {
                      setValue("credit_cost", numberToCurrencyInput(round2(batch.unit_cost * qty)), opts);
                    } else {
                      const panel = panelById.get(selectedPanelId);
                      if (panel) {
                        setValue("credit_cost", numberToCurrencyInput(round2(panel.credit_cost * qty)), opts);
                      }
                    }
                  }}
                >
                  <option value="">
                    — Custo padrão do painel / valor manual (sem baixar lote) —
                  </option>
                  {panelBatches.map((b, idx) => (
                    <option key={b.id} value={b.id}>
                      {b.label} — {formatCurrency(b.unit_cost)}/cr (restam {b.quantity_remaining}/{b.quantity_total})
                      {idx === 0 ? " · FIFO" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}

            <FormField
              label="Mês de referência"
              htmlFor="event-month"
              error={errors.reference_month?.message}
              hint="Mês em que o valor entra no DRE."
            >
              <MonthPicker
                id="event-month"
                value={watch("reference_month")}
                onChange={(m) => setValue("reference_month", m, { shouldDirty: true, shouldValidate: true })}
                currentMonth={getCurrentMonth(today)}
                invalid={Boolean(errors.reference_month)}
              />
            </FormField>

            <FormField label="Data do pagamento" htmlFor="event-date" error={errors.event_date?.message}>
              <Input
                id="event-date"
                type="date"
                {...register("event_date", {
                  onChange: (e) => {
                    const v = String(e.target.value);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setValue("reference_month", v.slice(0, 7), { shouldDirty: true, shouldValidate: true });
                  },
                })}
              />
            </FormField>

            <FormField label="Valor bruto recebido" htmlFor="event-gross" error={errors.gross_amount?.message} info="gross">
              <div className="relative">
                <CurrencyPrefix />
                <Input
                  id="event-gross"
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  readOnly={isInternal}
                  className={cn("pl-10 tabular-nums", isInternal && "cursor-not-allowed opacity-60")}
                  {...withMask(register("gross_amount"))}
                />
              </div>
            </FormField>

            <FormField label="Comissão do revendedor" htmlFor="event-commission" error={errors.commission_amount?.message} info="commissions">
              <div className="relative">
                <CurrencyPrefix />
                <Input
                  id="event-commission"
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  readOnly={isInternal}
                  className={cn("pl-10 tabular-nums", isInternal && "cursor-not-allowed opacity-60")}
                  {...withMask(register("commission_amount"))}
                />
              </div>
            </FormField>

            <FormField
              label="Créditos consumidos"
              htmlFor="event-credits-used"
              error={errors.credits_used?.message}
              hint="Ex.: 1 para mensal, 3 para trimestral."
            >
              <Input
                id="event-credits-used"
                type="number"
                min={1}
                max={120}
                value={creditsUsed}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  const qty = Number.isFinite(n) && n >= 1 ? Math.min(120, n) : 1;
                  setValue("credits_used", qty, opts);
                  const batch = selectedBatchId ? batches.find((b) => b.id === selectedBatchId) : undefined;
                  const panel = selectedPanelId ? panelById.get(selectedPanelId) : undefined;
                  const unit = batch ? batch.unit_cost : panel ? panel.credit_cost : null;
                  if (unit !== null) {
                    setValue("credit_cost", numberToCurrencyInput(round2(unit * qty)), opts);
                  }
                }}
                className="tabular-nums"
              />
            </FormField>

            <FormField
              label="Custo total do(s) crédito(s)"
              htmlFor="event-credit"
              info="creditsByPanel"
              error={errors.credit_cost?.message}
              hint="Calculado por lote/painel, mas livre para editar (inclusive 0,00)."
            >
              <div className="relative">
                <CurrencyPrefix />
                <Input
                  id="event-credit"
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  className="pl-10 tabular-nums"
                  {...withMask(register("credit_cost"))}
                />
              </div>
            </FormField>

            <div className="flex flex-col justify-end gap-2">
              <label
                htmlFor="event-internal"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                  isInternal
                    ? "border-border bg-muted text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <input
                  id="event-internal"
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                  {...register("is_internal", {
                    onChange: (e) => {
                      if (e.target.checked) {
                        setValue("gross_amount", ZERO, opts);
                        setValue("commission_amount", ZERO, opts);
                      }
                    },
                  })}
                />
                <Home className="size-3.5 shrink-0" aria-hidden="true" />
                Uso interno (sem receita)
                <InfoTip term="internalUse" className="-my-0.5 ml-auto" />
              </label>
              <label
                htmlFor="event-reseller"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <input
                  id="event-reseller"
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer accent-primary"
                  {...register("is_reseller", {
                    onChange: (e) => {
                      if (!isInternal) {
                        setValue(
                          "commission_amount",
                          e.target.checked ? numberToCurrencyInput(RESELLER_COMMISSION) : ZERO,
                          opts,
                        );
                      }
                    },
                  })}
                />
                <Store className="size-3.5 shrink-0" aria-hidden="true" />
                Cliente de revendedor
              </label>
            </div>

            <FormField label="Observações" htmlFor="event-notes" error={errors.notes?.message} optional className="sm:col-span-2">
              <Textarea id="event-notes" rows={2} maxLength={500} placeholder="Ex.: pago via Pix, mês 1..." {...register("notes")} />
            </FormField>
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <LabelWithInfo term="eventResult">Resultado para a casa:</LabelWithInfo>
            <strong className={cn("font-medium tabular-nums", net < 0 ? "text-destructive" : "text-foreground")}>
              {formatCurrency(Number.isFinite(net) ? net : 0)}
            </strong>
          </p>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button id="billing-event-submit" type="submit" form="billing-event-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {isEdit ? "Salvar lançamento" : "Registrar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
