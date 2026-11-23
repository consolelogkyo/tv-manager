"use client";

import { useState, useTransition } from "react";
import { Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { cancelCustomer } from "@/app/actions/customers";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import type { EnrichedCustomer } from "@/components/customers/types";

/** "Cancelar / Churn": marca `canceled_at` sem apagar o cliente nem o histórico financeiro. */
export function CancelButton({ customer, full = false }: { customer: EnrichedCustomer; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (customer.canceled_at) return null;

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelCustomer(customer.id);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <AlertDialogTrigger asChild>
        <Button
          id={`cancel-${customer.id}`}
          variant="ghost"
          size={full ? "sm" : "icon-sm"}
          className="text-muted-foreground hover:text-warning"
          aria-label={`Cancelar assinatura de ${customer.name}`}
          title="Cancelar / Churn"
        >
          <UserX />
          {full && "Cancelar assinatura"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-1.5">
            Cancelar assinatura <InfoTip term="cancelChurn" />
          </AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">{customer.name}</strong> será marcado como cancelado hoje e sai da
            carteira ativa (conta no churn do mês). O cadastro e o histórico financeiro são mantidos — para reativar,
            use o botão <strong className="text-foreground">Renovar</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
          <Button
            id={`confirm-cancel-${customer.id}`}
            variant="outline"
            onClick={handleCancel}
            disabled={pending}
            className="border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
          >
            {pending ? <Loader2 className="animate-spin" /> : <UserX />}
            Cancelar assinatura
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
