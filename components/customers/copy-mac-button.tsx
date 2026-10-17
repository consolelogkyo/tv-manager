"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyMacButton({ value, className, id }: { value: string; className?: string; id?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("MAC copiado!", { description: value, duration: 1800 });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  }

  return (
    <button
      type="button"
      id={id}
      onClick={handleCopy}
      title="Copiar MAC"
      aria-label={`Copiar MAC ${value}`}
      className={cn(
        "group inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-xs tracking-wide text-foreground/90 transition hover:border-primary/50 hover:bg-primary/10 active:scale-[0.97] cursor-pointer",
        copied && "border-success/50 bg-success/10",
        className,
      )}
    >
      <span>{value}</span>
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground transition group-hover:text-primary" />
      )}
    </button>
  );
}
