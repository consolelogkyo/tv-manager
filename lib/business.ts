import type { Customer, UserRole } from "@/lib/types";

/**
 * Regras de negócio de valores/comissão — fonte única usada pela tabela,
 * pelos cards mobile e pelos KPIs. (Apenas exibição: nada aqui é persistido.)
 */

/** Comissão fixa do revendedor por cliente ativo (R$). */
export const RESELLER_COMMISSION = 10;

/** Valor padrão sugerido quando o revendedor cadastra um novo cliente (R$). */
export const RESELLER_DEFAULT_PLAN_VALUE = 35;

/** Limite inferior aceito pelo banco (`plan_value >= -10000`) para custos/descontos. */
export const MIN_PLAN_VALUE = -10_000;

/** Limite superior de `numeric(10, 2)`. */
export const MAX_PLAN_VALUE = 99_999_999.99;

type ValueFields = Pick<Customer, "plan_value" | "is_reseller">;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lançamento de custo interno / desconto no saldo (somente admins conseguem criar). */
export function isInternalCost(customer: Pick<Customer, "plan_value">): boolean {
  return customer.plan_value < 0;
}

/**
 * Valor líquido para a casa (visão admin): clientes do revendedor descontam
 * a comissão fixa; custos internos já são negativos e entram como estão.
 */
export function getNetValueForHouse(customer: ValueFields): number {
  return round2(customer.plan_value - (customer.is_reseller ? RESELLER_COMMISSION : 0));
}

/**
 * Quanto um cliente ATIVO contribui para o KPI financeiro do usuário logado:
 * - reseller → comissão fixa de R$ 10,00 por cliente ativo;
 * - admin    → valor líquido para a casa (com comissão e custos abatidos).
 */
export function getKpiContribution(customer: ValueFields, role: UserRole): number {
  return role === "reseller" ? RESELLER_COMMISSION : getNetValueForHouse(customer);
}

