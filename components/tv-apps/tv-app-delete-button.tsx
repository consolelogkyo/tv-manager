"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTvApp } from "@/app/actions/tv-apps";
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
import type { TvApp } from "@/lib/types";

export function TvAppDeleteButton({ app }: { app: TvApp }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTvApp(app.id);
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
          id={`tv-app-delete-${app.id}`}
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          aria-label={`Excluir ${app.app_name}`}
          title="Excluir"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover app do catálogo?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">{app.app_name}</strong> será removido da fila de{" "}
            <strong className="text-foreground">{app.tv_brand}</strong>. Clientes já cadastrados não são afetados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button id={`tv-app-confirm-delete-${app.id}`} variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Excluir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
