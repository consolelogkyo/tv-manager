"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ReceiptText, Save } from "lucide-react";
import { toast } from "sonner";
import { createExpense, updateExpense } from "@/app/actions/expenses";
import { CurrencyPrefix, FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/month-picker";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EXPENSE_CATEGORY_META } from "@/lib/expenses";
import { expenseFormSchema, type ExpenseFormValues } from "@/lib/finance-validations";
import { formatCurrency, maskCurrency, numberToCurrencyInput } from "@/lib/format";
import { getCurrentMonth } from "@/lib/month";
import { getAvailableBatchesForPanel, getFifoBatchForPanel } from "@/components/finance/credit-source-selector";
import type { Expense, ExpenseCategory, FinanceCustomer, Panel, PanelCreditBatch } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

function getDefaults(expense: Expense | null, month: string, today: string): ExpenseFormValues {
  if (expense) {
    return {
      title: expense.title,
      category: expense.category,
      amount: numberToCurrencyInput(expense.amount),
      expense_date: expense.expense_date,
      reference_month: expense.reference_month,
      customer_id: expense.customer_id ?? "",
      panel_id: expense.panel_id ?? "",
      credits_used: expense.credits_used ?? 0,
      credit_batch_id: expense.credit_batch_id ?? "",
      notes: expense.notes ?? "",
    };
  }
  return {
    title: "",
    category: "other",
    amount: "",
    expense_date: month === getCurrentMonth(today) ? today : `${month}-01`,
    reference_month: month,
    customer_id: "",
    panel_id: "",
    credits_used: 0,
    credit_batch_id: "",
    notes: "",
  };
}

/** Modal de criação/edição de despesa extra (custo invisível). */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  month,
  today,
  customers,
  panels,
  batches = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  month: string;
  today: string;
  customers: FinanceCustomer[];
  panels: Panel[];
  batches?: PanelCreditBatch[];
}) {
  const isEdit = Boolean(expense);
  const [pending, startTransition] = useTransition();
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: getDefaults(expense, month, today),
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
    if (open) reset(getDefaults(expense, month, today));
  }, [open, expense, month, today, reset]);

  const category = watch("category");
  const panelId = watch("panel_id");
  const selectedBatchId = watch("credit_batch_id") ?? "";
  const panelById = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels]);
  const panelBatches = useMemo(() => getAvailableBatchesForPanel(batches, panelId), [batches, panelId]);
  const sortedCustomers = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [customers],
  );

  const opts = { shouldDirty: true, shouldValidate: true } as const;

  /** "Troca de Painel" + painel escolhido → pré-seleciona o lote FIFO (se existir) ou o custo do painel. */
  function autofillFromPanel(nextCategory: ExpenseCategory, nextPanelId: string) {
    if (!nextPanelId) {
      setValue("credit_batch_id", "", opts);
      setValue("credits_used", 0, opts);
      return;
    }
    if (nextCategory !== "panel_migration") return;
    const fifo = getFifoBatchForPanel(batches, nextPanelId);
    const panel = panelById.get(nextPanelId);
    setValue("credits_used", 1, opts);
    if (fifo && fifo.unit_cost > 0) {
      setValue("credit_batch_id", fifo.id, opts);
      setValue("amount", numberToCurrencyInput(fifo.unit_cost), opts);
    } else {
      setValue("credit_batch_id", "", opts);
      if (panel && panel.credit_cost > 0) {
        setValue("amount", numberToCurrencyInput(panel.credit_cost), opts);
      }
    }
  }

  function pickCategory(next: ExpenseCategory) {
    setValue("category", next, { shouldDirty: true, shouldValidate: true });
    autofillFromPanel(next, panelId);
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = expense ? await updateExpense(expense.id, values) : await createExpense(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) setError(field as keyof ExpenseFormValues, { message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
    });
  });

  const amountRegistration = register("amount");

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-4 text-muted-foreground" strokeWidth={1.75} />
            {isEdit ? "Editar despesa" : "Nova despesa"}
          </DialogTitle>
          <DialogDescription>Custos extras que não aparecem nos cadastros, mas saem do lucro do mês.</DialogDescription>
        </DialogHeader>

        <form id="expense-form" onSubmit={onSubmit} noValidate className="-mx-1 overflow-y-auto px-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Descrição" htmlFor="expense-title" error={errors.title?.message} className="sm:col-span-2">
              <Input
                id="expense-title"
                maxLength={120}
                autoComplete="off"
                placeholder="Ex.: Chip Claro WhatsApp, Crédito extra troca de painel"
                {...register("title")}
              />
            </FormField>

            <fieldset className="space-y-1.5 sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium">Categoria</legend>
              <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap gap-1.5">
                {EXPENSE_CATEGORIES.map((c) => {
                  const meta = EXPENSE_CATEGORY_META[c];
                  const selected = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      id={`expense-category-${c}`}
                      onClick={() => pickCategory(c)}
                      className={cn(
                        "inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[13px] font-medium transition-colors duration-150",
                        selected ? "border-primary/60 bg-muted text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden="true" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              {errors.category?.message && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.category.message}
                </p>
              )}
            </fieldset>

            <FormField label="Painel" htmlFor="expense-panel" error={errors.panel_id?.message} optional>
              <NativeSelect
                id="expense-panel"
                {...register("panel_id", { onChange: (e) => autofillFromPanel(category, e.target.value) })}
              >
                <option value="">Nenhum</option>
                {panels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.credit_cost)}/crédito{p.is_active ? "" : " (inativo)"}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label="Cliente" htmlFor="expense-customer" error={errors.customer_id?.message} optional>
              <NativeSelect id="expense-customer" {...register("customer_id")}>
                <option value="">Nenhum</option>
                {sortedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.canceled_at ? " (cancelado)" : ""}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            {panelId && (
              <FormField
                label="Lote de créditos vinculado"
                htmlFor="expense-batch"
                info="creditBatchesFifo"
                error={errors.credit_batch_id?.message}
                optional
                className="sm:col-span-2"
                hint="Escolha um lote para usar o custo unitário dele (ex.: troca de painel)."
              >
                <NativeSelect
                  id="expense-batch"
                  value={selectedBatchId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setValue("credit_batch_id", nextId, opts);
                    const batch = batches.find((b) => b.id === nextId);
                    if (batch) {
                      setValue("credits_used", 1, opts);
                      if (batch.unit_cost > 0) {
                        setValue("amount", numberToCurrencyInput(batch.unit_cost), opts);
                      }
                    } else {
                      setValue("credits_used", category === "panel_migration" ? 1 : 0, opts);
                      const panel = panelById.get(panelId);
                      if (category === "panel_migration" && panel && panel.credit_cost > 0) {
                        setValue("amount", numberToCurrencyInput(panel.credit_cost), opts);
                      }
                    }
                  }}
                >
                  <option value="">— Sem lote (custo padrão do painel ou valor avulso) —</option>
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
              label="Valor"
              htmlFor="expense-amount"
              error={errors.amount?.message}
              hint={category === "panel_migration" ? "Escolha o painel para preencher com o custo do crédito." : undefined}
            >
              <div className="relative">
                <CurrencyPrefix />
                <Input
                  id="expense-amount"
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  className="pl-10 tabular-nums"
                  {...amountRegistration}
                  onChange={(e) => {
                    e.target.value = maskCurrency(e.target.value);
                    return amountRegistration.onChange(e);
                  }}
                />
              </div>
            </FormField>

            <FormField label="Data" htmlFor="expense-date" error={errors.expense_date?.message}>
              <Input
                id="expense-date"
                type="date"
                {...register("expense_date", {
                  onChange: (e) => {
                    const v = String(e.target.value);
                    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setValue("reference_month", v.slice(0, 7), { shouldDirty: true, shouldValidate: true });
                  },
                })}
              />
            </FormField>

            <FormField
              label="Mês de referência"
              htmlFor="expense-month"
              error={errors.reference_month?.message}
              hint="Mês do DRE em que a despesa será descontada."
              className="sm:col-span-2"
            >
              <div className="sm:w-56"><MonthPicker
                id="expense-month"
                value={watch("reference_month")}
                onChange={(m) => setValue("reference_month", m, { shouldDirty: true, shouldValidate: true })}
                currentMonth={getCurrentMonth(today)}
                invalid={Boolean(errors.reference_month)}
              /></div>
            </FormField>

            <FormField label="Observações" htmlFor="expense-notes" error={errors.notes?.message} optional className="sm:col-span-2">
              <Textarea id="expense-notes" rows={2} maxLength={500} {...register("notes")} />
            </FormField>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button id="expense-submit" type="submit" form="expense-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {isEdit ? "Salvar despesa" : "Lançar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
