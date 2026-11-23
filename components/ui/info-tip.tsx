"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { GLOSSARY, type GlossaryEntry, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/**
 * Ícone (i) que abre uma explicação curta. Abre com clique/toque (funciona no
 * celular), fecha com Esc ou clique fora. O texto vem de `lib/glossary.ts`
 * para que o mesmo termo seja explicado igual em todas as telas.
 */
export function InfoTip({
  term,
  side = "top",
  align = "center",
  className,
}: {
  term: GlossaryKey;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const entry: GlossaryEntry = GLOSSARY[term];

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`O que é: ${entry.title}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative z-10 inline-grid size-5 shrink-0 cursor-pointer place-items-center rounded-full align-middle text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted data-[state=open]:text-foreground",
            className,
          )}
        >
          <Info className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "z-[60] w-80 max-w-[calc(100vw-24px)] rounded-lg border border-border bg-popover p-3.5 text-[13px] leading-5 text-muted-foreground shadow-xl shadow-black/40 outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        >
          <p className="mb-1.5 text-sm font-medium text-foreground">{entry.title}</p>
          <div className="space-y-2">
            {entry.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {entry.formula && (
            <p className="mt-2.5 rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[12px] leading-5 text-foreground">
              {entry.formula}
            </p>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Rótulo + (i) lado a lado, alinhados. */
export function LabelWithInfo({
  children,
  term,
  className,
  side,
  align,
}: {
  children: React.ReactNode;
  term: GlossaryKey;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <InfoTip term={term} side={side} align={align} />
    </span>
  );
}
