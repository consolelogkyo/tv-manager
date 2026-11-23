"use client";

import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthLabel, isValidMonth } from "@/lib/month";
import { cn } from "@/lib/utils";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Seletor de mês (`YYYY-MM`) próprio: grade de 12 meses com navegação por ano.
 * Substitui o `<input type="month">`, que no Chrome em português aparece como
 * "--------- de ----" e não existe no Firefox/Safari.
 */
export function MonthPicker({
  id,
  value,
  displayValue,
  onChange,
  markedMonths = [],
  currentMonth,
  placeholder = "Selecionar mês",
  invalid,
  className,
  triggerClassName,
  align = "start",
}: {
  id?: string;
  value: string;
  /** Texto opcional para exibir no botão quando `value` é válido (ex.: "Mês 1 · Outubro/2026"). */
  displayValue?: string;
  onChange: (month: string) => void;
  /** Meses destacados com um ponto (ex.: meses com lançamentos). */
  markedMonths?: string[];
  /** Mês atual, com contorno. */
  currentMonth?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const valid = isValidMonth(value);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((valid ? value : (currentMonth ?? "2026-01")).slice(0, 4)));
  const marked = new Set(markedMonths);

  function handleOpenChange(next: boolean) {
    // Ao abrir, mostra o ano do mês selecionado.
    if (next && valid) setYear(Number(value.slice(0, 4)));
    setOpen(next);
  }

  function pick(m: number) {
    onChange(`${year}-${pad(m)}`);
    setOpen(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          data-invalid={invalid || undefined}
          className={cn(
            "flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-base transition-[color,border-color] outline-none md:text-sm",
            "hover:border-primary/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 data-[invalid]:border-destructive data-[state=open]:border-primary/70",
            className,
            triggerClassName,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
          <span className={cn("flex-1 truncate", !valid && "text-subtle-foreground")}>
            {valid ? (displayValue ?? formatMonthLabel(value)) : placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-subtle-foreground" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className="z-[60] w-72 rounded-xl border border-border bg-popover p-3 shadow-xl shadow-black/40 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => Math.max(MIN_YEAR, y - 1))}
              disabled={year <= MIN_YEAR}
              aria-label="Ano anterior"
              className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium tabular-nums" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              onClick={() => setYear((y) => Math.min(MAX_YEAR, y + 1))}
              disabled={year >= MAX_YEAR}
              aria-label="Próximo ano"
              className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1" role="group" aria-label={`Meses de ${year}`}>
            {MONTHS_SHORT.map((label, i) => {
              const m = `${year}-${pad(i + 1)}`;
              const selected = valid && m === value;
              const isCurrent = m === currentMonth;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick(i + 1)}
                  aria-pressed={selected}
                  aria-label={`${formatMonthLabel(m)}${marked.has(m) ? ", com lançamentos" : ""}${isCurrent ? ", mês atual" : ""}`}
                  className={cn(
                    "relative flex h-10 cursor-pointer flex-col items-center justify-center rounded-md text-[13px] transition-colors duration-150",
                    selected
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                    !selected && isCurrent && "ring-1 ring-primary/60 ring-inset",
                  )}
                >
                  {label}
                  {marked.has(m) && (
                    <span
                      aria-hidden="true"
                      className={cn("absolute bottom-1.5 size-1 rounded-full", selected ? "bg-white" : "bg-primary-ink")}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {(markedMonths.length > 0 || currentMonth) && (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs text-subtle-foreground">
              {markedMonths.length > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1 rounded-full bg-primary-ink" /> Com lançamentos
                </span>
              ) : (
                <span />
              )}
              {currentMonth && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(currentMonth);
                    setOpen(false);
                  }}
                  className="cursor-pointer rounded-md px-2 py-1 font-medium text-primary-ink transition-colors hover:bg-muted"
                >
                  Mês atual
                </button>
              )}
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
