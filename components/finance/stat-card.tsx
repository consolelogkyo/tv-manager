import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/info-tip";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/** Card de número: rótulo (+ explicação), valor grande e uma linha de contexto. */
export function StatCard({
  id,
  label,
  value,
  hint,
  term,
  badge,
  valueClassName,
  className,
  action,
}: {
  id: string;
  label: string;
  value: string;
  hint?: ReactNode;
  term?: GlossaryKey;
  badge?: ReactNode;
  valueClassName?: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div id={id} className={cn("rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5 sm:py-4", className)}>
      <div className="flex items-center gap-1">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="ml-auto flex items-center gap-0.5">
          {action}
          {term && <InfoTip term={term} align="end" />}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className={cn("text-[28px] leading-8 font-medium tabular-nums", valueClassName)}>{value}</p>
        {badge}
      </div>
      {hint && <p className="mt-1 line-clamp-2 text-xs text-subtle-foreground">{hint}</p>}
    </div>
  );
}
