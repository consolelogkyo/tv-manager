import type { Customer, UserRole } from "@/lib/types";

/**
 * Regras de negócio de valores/comissão — fonte única usada pela tabela,
 * pelos cards mobile, pelos KPIs e pelo Livro-Razão (`billing_events`).
 */

/** Comissão fixa do revendedor por cliente ativo (R$). */
export const RESELLER_COMMISSION = 10;

/** Valor padrão sugerido quando o revendedor cadastra um novo cliente (R$). */
export const RESELLER_DEFAULT_PLAN_VALUE = 35;

/** Limite superior de `numeric(10, 2)`. */
export const MAX_PLAN_VALUE = 99_999_999.99;

/** Faixa aceita para o custo de 1 crédito de painel (R$). */
export const MIN_CREDIT_UNIT_COST = 0;
export const MAX_CREDIT_UNIT_COST = 1000;

/** Número de sócios que dividem o lucro líquido. */
export const PARTNERS_COUNT = 2;

/** Dias de tolerância após o vencimento antes de o cliente contar como churn. */
export const CHURN_GRACE_DAYS = 7;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------ Planos de Renovação --- */

export const RENEW_MONTH_OPTIONS = [1, 2, 3, 6, 12] as const;
export type RenewMonths = (typeof RENEW_MONTH_OPTIONS)[number];

export const RENEW_SCREEN_OPTIONS = [1, 2, 3] as const;
export type RenewScreens = (typeof RENEW_SCREEN_OPTIONS)[number];

export const RENEW_PERIOD_META: Record<RenewMonths, { label: string; short: string; days: number }> = {
  1: { label: "1 mês (Mensal)", short: "1 mês", days: 30 },
  2: { label: "60 dias (Bimestral)", short: "60 dias", days: 60 },
  3: { label: "3 meses (Trimestral)", short: "3 meses", days: 90 },
  6: { label: "6 meses (Semestral)", short: "6 meses", days: 180 },
  12: { label: "12 meses (Anual)", short: "12 meses", days: 365 },
};

/**
 * Tabela padrão de preços (R$) por período (meses) e quantidade de telas.
 * - Mensal (1m): 1 tela R$ 30 · 2 telas R$ 50 · 3 telas R$ 60
 * - Trimestral (3m): 1 tela R$ 80 · 2 telas R$ 140 · 3 telas R$ 150
 * - 60 dias (2m): 2× mensal · Semestral (6m): 2× trimestral · Anual (12m): 4× trimestral
 * Todos os valores são apenas sugestões iniciais e podem ser editados livremente na renovação.
 */
export const DEFAULT_RENEW_PRICES: Record<RenewMonths, Record<RenewScreens, number>> = {
  1: { 1: 30, 2: 50, 3: 60 },
  2: { 1: 60, 2: 100, 3: 120 },
  3: { 1: 80, 2: 140, 3: 150 },
  6: { 1: 160, 2: 280, 3: 300 },
  12: { 1: 320, 2: 560, 3: 600 },
};

export function getSuggestedRenewPrice(months: RenewMonths, screens: RenewScreens): number {
  return DEFAULT_RENEW_PRICES[months][screens];
}

/**
 * Por padrão (ex.: painel Next), até 3 telas do mesmo cliente consomem apenas
 * 1 crédito por mês de renovação. O admin pode alterar esse número no modal.
 */
export function getDefaultCreditsUsed(months: RenewMonths): number {
  return months;
}

type ValueFields = Pick<Customer, "plan_value" | "is_reseller" | "is_internal" | "panel_id">;

/** Lançamento legado de custo interno (valor negativo, antes do campo `is_internal`). */
export function isLegacyInternalCost(customer: Pick<Customer, "plan_value">): boolean {
  return customer.plan_value < 0;
}

/** Uso interno / casa: o novo campo `is_internal` ou o legado de valor negativo. */
export function isInternalCustomer(customer: Pick<Customer, "plan_value" | "is_internal">): boolean {
  return customer.is_internal || isLegacyInternalCost(customer);
}

export function isCanceled(customer: Pick<Customer, "canceled_at">): boolean {
  return Boolean(customer.canceled_at);
}

/**
 * Valor líquido para a casa (visão admin):
 * - pagante: valor − comissão do revendedor (se houver);
 * - uso interno (`is_internal`): R$ 0 — o custo real vem do crédito do painel;
 * - legado negativo: mantém o valor negativo enquanto não houver painel
 *   vinculado; com painel, o custo já entra pelo crédito (evita desconto duplicado).
 */
export function getNetValueForHouse(customer: ValueFields): number {
  if (customer.is_internal) return 0;
  if (isLegacyInternalCost(customer)) return customer.panel_id ? 0 : round2(customer.plan_value);
  return round2(customer.plan_value - (customer.is_reseller ? RESELLER_COMMISSION : 0));
}

/**
 * Quanto um cliente ATIVO contribui para o KPI financeiro do usuário logado:
 * - reseller → comissão fixa de R$ 10,00 por cliente ativo;
 * - admin    → valor líquido para a casa.
 */
export function getKpiContribution(customer: ValueFields, role: UserRole): number {
  return role === "reseller" ? RESELLER_COMMISSION : getNetValueForHouse(customer);
}

/**
 * Valores lançados no Livro-Razão para uma assinatura/renovação.
 * Uso interno nunca gera receita nem comissão (só o custo do crédito).
 */
export function getBillingAmounts(customer: Pick<Customer, "plan_value" | "is_reseller" | "is_internal">) {
  const internal = isInternalCustomer(customer);
  return {
    gross_amount: internal ? 0 : round2(Math.max(0, customer.plan_value)),
    commission_amount: !internal && customer.is_reseller ? RESELLER_COMMISSION : 0,
    is_internal: internal,
    is_reseller: customer.is_reseller,
  };
}
