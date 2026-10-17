"use client";

import { useEffect, useTransition } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, UserPlus } from "lucide-react";
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
import { addDaysISO, getTodayISO } from "@/lib/date";
import { formatPhone, maskCurrency, maskMac, maskPhone, numberToCurrencyInput } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { customerFormSchema, type CustomerFormValues } from "@/lib/validations";
import { cn } from "@/lib/utils";

function getDefaults(customer: Customer | null): CustomerFormValues {
  if (customer) {
    return {
      name: customer.name,
      phone: formatPhone(customer.phone),
      mac_address: customer.mac_address,
      app_name: customer.app_name ?? "",
      plan_value: numberToCurrencyInput(customer.plan_value),
      expires_at: customer.expires_at,
      notes: customer.notes ?? "",
    };
  }
  return {
    name: "",
    phone: "",
    mac_address: "",
    app_name: "",
    plan_value: "",
    expires_at: addDaysISO(getTodayISO(), 30),
    notes: "",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
};

export function CustomerFormDialog({ open, onOpenChange, customer }: Props) {
  const isEdit = Boolean(customer);
  const [pending, startTransition] = useTransition();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: getDefaults(customer),
    mode: "onTouched",
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form;

  // Recarrega os valores sempre que o modal abre (novo cliente ou outro cliente).
  useEffect(() => {
    if (open) reset(getDefaults(customer));
  }, [open, customer, reset]);

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
                aria-invalid={Boolean(errors.app_name)}
                {...register("app_name")}
              />
            </Field>

            <Field label="Valor do plano" htmlFor="customer-value" error={errors.plan_value?.message}>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  id="customer-value"
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  className="pl-10 tabular-nums"
                  aria-invalid={Boolean(errors.plan_value)}
                  {...withMask(register("plan_value"), maskCurrency)}
                />
              </div>
            </Field>

            <Field
              label="Vencimento"
              htmlFor="customer-expires"
              error={errors.expires_at?.message}
              className="sm:col-span-2"
            >
              <Input
                id="customer-expires"
                type="date"
                aria-invalid={Boolean(errors.expires_at)}
                {...register("expires_at")}
              />
            </Field>

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
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
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
      {error && (
        <p role="alert" className="text-xs text-destructive animate-in fade-in slide-in-from-top-0.5">
          {error}
        </p>
      )}
    </div>
  );
}
