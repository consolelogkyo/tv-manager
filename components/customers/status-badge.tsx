import type { DisplayStatus } from "@/components/customers/types";
import { SignalDot } from "@/components/ui/signal-dot";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<DisplayStatus, { label: string; text: string }> = {
  active: { label: "Ativo", text: "text-foreground" },
  expiring: { label: "Vencendo", text: "text-warning" },
  expired: { label: "Vencido", text: "text-destructive" },
  canceled: { label: "Cancelado", text: "text-muted-foreground" },
};

/** Status com o "ponto de sinal" — a mesma marca usada nos cards de resumo. */
export function StatusBadge({ status, days }: { status: DisplayStatus; days: number }) {
  const { label, text } = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-[13px] font-medium whitespace-nowrap", text)}>
      <SignalDot tone={status} pulse={status === "expiring"} />
      {status === "expiring" && days === 0 ? "Vence hoje" : label}
    </span>
  );
}
