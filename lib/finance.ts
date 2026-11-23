import { CHURN_GRACE_DAYS, PARTNERS_COUNT, RESELLER_COMMISSION, round2 } from "@/lib/business";
import { addDaysISO, getDaysRemaining, toAppDateISO } from "@/lib/date";
import { monthBounds, uniqueSortedMonths } from "@/lib/month";
import type { BillingEvent, Expense, ExpenseCategory, FinanceCustomer, Panel } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";

/**
 * Cálculos do módulo financeiro (funções puras, sem I/O). Tudo é derivado
 * do Livro-Razão (`billing_events`), das despesas extras e da carteira atual.
 */

export type PanelPriceTier = {
  unitCost: number;
  count: number;
  total: number;
};

export type PanelCostLine = {
  key: string;
  name: string;
  count: number;
  payingCount: number;
  internalCount: number;
  total: number;
  /** Custo por crédito (média, se o custo mudou durante o mês). */
  unitCost: number;
  mixedCost: boolean;
  /** Detalhamento por faixa de preço unitário quando houve múltiplos custos no mesmo painel. */
  priceTiers: PanelPriceTier[];
};

export type ExpenseCategoryLine = { category: ExpenseCategory; count: number; amount: number };

export type MonthSummary = {
  month: string;
  eventCount: number;
  newCount: number;
  newAmount: number;
  renewalCount: number;
  renewalAmount: number;
  gross: number;
  commissionCount: number;
  commissions: number;
  creditCount: number;
  credits: number;
  panelLines: PanelCostLine[];
  expenseCount: number;
  expenses: number;
  expenseLines: ExpenseCategoryLine[];
  totalDeductions: number;
  net: number;
  /** Margem líquida (%) ou `null` sem faturamento. */
  margin: number | null;
  perPartner: number;
  payingCustomers: number;
  /** Ticket médio por cliente pagante ou `null` sem pagantes. */
  arpu: number | null;
};

function groupByMonth<T extends { reference_month: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.reference_month);
    if (list) list.push(row);
    else map.set(row.reference_month, [row]);
  }
  return map;
}

/** Meses (ordenados) que possuem lançamentos ou despesas. */
export function listDataMonths(events: BillingEvent[], expenses: Expense[]): string[] {
  return uniqueSortedMonths([...events.map((e) => e.reference_month), ...expenses.map((e) => e.reference_month)]);
}

/**
 * Quantos créditos um lançamento consumiu:
 * 1. Usa `event.credits_used` quando > 1;
 * 2. Se as observações registrarem `(N crédito/créditos)` ou `· N créditos`, usa `N`;
 * 3. Se o painel tiver `credit_cost > 0` e o custo do evento for múltiplo exato (legado), usa a razão;
 * 4. Caso contrário, `event.credits_used` (padrão 1).
 */
export function creditsOfEvent(event: BillingEvent, panelUnitCost?: number): number {
  if (typeof event.credits_used === "number" && event.credits_used > 1) {
    return event.credits_used;
  }
  if (event.notes) {
    const match = event.notes.match(/(?:^|[·(]\s*)(\d+)\s+cr[eé]ditos?\b/i);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 120) return parsed;
    }
  }
  if (panelUnitCost && panelUnitCost > 0 && event.credit_cost > panelUnitCost) {
    const ratio = event.credit_cost / panelUnitCost;
    const rounded = Math.round(ratio);
    if (rounded >= 1 && rounded <= 120 && Math.abs(ratio - rounded) < 0.01) {
      return rounded;
    }
  }
  return Math.max(1, event.credits_used || 1);
}

