"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CalendarPlus, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { renewCustomer } from "@/app/actions/customers";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { EnrichedCustomer } from "@/components/customers/types";
import { addDaysISO, addMonthsISO, formatDateBR, getTodayISO } from "@/lib/date";
import type { RenewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RenewButton({ customer, className }: { customer: EnrichedCustomer; className?: string }) {
  const [pending, startTransition] = useTransition();
  const [askOpen, setAskOpen] = useState(false);

  const isExpired = customer.status === "expired";

  function run(mode: RenewMode) {
    startTransition(async () => {
      const result = await renewCustomer(customer.id, mode);
      if (result.ok) {
        toast.success(result.message);
        setAskOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleClick() {
    if (isExpired) setAskOpen(true);
    else run("auto");
  }

  const fromToday = addDaysISO(getTodayISO(), 30);
  const fromExpiry = addMonthsISO(customer.expires_at, 1);

  return (
    <>
      <Button
        id={`renew-${customer.id}`}
        variant="success"
        size="sm"
        onClick={handleClick}
        disabled={pending}
        className={cn("font-semibold", className)}
        title={isExpired ? "Renovar cliente vencido" : `Renovar até ${formatDateBR(fromExpiry)}`}
      >
        {pending ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
        +30 Dias
      </Button>

      <AlertDialog open={askOpen} onOpenChange={(open) => !pending && setAskOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renovar {customer.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Este cliente está vencido desde {formatDateBR(customer.expires_at)}. Como deseja contar a renovação?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-2.5">
            <button
              type="button"
              id={`renew-today-${customer.id}`}
              disabled={pending}
              onClick={() => run("from_today")}
              className="group flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-3.5 text-left transition hover:border-success/70 hover:bg-success/15 disabled:opacity-60 cursor-pointer"
            >
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-success" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">A partir de hoje (+30 dias)</span>
                <span className="block text-xs text-muted-foreground">
                  Novo vencimento: <strong className="text-foreground">{formatDateBR(fromToday)}</strong>
                </span>
              </span>
              <span className="rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                Recomendado
              </span>
            </button>

            <button
              type="button"
              id={`renew-cycle-${customer.id}`}
              disabled={pending}
              onClick={() => run("from_expiry")}
              className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3.5 text-left transition hover:border-primary/50 hover:bg-primary/10 disabled:opacity-60 cursor-pointer"
            >
              <RotateCcw className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">Manter o ciclo (+1 mês do vencimento)</span>
                <span className="block text-xs text-muted-foreground">
                  Novo vencimento: <strong className="text-foreground">{formatDateBR(fromExpiry)}</strong>
                </span>
              </span>
            </button>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
