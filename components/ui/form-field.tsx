import { InfoTip } from "@/components/ui/info-tip";
import { Label } from "@/components/ui/label";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/** Campo de formulário padrão: rótulo (+ ícone de ajuda opcional), controle e dica/erro. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  optional,
  info,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  /** Termo do glossário explicado pelo ícone (i) ao lado do rótulo. */
  info?: GlossaryKey;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>
          {label}
          {optional && <span className="text-xs font-normal text-subtle-foreground">(opcional)</span>}
        </Label>
        {info && <InfoTip term={info} align="start" />}
      </div>
      {children}
      {hint && !error && <p className="text-xs leading-snug text-subtle-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Prefixo "R$" para inputs monetários. */
export function CurrencyPrefix() {
  return (
    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-subtle-foreground">R$</span>
  );
}
