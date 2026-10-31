"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Loader2, Save, Star, TrendingDown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createCustomer, updateCustomer } from "@/app/actions/customers";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RESELLER_COMMISSION, RESELLER_DEFAULT_PLAN_VALUE } from "@/lib/business";
import { addDaysISO, getTodayISO } from "@/lib/date";
import {
  formatCurrency,
  formatPhone,
  maskCurrency,
  maskMac,
  maskPhone,
  maskSignedCurrency,
  numberToCurrencyInput,
  toggleCurrencySign,
} from "@/lib/format";
import type { AppSuggestion, Customer, UserRole } from "@/lib/types";
import { normalizeText, shortBrandLabel } from "@/lib/tv-apps";
import { getCustomerFormSchema, type CustomerFormValues } from "@/lib/validations";
import { cn } from "@/lib/utils";

const MAX_QUICK_SUGGESTIONS = 6;

/** Valor sugerido ao marcar "custo interno" com o campo vazio. */
const DEFAULT_INTERNAL_COST = "-6,00";

function getDefaults(customer: Customer | null, role: UserRole): CustomerFormValues {
  if (customer) {
    return {
      name: customer.name,
      phone: formatPhone(customer.phone),
      mac_address: customer.mac_address,
      app_name: customer.app_name ?? "",
      plan_value: numberToCurrencyInput(customer.plan_value),
      expires_at: customer.expires_at,
      notes: customer.notes ?? "",
      payment_date: role === "admin" ? (customer.payment_date ?? "") : "",
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
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  appSuggestions?: AppSuggestion[];
  userRole: UserRole;
};

export function CustomerFormDialog({ open, onOpenChange, customer, appSuggestions = [], userRole }: Props) {
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
  const planValue = watch("plan_value") ?? "";
  const isInternalCost = isAdmin && planValue.trim().startsWith("-");

  // Chips rápidos: filtra pelo texto digitado; favoritos sempre no topo.
  const quickSuggestions = useMemo(() => {
    const q = normalizeText(appValue);
    const list = q ? appSuggestions.filter((s) => normalizeText(s.name).includes(q)) : appSuggestions;
    return list.slice(0, MAX_QUICK_SUGGESTIONS);
  }, [appSuggestions, appValue]);

  function pickApp(name: string) {
    setValue("app_name", name, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
  }

  /** Atalho do admin: alterna o sinal do valor (custo interno / desconto no saldo). */
  function setInternalCost(negative: boolean) {
    const unsigned = planValue.trim().replace(/^-+/, "");
    const next = negative && unsigned === "" ? DEFAULT_INTERNAL_COST : toggleCurrencySign(planValue, negative);
    setValue("plan_value", next, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
  }

  // Recarrega os valores sempre que o modal abre (novo cliente ou outro cliente).
  useEffect(() => {
    if (open) reset(getDefaults(customer, userRole));
  }, [open, customer, userRole, reset]);

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
          <DialogTitle className="flex items-center gap-2 font-display">
            {isEdit ? <Save className="size-5 text-primary" /> : <UserPlus className="size-5 text-primary" />}
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
                className="font-mono uppercase tracking-wider"
                aria-invalid={Boolean(errors.mac_address)}
                {...withMask(register("mac_address"), maskMac)}
              />
            </Field>

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
                        label={`${s.isFavorite ? "⭐ Favorito · " : ""}${s.brands.map(shortBrandLabel).join(", ")}`}
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
                              "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer active:scale-95",
                              selected
                                ? "border-primary/60 bg-primary/20 text-foreground"
                                : s.isFavorite
                                  ? "border-warning/35 bg-warning/10 text-warning hover:bg-warning/20"
                                  : "border-border/70 bg-card/50 text-muted-foreground hover:bg-muted hover:text-foreground",
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
                  ? isInternalCost
                    ? "Lançamento negativo: será abatido do saldo líquido."
                    : undefined
                  : `Sua comissão: ${formatCurrency(RESELLER_COMMISSION)} por cliente ativo.`
              }
            >
              <div className="relative">
                <span
                  className={cn(
                    "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm",
                    isInternalCost ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  R$
                </span>
                <Input
                  id="customer-value"
                  inputMode={isAdmin ? "decimal" : "numeric"}
                  placeholder={isAdmin ? "0,00 ou -6,00" : "0,00"}
                  autoComplete="off"
                  className={cn("pl-10 tabular-nums", isInternalCost && "text-destructive")}
                  aria-invalid={Boolean(errors.plan_value)}
                  {...withMask(register("plan_value"), isAdmin ? maskSignedCurrency : maskCurrency)}
                />
              </div>
              {isAdmin && (
                <label
                  htmlFor="customer-internal-cost"
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                    isInternalCost
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-border/70 bg-card/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <input
                    id="customer-internal-cost"
                    type="checkbox"
                    checked={isInternalCost}
                    onChange={(e) => setInternalCost(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-destructive"
                  />
                  <span className="flex items-start gap-1 leading-snug">
                    <TrendingDown className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    Lançar como Custo / Desconto no Saldo (Valor Negativo)
                  </span>
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
                label="Dia/Data do Pagamento"
                htmlFor="customer-payment-date"
                error={errors.payment_date?.message}
                optional
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

function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive animate-in fade-in slide-in-from-top-0.5">
          {error}
        </p>
      )}
    </div>
  );
}