export function summarizeMonth(
  month: string,
  monthEvents: BillingEvent[],
  monthExpenses: Expense[],
  panels: Pick<Panel, "id" | "name" | "credit_cost">[] = [],
): MonthSummary {
  const panelNames = new Map(panels.map((p) => [p.id, p.name]));
  const panelCosts = new Map(panels.map((p) => [p.id, p.credit_cost]));
  let newCount = 0;
  let newAmount = 0;
  let renewalCount = 0;
  let renewalAmount = 0;
  let commissionCount = 0;
  let commissions = 0;
  let creditCount = 0;
  let credits = 0;
  const paying = new Set<string>();
  const panelMap = new Map<
    string,
    Omit<PanelCostLine, "priceTiers"> & { tiers: Map<string, PanelPriceTier> }
  >();

  for (const e of monthEvents) {
    if (e.event_type === "new_subscription") {
      newCount += 1;
      newAmount += e.gross_amount;
    } else {
      renewalCount += 1;
      renewalAmount += e.gross_amount;
    }
    if (e.commission_amount > 0) {
      commissionCount += 1;
      commissions += e.commission_amount;
    }
    if (!e.is_internal && e.gross_amount > 0) paying.add(e.customer_id ?? `event:${e.id}`);

    const knownUnitCost = e.panel_id ? panelCosts.get(e.panel_id) : undefined;
    const used = creditsOfEvent(e, knownUnitCost);
    const eventUnitCost = used > 0 ? round2(e.credit_cost / used) : round2(e.credit_cost);

    creditCount += used;
    credits += e.credit_cost;
    const name = e.panel_name_snapshot || (e.panel_id ? panelNames.get(e.panel_id) : undefined) || "Sem painel";
    const key = e.panel_id ?? `name:${name}`;
    const line = panelMap.get(key) ?? {
      key,
      name,
      count: 0,
      payingCount: 0,
      internalCount: 0,
      total: 0,
      unitCost: 0,
      mixedCost: false,
      tiers: new Map<string, PanelPriceTier>(),
    };
    line.count += used;
    if (e.is_internal) line.internalCount += used;
    else line.payingCount += used;
    line.total += e.credit_cost;

    const tierKey = eventUnitCost.toFixed(2);
    const tier = line.tiers.get(tierKey) ?? { unitCost: eventUnitCost, count: 0, total: 0 };
    tier.count += used;
    tier.total = round2(tier.total + e.credit_cost);
    line.tiers.set(tierKey, tier);

    panelMap.set(key, line);
  }

  const panelLines: PanelCostLine[] = [...panelMap.values()]
    .map(({ tiers, ...line }) => {
      const priceTiers = [...tiers.values()].sort((a, b) => b.count - a.count || b.unitCost - a.unitCost);
      return {
        ...line,
        total: round2(line.total),
        unitCost: line.count > 0 ? round2(line.total / line.count) : 0,
        mixedCost: priceTiers.length > 1,
        priceTiers,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));

  const expenseMap = new Map<ExpenseCategory, ExpenseCategoryLine>();
  let expenses = 0;
  for (const x of monthExpenses) {
    expenses += x.amount;
    const line = expenseMap.get(x.category) ?? { category: x.category, count: 0, amount: 0 };
    line.count += 1;
    line.amount += x.amount;
    expenseMap.set(x.category, line);
  }
  const expenseLines = EXPENSE_CATEGORIES.flatMap((c) => {
    const line = expenseMap.get(c);
    return line ? [{ ...line, amount: round2(line.amount) }] : [];
  }).sort((a, b) => b.amount - a.amount);

  const gross = round2(newAmount + renewalAmount);
  const totalDeductions = round2(commissions + credits + expenses);
  const net = round2(gross - totalDeductions);

  return {
    month,
    eventCount: monthEvents.length,
    newCount,
    newAmount: round2(newAmount),
    renewalCount,
    renewalAmount: round2(renewalAmount),
    gross,
    commissionCount,
    commissions: round2(commissions),
    creditCount,
    credits: round2(credits),
    panelLines,
    expenseCount: monthExpenses.length,
    expenses: round2(expenses),
    expenseLines,
    totalDeductions,
    net,
    margin: gross > 0 ? (net / gross) * 100 : null,
    perPartner: round2(net / PARTNERS_COUNT),
    payingCustomers: paying.size,
    arpu: paying.size > 0 ? round2(gross / paying.size) : null,
  };
}

export type EvolutionRow = MonthSummary & {
  /** Número sequencial (Mês 1, Mês 2...). */
  index: number;
  grossGrowth: number | null;
  netGrowth: number | null;
};

function growth(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Comparativo mês a mês de todos os meses informados (ordem crescente). */
export function buildEvolution(
  months: string[],
  events: BillingEvent[],
  expenses: Expense[],
  panels: Pick<Panel, "id" | "name" | "credit_cost">[] = [],
): EvolutionRow[] {
  const eventsByMonth = groupByMonth(events);
  const expensesByMonth = groupByMonth(expenses);
  const rows: EvolutionRow[] = [];
  for (const [i, month] of months.entries()) {
    const summary = summarizeMonth(month, eventsByMonth.get(month) ?? [], expensesByMonth.get(month) ?? [], panels);
    const prev = rows[i - 1];
    rows.push({
      ...summary,
      index: i + 1,
      grossGrowth: growth(summary.gross, prev?.gross),
      netGrowth: growth(summary.net, prev?.net),
    });
  }
  return rows;
}

/* ---------------------------------------------------------------- Churn --- */

export type ChurnCustomer = FinanceCustomer & {
  reason: "canceled" | "expired";
  /** Data em que o cliente passou a contar como perdido. */
  churnDate: string;
};

export type RiskCustomer = FinanceCustomer & { daysOverdue: number };

export type ChurnMetrics = {
  activeCount: number;
  lostCount: number;
  canceledCount: number;
  expiredCount: number;
  baseCount: number;
  /** `null` quando não há base (mês futuro ou sem clientes). */
  churnRate: number | null;
  retentionRate: number | null;
  lostRevenue: number;
  lost: ChurnCustomer[];
  atRisk: RiskCustomer[];
};

/**
 * Data em que o cliente conta como churn:
 * - cancelado → `canceled_at`;
 * - vencido há mais de 7 dias sem renovação → vencimento + 8 dias (se já passou).
 * Como renovar move o `expires_at` para frente, um vencimento antigo ainda
 * gravado significa que não houve renovação posterior.
 */
export function getChurnDate(customer: FinanceCustomer, today: string): { date: string; reason: ChurnCustomer["reason"] } | null {
  if (customer.canceled_at) return { date: customer.canceled_at, reason: "canceled" };
  const date = addDaysISO(customer.expires_at, CHURN_GRACE_DAYS + 1);
  return date <= today ? { date, reason: "expired" } : null;
}

function isPaying(customer: FinanceCustomer): boolean {
  return !customer.is_internal && customer.plan_value >= 0;
}

/**
 * Métricas de churn do mês. Acessos de uso interno ficam fora (não são
 * clientes pagantes). Um cliente "existe" no mês se foi cadastrado até o fim
 * do mês ou se tem lançamento no Livro-Razão até aquele mês (importação retroativa).
 */
export function computeChurn(month: string, customers: FinanceCustomer[], events: BillingEvent[], today: string): ChurnMetrics {
  const { start, end } = monthBounds(month);
  const cutoff = end < today ? end : today;
  const empty: ChurnMetrics = {
    activeCount: 0,
    lostCount: 0,
    canceledCount: 0,
    expiredCount: 0,
    baseCount: 0,
    churnRate: null,
    retentionRate: null,
    lostRevenue: 0,
    lost: [],
    atRisk: [],
  };
  if (start > today) return empty;

  const firstEventMonth = new Map<string, string>();
  for (const e of events) {
    if (!e.customer_id) continue;
    const prev = firstEventMonth.get(e.customer_id);
    if (!prev || e.reference_month < prev) firstEventMonth.set(e.customer_id, e.reference_month);
  }

  let activeCount = 0;
  let lostRevenue = 0;
  const lost: ChurnCustomer[] = [];
  const atRisk: RiskCustomer[] = [];
  const isCurrentMonth = today >= start && today <= end;

  for (const c of customers) {
    if (!isPaying(c)) continue;
    const firstMonth = firstEventMonth.get(c.id);
    const existed = toAppDateISO(c.created_at) <= cutoff || (firstMonth !== undefined && firstMonth <= month);
    if (!existed) continue;

    const churn = getChurnDate(c, today);
    if (churn && churn.date < start) continue; // perdido em mês anterior
    if (churn && churn.date <= cutoff) {
      lost.push({ ...c, reason: churn.reason, churnDate: churn.date });
      lostRevenue += c.plan_value - (c.is_reseller ? RESELLER_COMMISSION : 0);
      continue;
    }
    activeCount += 1;

    if (isCurrentMonth && !c.canceled_at) {
      const days = getDaysRemaining(c.expires_at, today);
      if (days < 0 && days >= -CHURN_GRACE_DAYS) atRisk.push({ ...c, daysOverdue: -days });
    }
  }

  lost.sort((a, b) => b.churnDate.localeCompare(a.churnDate) || a.name.localeCompare(b.name, "pt-BR"));
  atRisk.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const lostCount = lost.length;
  const baseCount = activeCount + lostCount;
  const churnRate = baseCount > 0 ? (lostCount / baseCount) * 100 : null;

  return {
    activeCount,
    lostCount,
    canceledCount: lost.filter((c) => c.reason === "canceled").length,
    expiredCount: lost.filter((c) => c.reason === "expired").length,
    baseCount,
    churnRate,
    retentionRate: churnRate === null ? null : 100 - churnRate,
    lostRevenue: round2(lostRevenue),
    lost,
    atRisk,
  };
}
