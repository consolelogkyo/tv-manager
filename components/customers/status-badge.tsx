import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CustomerStatus } from "@/lib/date";

const STATUS_CONFIG: Record<
  CustomerStatus,
  { label: string; variant: "success" | "warning" | "danger"; Icon: typeof CheckCircle2 }
> = {
  active: { label: "Ativo", variant: "success", Icon: CheckCircle2 },
  expiring: { label: "Vencendo", variant: "warning", Icon: AlertTriangle },
  expired: { label: "Vencido", variant: "danger", Icon: XCircle },
};

export function StatusBadge({ status, days }: { status: CustomerStatus; days: number }) {
  const { label, variant, Icon } = STATUS_CONFIG[status];
  const text = status === "expiring" && days === 0 ? "Vence hoje" : label;
  return (
    <Badge variant={variant}>
      <Icon />
      {text}
    </Badge>
  );
}
