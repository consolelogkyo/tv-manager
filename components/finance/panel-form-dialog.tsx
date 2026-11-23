"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, Save, Server } from "lucide-react";
import { toast } from "sonner";
import { createPanel, updatePanel } from "@/app/actions/panels";
import { CurrencyPrefix, FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { panelFormSchema, type PanelFormValues } from "@/lib/finance-validations";
import { maskCurrency, numberToCurrencyInput } from "@/lib/format";
import type { Panel } from "@/lib/types";

function getDefaults(panel: Panel | null): PanelFormValues {
  if (panel) {
    return {
      name: panel.name,
      credit_cost: numberToCurrencyInput(panel.credit_cost),
      is_active: panel.is_active,
      notes: panel.notes ?? "",
    };
  }
  return { name: "", credit_cost: "", is_active: true, notes: "" };
}

/** Modal de criação/edição de painel/servidor e seu custo por crédito. */
export function PanelFormDialog({
  open,
  onOpenChange,
  panel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: Panel | null;
}) {
  const isEdit = Boolean(panel);
  const [pending, startTransition] = useTransition();
  const form = useForm<PanelFormValues>({
    resolver: zodResolver(panelFormSchema),
    defaultValues: getDefaults(panel),
    mode: "onTouched",
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(getDefaults(panel));
  }, [open, panel, reset]);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = panel ? await updatePanel(panel.id, values) : await createPanel(values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) setError(field as keyof PanelFormValues, { message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
    });
  });

  const costRegistration = register("credit_cost");

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" strokeWidth={1.75} />
            {isEdit ? "Editar painel" : "Novo painel"}
          </DialogTitle>
          <DialogDescription>Servidor onde os acessos são ativados e quanto custa cada crédito nele.</DialogDescription>
        </DialogHeader>

        <form id="panel-form" onSubmit={onSubmit} noValidate className="-mx-1 grid gap-4 overflow-y-auto px-1">
          <FormField label="Nome" htmlFor="panel-name" error={errors.name?.message}>
            <Input id="panel-name" maxLength={60} autoComplete="off" placeholder="Ex.: Painel Alpha" {...register("name")} />
          </FormField>

          <FormField label="Custo por crédito" htmlFor="panel-cost" error={errors.credit_cost?.message} info={isEdit ? "panelCostChange" : undefined}>
            <div className="relative">
              <CurrencyPrefix />
              <Input
                id="panel-cost"
                inputMode="numeric"
                placeholder="5,00"
                autoComplete="off"
                className="pl-10 tabular-nums"
                {...costRegistration}
                onChange={(e) => {
                  e.target.value = maskCurrency(e.target.value);
                  return costRegistration.onChange(e);
                }}
              />
            </div>
          </FormField>

          {isEdit && (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Alterar o custo passa a valer para novas assinaturas e renovações. O histórico já lançado no Livro-Razão
              (meses anteriores) não é alterado.
            </p>
          )}

          <label
            htmlFor="panel-active"
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <input id="panel-active" type="checkbox" className="size-4 shrink-0 cursor-pointer accent-primary" {...register("is_active")} />
            Painel ativo (aparece no cadastro de clientes)
          </label>

          <FormField label="Observações" htmlFor="panel-notes" error={errors.notes?.message} optional>
            <Textarea id="panel-notes" rows={2} maxLength={500} placeholder="Ex.: contato do fornecedor, limite de telas..." {...register("notes")} />
          </FormField>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button id="panel-submit" type="submit" form="panel-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            {isEdit ? "Salvar painel" : "Criar painel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
