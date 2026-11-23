"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CalendarPlus, Loader2, Minus, Monitor, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { renewCustomer } from "@/app/actions/customers";
import type { EnrichedCustomer } from "@/components/customers/types";
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
import { CurrencyPrefix } from "@/components/ui/form-field";
import { InfoTip, LabelWithInfo } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_RENEW_PRICES,
  RENEW_MONTH_OPTIONS,
  RENEW_PERIOD_META,
  RENEW_SCREEN_OPTIONS,
  getDefaultCreditsUsed,
  getSuggestedRenewPrice,
  isInternalCustomer,
  type RenewMonths,
  type RenewScreens,
} from "@/lib/business";
import { addDaysISO, addMonthsISO, describeDays, formatDateBR, getTodayISO, isValidISODate } from "@/lib/date";
import { formatCurrency, maskCurrency, numberToCurrencyInput, parseCurrency } from "@/lib/format";
import type { CreditSourceValue, RenewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type BaseExpiryMode = "from_expiry" | "from_today";

function detectInitialScreens(planValue: number): RenewScreens {
  if (Math.abs(planValue - DEFAULT_RENEW_PRICES[1][2]) < 0.01) return 2;
  if (Math.abs(planValue - DEFAULT_RENEW_PRICES[1][3]) < 0.01) return 3;
  return 1;
}

function computeNextExpiry(currentExpiresAt: string, today: string, months: RenewMonths, baseMode: BaseExpiryMode): string {
  if (baseMode === "from_today") {
    return months === 2 ? addDaysISO(today, 60) : addMonthsISO(today, months);
  }
  return months === 2 ? addDaysISO(currentExpiresAt, 60) : addMonthsISO(currentExpiresAt, months);
}

export function RenewButton({ customer, className }: { customer: EnrichedCustomer; className?: string }) {
  const [open, setOpen] = useState(false);
  const isCanceled = Boolean(customer.canceled_at);

  return (
    <>
      <Button
        id={`renew-${customer.id}`}
        variant="success"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("tabular-nums", className)}
        title={isCanceled ? `Reativar ${customer.name}` : `Opções de renovação para ${customer.name}`}
      >
        <CalendarPlus />
        {isCanceled ? "Reativar" : "Renovar"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          {open && <RenewModalBody customer={customer} onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RenewModalBody({ customer, onClose }: { customer: EnrichedCustomer; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const today = getTodayISO();
  const isExpired = customer.days < 0;
  const isCanceled = Boolean(customer.canceled_at);
  const isInternal = isInternalCustomer(customer);

  const initialScreens = detectInitialScreens(customer.plan_value);
  const initialBaseMode: BaseExpiryMode = isExpired || isCanceled ? "from_today" : "from_expiry";

  const [months, setMonths] = useState<RenewMonths>(1);
  const [screens, setScreens] = useState<RenewScreens>(initialScreens);
  const [baseMode, setBaseMode] = useState<BaseExpiryMode>(initialBaseMode);
  const [expiresAt, setExpiresAt] = useState<string>(() =>
    computeNextExpiry(customer.expires_at, today, 1, initialBaseMode),
  );
  const [paymentDate, setPaymentDate] = useState<string>(today);
  const [grossInput, setGrossInput] = useState<string>(() => {
    if (isInternal) return "0,00";
    const currentVal = Math.max(0, customer.plan_value);
    return numberToCurrencyInput(currentVal > 0 ? currentVal : getSuggestedRenewPrice(1, initialScreens));
  });
  const [creditsUsed, setCreditsUsed] = useState<number>(() => getDefaultCreditsUsed(1));
  const [creditSource, setCreditSource] = useState<CreditSourceValue>(() =>
    getDefaultCreditSourceForPanel(customer.panel, customer.panelBatches),
  );
  const [updatePlanValue, setUpdatePlanValue] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  function selectPeriod(nextMonths: RenewMonths) {
    setMonths(nextMonths);
    setExpiresAt(computeNextExpiry(customer.expires_at, today, nextMonths, baseMode));
    setCreditsUsed(getDefaultCreditsUsed(nextMonths));
    if (!isInternal) {
      setGrossInput(numberToCurrencyInput(getSuggestedRenewPrice(nextMonths, screens)));
    }
    setError(null);
  }

  function selectScreens(nextScreens: RenewScreens) {
    setScreens(nextScreens);
    if (!isInternal) {
      setGrossInput(numberToCurrencyInput(getSuggestedRenewPrice(months, nextScreens)));
    }
    setError(null);
  }

  function selectBaseMode(nextBase: BaseExpiryMode) {
    setBaseMode(nextBase);
    setExpiresAt(computeNextExpiry(customer.expires_at, today, months, nextBase));
    setError(null);
  }

  const expiryByCycle = computeNextExpiry(customer.expires_at, today, months, "from_expiry");
  const expiryFromToday = computeNextExpiry(customer.expires_at, today, months, "from_today");
  const parsedGross = isInternal ? 0 : parseCurrency(grossInput || "0");
  const creditPreview = resolveCreditSourcePreview({
    panel: customer.panel,
    batches: customer.panelBatches,
    value: creditSource,
    creditsUsed,
  });

  function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidISODate(expiresAt)) {
      setError("Informe uma data de vencimento válida.");
      return;
    }
    if (!isValidISODate(paymentDate)) {
      setError("Informe uma data de pagamento válida.");
      return;
    }
    if (!isInternal && (!Number.isFinite(parsedGross) || parsedGross < 0)) {
      setError("Informe um valor válido para a renovação.");
      return;
    }

    const mode: RenewMode = baseMode;
    startTransition(async () => {
      const result = await renewCustomer({
        customerId: customer.id,
        months,
        screens,
        mode,
        expires_at: expiresAt,
        payment_date: paymentDate,
        gross_amount: isInternal ? "0,00" : grossInput,
        credits_used: creditsUsed,
        update_plan_value: updatePlanValue,
        credit_source_mode: creditSource.mode,
        credit_batch_id: creditSource.mode === "batch" ? (creditPreview.selectedBatch?.id ?? "") : "",
        custom_credit_cost:
          creditSource.mode === "custom" ? creditSource.customUnitCost : numberToCurrencyInput(creditPreview.unitCost),
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
      onClose();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-1.5">
          <CalendarPlus className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {isCanceled ? "Reativar" : "Renovar"} {customer.name}
          </span>
          <InfoTip term="renewalOptions" />
        </DialogTitle>
        <DialogDescription>
          Vencimento atual: <strong className="text-foreground tabular-nums">{formatDateBR(customer.expires_at)}</strong>{" "}
          ({describeDays(customer.days).toLowerCase()}).
        </DialogDescription>
      </DialogHeader>

      <form id="renew-customer-form" onSubmit={handleConfirm} noValidate className="-mx-1 space-y-4 overflow-y-auto px-1">
        {/* 1. Período */}
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Período da renovação</legend>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Período da renovação">
            {RENEW_MONTH_OPTIONS.map((m) => {
              const selected = months === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  id={`renew-period-${m}`}
                  onClick={() => selectPeriod(m)}
                  className={cn(
                    "flex h-9 cursor-pointer items-center justify-center rounded-lg border px-2 text-xs font-medium whitespace-nowrap transition-colors duration-150 sm:text-[13px]",
                    selected
                      ? "border-primary/70 bg-muted text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {RENEW_PERIOD_META[m].short}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Quantidade de telas + preços da tabela */}
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Quantidade de telas (tabela sugerida)</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Quantidade de telas">
            {RENEW_SCREEN_OPTIONS.map((s) => {
              const suggested = getSuggestedRenewPrice(months, s);
              const selected = screens === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  id={`renew-screens-${s}`}
                  onClick={() => selectScreens(s)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors duration-150",
                    selected
                      ? "border-primary/70 bg-muted text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Monitor className="size-3.5 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
                    {s} {s === 1 ? "tela" : "telas"}
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {isInternal ? "Uso interno (R$ 0)" : formatCurrency(suggested)}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 3. Valor cobrado (customizável) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="renew-gross-amount">Valor cobrado nesta renovação</Label>
            {!isInternal && Math.abs(parsedGross - customer.plan_value) > 0.01 && (
              <button
                type="button"
                onClick={() => setGrossInput(numberToCurrencyInput(Math.max(0, customer.plan_value)))}
                className="cursor-pointer text-xs text-primary-ink hover:underline"
              >
                Usar valor do cadastro ({formatCurrency(customer.plan_value)})
              </button>
            )}
          </div>
          <div className="relative">
            <CurrencyPrefix />
            <Input
              id="renew-gross-amount"
              inputMode="numeric"
              autoComplete="off"
              readOnly={isInternal}
              value={grossInput}
              onChange={(e) => {
                setGrossInput(maskCurrency(e.target.value));
                setError(null);
              }}
              className={cn("pl-10 tabular-nums", isInternal && "cursor-not-allowed opacity-60")}
            />
          </div>
          {!isInternal && (
            <label
              htmlFor="renew-update-plan-value"
              className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <input
                id="renew-update-plan-value"
                type="checkbox"
                checked={updatePlanValue}
                onChange={(e) => setUpdatePlanValue(e.target.checked)}
                className="size-4 shrink-0 cursor-pointer accent-primary"
              />
              <span>
                Atualizar valor padrão no cadastro do cliente para{" "}
                <strong className="font-medium text-foreground tabular-nums">
                  {formatCurrency(Number.isFinite(parsedGross) ? parsedGross : 0)}
                </strong>
              </span>
            </label>
          )}
        </div>

        {/* 4. Como contar o vencimento + Datas editáveis */}
        <div className="space-y-2.5 rounded-lg border border-border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">Cálculo do novo vencimento</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              id={`renew-cycle-${customer.id}`}
              onClick={() => selectBaseMode("from_expiry")}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors duration-150",
                baseMode === "from_expiry"
                  ? "border-primary/70 bg-muted text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              <RotateCcw className="mt-0.5 size-4 shrink-0 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-foreground">Somar ao vencimento atual</span>
                <span className="block text-[11px] text-muted-foreground">
                  Mantém dias restantes → <strong className="text-foreground tabular-nums">{formatDateBR(expiryByCycle)}</strong>
                </span>
              </span>
            </button>

            <button
              type="button"
              id={`renew-today-${customer.id}`}
              onClick={() => selectBaseMode("from_today")}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors duration-150",
                baseMode === "from_today"
                  ? "border-primary/70 bg-muted text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-foreground">Contar a partir de hoje</span>
                <span className="block text-[11px] text-muted-foreground">
                  Hoje + {RENEW_PERIOD_META[months].short} →{" "}
                  <strong className="text-foreground tabular-nums">{formatDateBR(expiryFromToday)}</strong>
                </span>
              </span>
            </button>
          </div>

          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="renew-expires-date" className="text-xs">
                Novo vencimento (editável)
              </Label>
              <Input
                id="renew-expires-date"
                type="date"
                value={expiresAt}
                onChange={(e) => {
                  setExpiresAt(e.target.value);
                  setError(null);
                }}
                className="h-9 bg-card tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="renew-payment-date" className="text-xs">
                Data do pagamento
              </Label>
              <Input
                id="renew-payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => {
                  setPaymentDate(e.target.value);
                  setError(null);
                }}
                className="h-9 bg-card tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* 5. Créditos consumidos e origem/lote no painel (visão admin quando há painel vinculado) */}
        {customer.panel && (
          <div className="space-y-3 rounded-lg border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LabelWithInfo term="renewalCredits" className="text-xs font-medium">
                Créditos consumidos ({customer.panel.name})
              </LabelWithInfo>
              <span className="text-xs text-muted-foreground tabular-nums">
                {creditsUsed} × {formatCurrency(creditPreview.unitCost)} ={" "}
                <strong className="text-foreground">{formatCurrency(creditPreview.totalCost)}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCreditsUsed((c) => Math.max(0, c - 1))}
                  disabled={creditsUsed <= 0}
                  aria-label="Diminuir créditos"
                >
                  <Minus />
                </Button>
                <Input
                  id="renew-credits-used"
                  type="number"
                  min={0}
                  max={120}
                  value={creditsUsed}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    setCreditsUsed(Number.isFinite(n) ? Math.min(120, Math.max(0, n)) : 0);
                  }}
                  className="h-8 w-16 bg-card text-center tabular-nums"
                  aria-label="Quantidade de créditos consumidos"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCreditsUsed((c) => Math.min(120, c + 1))}
                  aria-label="Aumentar créditos"
                >
                  <Plus />
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCreditsUsed(months)}
                  className={cn(
                    "cursor-pointer rounded-md border px-2 py-1 transition-colors",
                    creditsUsed === months
                      ? "border-primary/70 bg-muted text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  1 cr/mês ({months})
                </button>
                {screens > 1 && (
                  <button
                    type="button"
                    onClick={() => setCreditsUsed(months * screens)}
                    className={cn(
                      "cursor-pointer rounded-md border px-2 py-1 transition-colors",
                      creditsUsed === months * screens
                        ? "border-primary/70 bg-muted text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    1 cr/tela ({months * screens})
                  </button>
                )}
              </div>
            </div>

            <CreditSourceSelector
              idPrefix={`renew-credit-${customer.id}`}
              label="Lote / custo unitário"
              panel={customer.panel}
              batches={customer.panelBatches}
              creditsUsed={creditsUsed}
              value={creditSource}
              onChange={setCreditSource}
              className="border-0 bg-transparent p-0 pt-1"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button id={`confirm-renew-${customer.id}`} type="submit" form="renew-customer-form" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
          Confirmar ({RENEW_PERIOD_META[months].short})
        </Button>
      </DialogFooter>
    </>
  );
}
