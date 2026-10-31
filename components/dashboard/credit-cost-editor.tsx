"use client";

import { useState, useTransition } from "react";
import { Coins, Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { updateCreditUnitCost } from "@/app/actions/settings";
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
import { getCreditsTotalCost } from "@/lib/business";
import { formatCurrency, maskCurrency, numberToCurrencyInput, parseCurrency } from "@/lib/format";
import { creditUnitCostSchema } from "@/lib/validations";

type Props = {
  /** Custo unitário atual (R$). */
  value: number;
  /** Clientes ativos pagantes — usado para pré-visualizar o novo total. */
  payingActiveCount: number;
};

/**
 * Botão de lápis + modal compacto para editar o custo unitário do crédito.
 * Validação Zod no cliente (UX) e novamente no servidor (`updateCreditUnitCost`).
 */
export function CreditCostEditor({ value, payingActiveCount }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsedPreview = creditUnitCostSchema.safeParse(parseCurrency(input));
  const previewTotal = parsedPreview.success ? getCreditsTotalCost(payingActiveCount, parsedPreview.data) : null;

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) {
      setInput(numberToCurrencyInput(value));
      setError(null);
    }
    setOpen(next);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = creditUnitCostSchema.safeParse(parseCurrency(input));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Valor inválido");
      return;
    }

    startTransition(async () => {
      const result = await updateCreditUnitCost(parsed.data);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        id="kpi-credit-cost-edit"
        type="button"
        onClick={() => handleOpenChange(true)}
        title="Editar custo do crédito"
        aria-label={`Editar custo do crédito (atual: ${formatCurrency(value)})`}
        className="relative -my-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
      >
        <Pencil className="size-3.5" />
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Coins className="size-5 text-violet-300" />
              Custo do crédito
            </DialogTitle>
            <DialogDescription>Valor pago por 1 crédito (1 cliente ativo pagante por mês).</DialogDescription>
          </DialogHeader>

          <form id="credit-cost-form" onSubmit={handleSubmit} noValidate className="space-y-1.5">
            <Label htmlFor="credit-cost-input">Custo unitário</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                R$
              </span>
              <Input
                id="credit-cost-input"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="5,00"
                value={input}
                onChange={(e) => {
                  setInput(maskCurrency(e.target.value));
                  setError(null);
                }}
                aria-invalid={Boolean(error)}
                aria-describedby="credit-cost-help"
                className="pl-10 tabular-nums"
              />
            </div>
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : (
              <p id="credit-cost-help" className="text-[11px] leading-snug text-muted-foreground">
                Entre R$ 0,00 e R$ 1.000,00.
                {previewTotal !== null && (
                  <>
                    {" "}
                    Novo total:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {payingActiveCount} × {formatCurrency(parsedPreview.data ?? 0)} = {formatCurrency(previewTotal)}
                    </span>
                  </>
                )}
              </p>
            )}
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button id="credit-cost-submit" type="submit" form="credit-cost-form" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

