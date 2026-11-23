"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightLeft, CreditCard, Home, Loader2, Save, Server, Star, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createCustomer, updateCustomer } from "@/app/actions/customers";
import {
  CreditSourceSelector,
  getDefaultCreditSourceForPanel,
  resolveCreditSourcePreview,
} from "@/components/finance/credit-source-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField as Field } from "@/components/ui/form-field";
import { InfoTip } from "@/components/ui/info-tip";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { RESELLER_COMMISSION, RESELLER_DEFAULT_PLAN_VALUE, isInternalCustomer } from "@/lib/business";
import { addDaysISO, getTodayISO } from "@/lib/date";
import { formatCurrency, formatPhone, maskCurrency, maskMac, maskPhone, numberToCurrencyInput } from "@/lib/format";
import type { AppSuggestion, CreditSourceValue, Customer, PanelCreditBatch, PanelOption, UserRole } from "@/lib/types";
import { normalizeText, shortBrandLabel } from "@/lib/tv-apps";
import { getCustomerFormSchema, type CustomerFormValues } from "@/lib/validations";
import { cn } from "@/lib/utils";

const MAX_QUICK_SUGGESTIONS = 6;
const ZERO_VALUE = "0,00";

export function panelOptionLabel(panel: Pick<PanelOption, "name" | "credit_cost" | "is_active">): string {
  return `${panel.name} — ${formatCurrency(panel.credit_cost)}/crédito${panel.is_active ? "" : " (inativo)"}`;
}

