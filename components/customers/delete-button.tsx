"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCustomer } from "@/app/actions/customers";
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
import type { EnrichedCustomer } from "@/components/customers/types";

export function DeleteButton({ customer }: { customer: EnrichedCustomer }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
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
          id={`delete-${customer.id}`}
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          aria-label={`Excluir ${customer.name}`}
          title="Excluir"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">{customer.name}</strong> ({customer.mac_address}) será removido
            permanentemente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button id={`confirm-delete-${customer.id}`} variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
