import { AlertTriangle, CreditCard, Home, Server, Store } from "lucide-react";
import type { EnrichedCustomer } from "@/components/customers/types";
import { Badge } from "@/components/ui/badge";
import { RESELLER_COMMISSION, getNetValueForHouse, isInternalCustomer } from "@/lib/business";
import { formatDateBR } from "@/lib/date";
import { formatCurrency } from "@/lib/format";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Tags exibidas ao lado do nome do cliente (somente visão admin):
 * - painel/servidor (ou aviso "Sem painel");
 * - "Revendedor" para clientes cadastrados pelo revendedor;
 * - "Uso interno" para acessos da casa (novo campo ou valor negativo legado).
 */
export function CustomerTags({ customer, userRole }: { customer: EnrichedCustomer; userRole: UserRole }) {
  if (userRole !== "admin") return null;
  const internal = isInternalCustomer(customer);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {customer.panel ? (
        <Badge
          variant="outline"
          title={`Painel ${customer.panel.name} — ${formatCurrency(customer.panel.credit_cost)}/crédito`}
        >
          <Server />
          {customer.panel.name}
        </Badge>
      ) : (
        <Badge variant="warning" title="Defina o painel ao editar o cliente">
          <AlertTriangle />
          Sem painel
        </Badge>
      )}
      {customer.is_reseller && (
        <Badge variant="default">
          <Store />
          Revendedor
        </Badge>
      )}
      {internal && (
        <Badge variant="default">
          <Home />
          Uso interno
        </Badge>
      )}
    </span>
  );
}

/**
 * Valor exibido na coluna/card de valor, conforme o cargo:
 * - reseller → valor pago pelo cliente + "Sua comissão: R$ 10,00";
 * - admin    → valor líquido para a casa (cliente do revendedor = bruto − R$ 10);
 *              uso interno mostra o custo do crédito do painel.
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
    size === "lg" ? "text-base font-medium" : "font-medium",
  );
  const wrapperClass = cn("flex flex-col gap-0.5", align === "right" ? "items-end text-right" : "items-start text-left");

  if (userRole === "reseller") {
    return (
      <div className={wrapperClass}>
        <span className={valueClass}>{formatCurrency(customer.plan_value)}</span>
        <span className="text-[11px] whitespace-nowrap text-success">
          Sua comissão: {formatCurrency(RESELLER_COMMISSION)}
        </span>
      </div>
    );
  }

  const net = getNetValueForHouse(customer);
  const internal = isInternalCustomer(customer);
  return (
    <div className={wrapperClass}>
      <span className={cn(valueClass, net < 0 && "text-destructive")}>{formatCurrency(net)}</span>
      {internal ? (
        <span className="text-[11px] leading-tight whitespace-nowrap text-subtle-foreground">
          {customer.panel ? `Custo: −${formatCurrency(customer.panel.credit_cost)}/crédito` : "Sem faturamento"}
        </span>
      ) : (
        customer.is_reseller && (
          <span className="text-[11px] leading-tight text-subtle-foreground">
            <span className="whitespace-nowrap">Bruto: {formatCurrency(customer.plan_value)}</span>{" "}
            <span className="whitespace-nowrap">(−{formatCurrency(RESELLER_COMMISSION)} comissão)</span>
          </span>
        )
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
      className="mt-1 inline-flex w-fit flex-wrap items-center gap-x-1 text-[11px] text-muted-foreground"
    >
      <CreditCard className="size-3 shrink-0" aria-hidden="true" />
      <span>Paga dia:</span>
      <span className="tabular-nums">{formatDateBR(customer.payment_date)}</span>
    </span>
  );
}