function getDefaults(customer: Customer | null, role: UserRole): CustomerFormValues {
  if (customer) {
    // Compatibilidade: valor negativo legado vira o toggle "Uso interno" com valor 0.
    const internal = role === "admin" && isInternalCustomer(customer);
    return {
      name: customer.name,
      phone: formatPhone(customer.phone),
      mac_address: customer.mac_address,
      app_name: customer.app_name ?? "",
      plan_value: internal ? ZERO_VALUE : numberToCurrencyInput(Math.max(0, customer.plan_value)),
      expires_at: customer.expires_at,
      notes: customer.notes ?? "",
      payment_date: role === "admin" ? (customer.payment_date ?? "") : "",
      panel_id: role === "admin" ? (customer.panel_id ?? "") : "",
      is_internal: internal,
      charge_panel_migration: false,
      credit_source_mode: "panel_default",
      credit_batch_id: "",
      custom_credit_cost: "",
    };
  }
  return {
    name: "",
    phone: "",
    mac_address: "",
    app_name: "",
    plan_value: role === "reseller" ? numberToCurrencyInput(RESELLER_DEFAULT_PLAN_VALUE) : "",
    expires_at: addDaysISO(getTodayISO(), 30),
    notes: "",
    payment_date: "",
    panel_id: "",
    is_internal: false,
    charge_panel_migration: false,
    credit_source_mode: "panel_default",
    credit_batch_id: "",
    custom_credit_cost: "",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  appSuggestions?: AppSuggestion[];
  userRole: UserRole;
  /** Painéis cadastrados (somente admin; lista vazia para o revendedor). */
  panels?: PanelOption[];
  /** Lotes de crédito ativos (somente admin). */
  batches?: PanelCreditBatch[];
};

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  appSuggestions = [],
  userRole,
  panels = [],
  batches = [],
}: Props) {
  const isEdit = Boolean(customer);
  const isAdmin = userRole === "admin";
  const [pending, startTransition] = useTransition();

  // Mesmo schema que o servidor usa para o cargo (o servidor revalida com o cargo lido do banco).
  const schema = useMemo(() => getCustomerFormSchema(userRole), [userRole]);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues: getDefaults(customer, userRole),
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

  const appValue = watch("app_name") ?? "";
  const isInternal = isAdmin && watch("is_internal") === true;
  const selectedPanelId = watch("panel_id") ?? "";
  const chargeMigration = watch("charge_panel_migration") === true;
  const creditSourceMode = watch("credit_source_mode") ?? "panel_default";
  const creditBatchId = watch("credit_batch_id") ?? "";
  const customCreditCost = watch("custom_credit_cost") ?? "";

  const originalPanelId = customer?.panel_id ?? null;
  const selectedPanel = panels.find((p) => p.id === selectedPanelId) ?? null;
  const originalPanel = panels.find((p) => p.id === originalPanelId) ?? null;
  // Troca de painel = cliente já tinha painel e passou para outro (1º vínculo não conta).
  const panelChanged = isAdmin && isEdit && Boolean(originalPanelId) && selectedPanelId !== "" && selectedPanelId !== originalPanelId;

  const creditSourceValue: CreditSourceValue = useMemo(
    () => ({
      mode: creditSourceMode,
      batchId: creditBatchId,
      customUnitCost: customCreditCost,
    }),
    [creditSourceMode, creditBatchId, customCreditCost],
  );

  function applyCreditSource(next: CreditSourceValue) {
    setValue("credit_source_mode", next.mode, { shouldDirty: true });
    setValue("credit_batch_id", next.batchId, { shouldDirty: true });
    setValue("custom_credit_cost", next.customUnitCost, { shouldDirty: true });
  }

  const creditPreview = useMemo(
    () =>
      resolveCreditSourcePreview({
        panel: selectedPanel,
        batches,
        value: creditSourceValue,
        creditsUsed: 1,
      }),
    [selectedPanel, batches, creditSourceValue],
  );

  // Painéis ativos + o painel atual do cliente, mesmo que tenha sido desativado.
  const panelOptions = useMemo(
    () => panels.filter((p) => p.is_active || p.id === originalPanelId),
    [panels, originalPanelId],
  );

  // Chips rápidos: filtra pelo texto digitado; favoritos sempre no topo.
  const quickSuggestions = useMemo(() => {
    const q = normalizeText(appValue);
    const list = q ? appSuggestions.filter((s) => normalizeText(s.name).includes(q)) : appSuggestions;
    return list.slice(0, MAX_QUICK_SUGGESTIONS);
  }, [appSuggestions, appValue]);

  function pickApp(name: string) {
    setValue("app_name", name, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
  }

  /** Uso interno: sem faturamento (valor 0) — o custo vem do crédito do painel. */
  function setInternal(next: boolean) {
    setValue("is_internal", next, { shouldDirty: true });
    if (next) setValue("plan_value", ZERO_VALUE, { shouldDirty: true, shouldValidate: true });
  }

  // Recarrega os valores sempre que o modal abre (novo cliente ou outro cliente).
  useEffect(() => {
    if (open) reset(getDefaults(customer, userRole));
  }, [open, customer, userRole, reset]);

  // Ao detectar a troca de painel, já sugere lançar o crédito extra (o admin pode desmarcar).
  useEffect(() => {
    setValue("charge_panel_migration", panelChanged);
  }, [panelChanged, setValue]);

  // Quando o admin seleciona ou troca o painel, pré-seleciona automaticamente o lote FIFO daquele painel.
  useEffect(() => {
    if (!isAdmin) return;
    const panel = panels.find((p) => p.id === selectedPanelId) ?? null;
    const def = getDefaultCreditSourceForPanel(panel, batches);
    setValue("credit_source_mode", def.mode);
    setValue("credit_batch_id", def.batchId);
    setValue("custom_credit_cost", def.customUnitCost);
  }, [isAdmin, selectedPanelId, panels, batches, setValue]);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = customer ? await updateCustomer(customer.id, values) : await createCustomer(values);

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) setError(field as keyof CustomerFormValues, { message: messages[0] });
          }
        }
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
      onOpenChange(false);
    });
  });

  // Aplica máscara mantendo a integração com o react-hook-form.
  function withMask(registration: UseFormRegisterReturn, mask: (v: string) => string): UseFormRegisterReturn {
    return {
      ...registration,
      onChange: (event) => {
        const target = event.target as HTMLInputElement;
        target.value = mask(target.value);
        return registration.onChange(event);
      },
    };
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Save className="size-4 text-muted-foreground" strokeWidth={1.75} /> : <UserPlus className="size-4 text-muted-foreground" strokeWidth={1.75} />}
            {isEdit ? "Editar cliente" : "Novo cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize os dados da assinatura." : "Preencha os dados para cadastrar uma nova assinatura."}
          </DialogDescription>
        </DialogHeader>

        <form id="customer-form" onSubmit={onSubmit} noValidate className="-mx-1 overflow-y-auto px-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="customer-name" error={errors.name?.message} className="sm:col-span-2">
              <Input
                id="customer-name"
                placeholder="Ex.: João da Silva"
                autoComplete="off"
                maxLength={120}
                aria-invalid={Boolean(errors.name)}
                {...register("name")}
              />
            </Field>

            <Field label="WhatsApp" htmlFor="customer-phone" error={errors.phone?.message} optional>
              <Input
                id="customer-phone"
                type="tel"
                inputMode="numeric"
                placeholder="(11) 98765-4321"
                autoComplete="off"
                aria-invalid={Boolean(errors.phone)}
                {...withMask(register("phone"), maskPhone)}
              />
            </Field>

            <Field label="MAC Address" htmlFor="customer-mac" error={errors.mac_address?.message}>
              <Input
                id="customer-mac"
                placeholder="00:1A:2B:3C:4D:5E"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={17}
                className="font-mono uppercase"
                aria-invalid={Boolean(errors.mac_address)}
                {...withMask(register("mac_address"), maskMac)}
              />
            </Field>

            {/* Exclusivo admin: o revendedor não vê nem envia o painel. */}
            {isAdmin && (
              <Field
                label="Painel / Servidor"
                htmlFor="customer-panel"
                info="panel"
                error={errors.panel_id?.message}
                optional
                className="sm:col-span-2"
                hint={
                  panels.length === 0
                    ? "Nenhum painel cadastrado. Cadastre em Financeiro → Painéis."
                    : isInternal && !selectedPanel
                      ? "Selecione o painel para contabilizar o custo do crédito deste acesso interno."
                      : undefined
                }
              >
                <div className="relative">
                  <Server className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                  <NativeSelect
                    id="customer-panel"
                    className="pl-9"
                    aria-invalid={Boolean(errors.panel_id)}
                    {...register("panel_id")}
                  >
                    <option value="">Sem painel</option>
                    {panelOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {panelOptionLabel(p)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                {/* Cadastro de novo cliente: permite escolher o lote (FIFO) ou custo avulso do 1º crédito */}
                {!isEdit && selectedPanel && (
                  <CreditSourceSelector
                    idPrefix="customer-create-credit"
                    label="Origem e custo do crédito deste cadastro"
                    panel={selectedPanel}
                    batches={batches}
                    creditsUsed={1}
                    value={creditSourceValue}
                    onChange={applyCreditSource}
                  />
                )}

                {panelChanged && selectedPanel && (
                  <div className="space-y-2">
                    <label
                      htmlFor="customer-charge-migration"
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                        chargeMigration
                          ? "border-warning/30 bg-warning/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <input
                        id="customer-charge-migration"
                        type="checkbox"
                        checked={chargeMigration}
                        onChange={(e) => setValue("charge_panel_migration", e.target.checked, { shouldDirty: true })}
                        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                      />
                      <span className="flex items-start gap-1 leading-snug">
                        <ArrowRightLeft className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          Essa troca consumiu 1 crédito extra no novo painel?{" "}
                          <span className="font-medium">
                            (Lançar {formatCurrency(creditPreview.totalCost)} nas despesas do mês atual)
                          </span>
                          {originalPanel && (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {originalPanel.name} → {selectedPanel.name}
                            </span>
                          )}
                        </span>
                      </span>
                      <InfoTip term="panelMigration" className="-my-0.5 ml-auto" />
                    </label>
                    {chargeMigration && (
                      <CreditSourceSelector
                        idPrefix="customer-migration-credit"
                        label="Origem e custo do crédito da troca"
                        panel={selectedPanel}
                        batches={batches}
                        creditsUsed={1}
                        value={creditSourceValue}
                        onChange={applyCreditSource}
                      />
                    )}
                  </div>
                )}
              </Field>
            )}

            <Field label="Aplicativo" htmlFor="customer-app" error={errors.app_name?.message} optional>
              <Input
                id="customer-app"
                placeholder="Ex.: IPTV Smarters"
                autoComplete="off"
                maxLength={60}
                list={appSuggestions.length > 0 ? "customer-app-suggestions" : undefined}
                aria-invalid={Boolean(errors.app_name)}
                {...register("app_name")}
              />
              {appSuggestions.length > 0 && (
                <>
                  <datalist id="customer-app-suggestions">
                    {appSuggestions.map((s) => (
                      <option
                        key={s.name}
                        value={s.name}
                        label={`${s.isFavorite ? "Favorito · " : ""}${s.brands.map(shortBrandLabel).join(", ")}`}
                      />
                    ))}
                  </datalist>
                  {quickSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Sugestões do catálogo de apps">
                      {quickSuggestions.map((s) => {
                        const selected = normalizeText(appValue) === normalizeText(s.name);
                        return (
                          <button
                            key={s.name}
                            type="button"
                            id={`customer-app-suggestion-${normalizeText(s.name).replace(/[^a-z0-9]+/g, "-")}`}
                            onClick={() => pickApp(s.name)}
                            title={s.brands.join(" · ")}
                            aria-pressed={selected}
                            className={cn(
                              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer active:scale-95",
                              selected
                                ? "border-primary/60 bg-primary/20 text-foreground"
                                : s.isFavorite
                                  ? "border-warning/35 bg-warning/10 text-warning hover:bg-warning/20"
                                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            {s.isFavorite && <Star className="size-3 fill-current" />}
                            <span className="truncate">{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </Field>

            <Field
              label="Valor do plano"
              htmlFor="customer-value"
              error={errors.plan_value?.message}
              hint={
                isAdmin
                  ? isInternal
                    ? selectedPanel
                      ? `Sem faturamento. Custo real: ${formatCurrency(selectedPanel.credit_cost)}/mês (crédito do painel).`
                      : "Sem faturamento. O custo real vem do crédito do painel."
                    : undefined
                  : `Sua comissão: ${formatCurrency(RESELLER_COMMISSION)} por cliente ativo.`
              }
            >
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="customer-value"
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  readOnly={isInternal}
                  className={cn("pl-10 tabular-nums", isInternal && "cursor-not-allowed opacity-60")}
                  aria-invalid={Boolean(errors.plan_value)}
                  {...withMask(register("plan_value"), maskCurrency)}
                />
              </div>
              {isAdmin && (
                <label
                  htmlFor="customer-internal"
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                    isInternal
                      ? "border-border bg-muted text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  <input
                    id="customer-internal"
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setInternal(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <span className="flex items-start gap-1 leading-snug">
                    <Home className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    Uso interno / casa (sem faturamento)
                  </span>
                  <InfoTip term="internalUse" className="-my-0.5 ml-auto" />
                </label>
              )}
            </Field>

            <Field
              label="Vencimento"
              htmlFor="customer-expires"
              error={errors.expires_at?.message}
              hint="Data em que o sinal da TV cai."
              className={isAdmin ? undefined : "sm:col-span-2"}
            >
              <Input
                id="customer-expires"
                type="date"
                aria-invalid={Boolean(errors.expires_at)}
                {...register("expires_at")}
              />
            </Field>

            {/* Exclusivo admin: o revendedor nunca vê nem envia este campo. */}
            {isAdmin && (
              <Field
                label="Data do pagamento"
                htmlFor="customer-payment-date"
                info="paymentDate"
                error={errors.payment_date?.message}
                optional
                className="sm:col-span-2"
                hint="Só para casos isolados em que o cliente paga em data diferente do vencimento."
              >
                <div className="relative">
                  <CreditCard className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="customer-payment-date"
                    type="date"
                    className="pl-9"
                    aria-invalid={Boolean(errors.payment_date)}
                    {...register("payment_date")}
                  />
                </div>
              </Field>
            )}

            <Field label="Observações" htmlFor="customer-notes" error={errors.notes?.message} optional className="sm:col-span-2">
              <Textarea
                id="customer-notes"
                rows={3}
                maxLength={1000}
                placeholder="Ex.: usa 2 telas, paga via Pix..."
                aria-invalid={Boolean(errors.notes)}
                {...register("notes")}
              />
            </Field>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button id="customer-submit" type="submit" form="customer-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : isEdit ? <Save /> : <UserPlus />}
            {isEdit ? "Salvar alterações" : "Cadastrar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
