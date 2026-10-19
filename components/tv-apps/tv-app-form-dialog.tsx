"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppWindow, ArrowLeft, Loader2, Plus, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { createTvApp, updateTvApp } from "@/app/actions/tv-apps";
import { PRIORITY_DOT } from "@/components/tv-apps/badges";
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
import { LICENSE_PRESETS, PRIORITY_META } from "@/lib/tv-apps";
import type { TvApp, TvAppPriority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { tvAppFormSchema, type TvAppFormOutput, type TvAppFormValues } from "@/lib/validations";

const NEW_BRAND = "__new__";
const PRIORITIES: TvAppPriority[] = [1, 2, 3];

function getDefaults(app: TvApp | null, defaultBrand: string): TvAppFormValues {
  if (app) {
    return {
      tv_brand: app.tv_brand,
      app_name: app.app_name,
      priority: String(app.priority) as TvAppFormValues["priority"],
      is_favorite: app.is_favorite,
      license_info: app.license_info ?? "",
      activation_url: app.activation_url ?? "",
      notes: app.notes ?? "",
    };
  }
  return {
    tv_brand: defaultBrand,
    app_name: "",
    priority: "1",
    is_favorite: false,
    license_info: "Gratuito",
    activation_url: "",
    notes: "",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: TvApp | null;
  brands: string[];
  defaultBrand: string;
  appNames: string[];
};

export function TvAppFormDialog({ open, onOpenChange, app, brands, defaultBrand, appNames }: Props) {
  const isEdit = Boolean(app);
  const [pending, startTransition] = useTransition();
  const [brandMode, setBrandMode] = useState<"select" | "new">("select");

  const form = useForm<TvAppFormValues, unknown, TvAppFormOutput>({
    resolver: zodResolver(tvAppFormSchema),
    defaultValues: getDefaults(app, defaultBrand),
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

  useEffect(() => {
    if (!open) return;
    const defaults = getDefaults(app, defaultBrand);
    reset(defaults);
    setBrandMode(defaults.tv_brand && !brands.includes(defaults.tv_brand) ? "new" : "select");
  }, [open, app, defaultBrand, brands, reset]);

  const brandValue = watch("tv_brand");
  const priorityValue = watch("priority");
  const isFavorite = watch("is_favorite");

  function onBrandSelect(value: string) {
    if (value === NEW_BRAND) {
      setBrandMode("new");
      setValue("tv_brand", "", { shouldDirty: true });
      return;
    }
    setValue("tv_brand", value, { shouldDirty: true, shouldValidate: true });
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = app ? await updateTvApp(app.id, values) : await createTvApp(values);

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) setError(field as keyof TvAppFormValues, { message: messages[0] });
          }
        }
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            {isEdit ? <Save className="size-5 text-primary" /> : <AppWindow className="size-5 text-primary" />}
            {isEdit ? "Editar app" : "Adicionar app ao catálogo"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize a posição na fila e as informações de instalação."
              : "Defina em qual TV o app funciona e qual a posição dele na fila."}
          </DialogDescription>
        </DialogHeader>

        <form id="tv-app-form" onSubmit={onSubmit} noValidate className="-mx-1 overflow-y-auto px-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca / Sistema da TV" htmlFor="tv-app-brand" error={errors.tv_brand?.message} className="sm:col-span-2">
              {brandMode === "select" ? (
                <select
                  id="tv-app-brand"
                  value={brands.includes(brandValue) ? brandValue : ""}
                  onChange={(e) => onBrandSelect(e.target.value)}
                  aria-invalid={Boolean(errors.tv_brand)}
                  className={cn(
                    "flex h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-base shadow-xs outline-none transition-[color,box-shadow,border-color] md:text-sm [color-scheme:dark] cursor-pointer",
                    "focus-visible:border-primary/70 focus-visible:ring-[3px] focus-visible:ring-primary/20",
                    "aria-invalid:border-destructive",
                  )}
                >
                  <option value="" disabled>
                    Selecione a marca...
                  </option>
                  {brands.map((b) => (
                    <option key={b} value={b} className="bg-popover">
                      {b}
                    </option>
                  ))}
                  <option value={NEW_BRAND} className="bg-popover">
                    ＋ Nova marca / sistema...
                  </option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="tv-app-brand"
                    placeholder="Ex.: Philips (Saphi)"
                    autoComplete="off"
                    maxLength={80}
                    autoFocus
                    aria-invalid={Boolean(errors.tv_brand)}
                    {...register("tv_brand")}
                  />
                  <Button
                    type="button"
                    id="tv-app-brand-back"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => {
                      setBrandMode("select");
                      setValue("tv_brand", defaultBrand, { shouldValidate: true });
                    }}
                    aria-label="Voltar para a lista de marcas"
                    title="Escolher marca existente"
                  >
                    <ArrowLeft />
                  </Button>
                </div>
              )}
            </Field>

            <Field label="Nome do app" htmlFor="tv-app-name" error={errors.app_name?.message} className="sm:col-span-2">
              <Input
                id="tv-app-name"
                placeholder="Ex.: IPTV Smarters Pro"
                autoComplete="off"
                maxLength={60}
                list="tv-app-name-options"
                aria-invalid={Boolean(errors.app_name)}
                {...register("app_name")}
              />
              <datalist id="tv-app-name-options">
                {appNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>

            <fieldset className="space-y-1.5 sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium text-foreground/90">Posição na fila</legend>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => {
                  const checked = priorityValue === String(p);
                  return (
                    <label
                      key={p}
                      htmlFor={`tv-app-priority-${p}`}
                      className={cn(
                        "flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 transition-all",
                        checked
                          ? p === 1
                            ? "border-success/50 bg-success/12 ring-1 ring-success/30"
                            : p === 2
                              ? "border-sky-400/50 bg-sky-400/12 ring-1 ring-sky-400/30"
                              : "border-muted-foreground/40 bg-muted/60 ring-1 ring-border"
                          : "border-border/70 bg-background/40 hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="radio"
                        id={`tv-app-priority-${p}`}
                        value={String(p)}
                        className="sr-only"
                        {...register("priority")}
                      />
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <span className={cn("size-2 rounded-full", PRIORITY_DOT[p])} />
                        {PRIORITY_META[p].label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{PRIORITY_META[p].hint}</span>
                    </label>
                  );
                })}
              </div>
              {errors.priority?.message && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.priority.message}
                </p>
              )}
            </fieldset>

            <Field label="Licença" htmlFor="tv-app-license" error={errors.license_info?.message} optional>
              <Input
                id="tv-app-license"
                placeholder="Ex.: Pago (Anual)"
                autoComplete="off"
                maxLength={60}
                list="tv-app-license-options"
                aria-invalid={Boolean(errors.license_info)}
                {...register("license_info")}
              />
              <datalist id="tv-app-license-options">
                {LICENSE_PRESETS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>

            <div className="space-y-1.5">
              <span className="flex text-sm font-medium leading-none text-foreground/90">Favorito</span>
              <label
                htmlFor="tv-app-favorite"
                className={cn(
                  "flex h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 transition-all",
                  isFavorite ? "border-warning/40 bg-warning/10" : "border-input bg-background/60 hover:bg-muted/50",
                )}
              >
                <span className={cn("flex items-center gap-2 text-sm", isFavorite ? "text-warning" : "text-muted-foreground")}>
                  <Star className={cn("size-4", isFavorite && "fill-current")} />
                  {isFavorite ? "Favorito ⭐" : "Marcar como favorito"}
                </span>
                <input id="tv-app-favorite" type="checkbox" role="switch" className="peer sr-only" {...register("is_favorite")} />
                <span
                  aria-hidden
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                    isFavorite ? "bg-warning" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200",
                      isFavorite && "translate-x-4",
                    )}
                  />
                </span>
              </label>
            </div>

            <Field
              label="Link de ativação"
              htmlFor="tv-app-url"
              error={errors.activation_url?.message}
              optional
              className="sm:col-span-2"
            >
              <Input
                id="tv-app-url"
                type="url"
                inputMode="url"
                placeholder="https://painel-do-app.com/ativar"
                autoComplete="off"
                spellCheck={false}
                maxLength={500}
                aria-invalid={Boolean(errors.activation_url)}
                {...register("activation_url")}
              />
            </Field>

            <Field label="Dicas de instalação" htmlFor="tv-app-notes" error={errors.notes?.message} optional className="sm:col-span-2">
              <Textarea
                id="tv-app-notes"
                rows={3}
                maxLength={1000}
                placeholder="Ex.: baixar pela LG Content Store, ativar com o MAC no painel..."
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
          <Button id="tv-app-submit" type="submit" form="tv-app-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : isEdit ? <Save /> : <Plus />}
            {isEdit ? "Salvar alterações" : "Adicionar app"}
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
