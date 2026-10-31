import { CreditCard, Store, TrendingDown } from "lucide-react";
import type { EnrichedCustomer } from "@/components/customers/types";
import { Badge } from "@/components/ui/badge";
import { RESELLER_COMMISSION, getNetValueForHouse, isInternalCost } from "@/lib/business";
import { formatDateBR } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Tags exibidas ao lado do nome do cliente (somente visão admin):
 * - "Revendedor" para clientes cadastrados pelo revendedor;
 * - "Desconto / Custo Interno" para lançamentos com valor negativo.
 */
export function CustomerTags({ customer, userRole }: { customer: EnrichedCustomer; userRole: UserRole }) {
  if (userRole !== "admin") return null;
  const reseller = customer.is_reseller;
  const cost = isInternalCost(customer);
  if (!reseller && !cost) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {reseller && (
        <Badge variant="violet" className="px-2 text-[10px] sm:text-[11px]">
          <Store />
          Revendedor
        </Badge>
      )}
      {cost && (
        <Badge variant="danger" className="px-2 text-[10px] sm:text-[11px]">
          <TrendingDown />
          Desconto / Custo Interno
        </Badge>
      )}
    </span>
  );
}

/**
 * Valor exibido na coluna/card de valor, conforme o cargo:
 * - reseller → valor pago pelo cliente + "Sua comissão: R$ 10,00";
 * - admin    → valor líquido para a casa (cliente do revendedor = bruto − R$ 10)
 *              e custos internos em vermelho.
 */
export function PlanValueInfo({
  customer,
  userRole,
  align = "right",
  size = "sm",
}: {
  customer: EnrichedCustomer;
  userRole: UserRole;
  align?: "left" | "right";
  size?: "sm" | "lg";
}) {
  const valueClass = cn(
    "tabular-nums",
    size === "lg" ? "font-display text-lg font-semibold" : "font-medium",
  );
  const wrapperClass = cn("flex flex-col gap-0.5", align === "right" ? "items-end text-right" : "items-start text-left");

  if (userRole === "reseller") {
    return (
      <div className={wrapperClass}>
        <span className={valueClass}>{formatCurrency(customer.plan_value)}</span>
        <span className="inline-flex items-center rounded-md bg-success/12 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-success ring-1 ring-success/25">
          Sua comissão: {formatCurrency(RESELLER_COMMISSION)}
        </span>
      </div>
    );
  }

  const net = getNetValueForHouse(customer);
  return (
    <div className={wrapperClass}>
      <span className={cn(valueClass, net < 0 && "text-destructive")}>{formatCurrency(net)}</span>
      {customer.is_reseller && (
        <span className="text-[11px] leading-tight text-muted-foreground">
          <span className="whitespace-nowrap">Bruto: {formatCurrency(customer.plan_value)}</span>{" "}
          <span className="whitespace-nowrap">(−{formatCurrency(RESELLER_COMMISSION)} comissão)</span>
        </span>
      )}
    </div>
  );
}

/** Indicador de data alternativa de pagamento (exclusivo admin). */
export function PaymentDateTag({ customer, userRole }: { customer: EnrichedCustomer; userRole: UserRole }) {
  if (userRole !== "admin" || !customer.payment_date) return null;
  return (
    <span
      title="Data alternativa de pagamento (o sinal da TV segue o vencimento)"
      className="mt-1 inline-flex w-fit flex-wrap items-center gap-x-1 rounded-md bg-primary/12 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-primary/25"
    >
      <CreditCard className="size-3 shrink-0" aria-hidden="true" />
      <span>Paga dia:</span>
      <span className="tabular-nums">{formatDateBR(customer.payment_date)}</span>
    </span>
  );
}
