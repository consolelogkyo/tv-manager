/**
 * Cargo do usuário logado (coluna `public.admins.role`).
 * - `admin`: vendedores principais — veem todos os clientes e o módulo financeiro.
 * - `reseller`: revendedor — vê apenas os próprios clientes (RLS por `owner_id`).
 */
export type UserRole = "admin" | "reseller";

export const USER_ROLES = ["admin", "reseller"] as const satisfies readonly UserRole[];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  mac_address: string;
  app_name: string | null;
  /**
   * Valor mensal cobrado. Clientes antigos podem ter valor negativo (custo
   * interno legado); os novos usam `is_internal = true` com valor 0.
   */
  plan_value: number;
  expires_at: string; // YYYY-MM-DD — vencimento técnico do sinal da TV
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  /** `true` quando o cliente foi cadastrado pelo revendedor. */
  is_reseller: boolean;
  /** YYYY-MM-DD — data alternativa de pagamento (exclusivo admin). Sempre `null` para o revendedor. */
  payment_date: string | null;
  /** Painel/servidor do cliente (exclusivo admin). Sempre `null` na visão do revendedor. */
  panel_id: string | null;
  /** YYYY-MM-DD — data do cancelamento (churn). `null` = cliente na carteira. */
  canceled_at: string | null;
  /** Acesso de uso próprio/familiar: consome crédito, mas não gera receita (exclusivo admin). */
  is_internal: boolean;
};

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type RenewMode = "auto" | "from_expiry" | "from_today";

/* --------------------------------------------------------------- Painéis --- */

export type Panel = {
  id: string;
  name: string;
  /** Custo de 1 crédito (R$) neste painel. */
  credit_cost: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Dados mínimos de painel usados no formulário/lista de clientes. */
export type PanelOption = Pick<Panel, "id" | "name" | "credit_cost" | "is_active">;

export type PanelCreditBatch = {
  id: string;
  panel_id: string;
  label: string;
  unit_cost: number;
  quantity_total: number;
  quantity_remaining: number;
  /** `YYYY-MM-DD` */
  purchased_at: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const CREDIT_SOURCE_MODES = ["batch", "panel_default", "custom"] as const;
export type CreditSourceMode = (typeof CREDIT_SOURCE_MODES)[number];

export type CreditSourceValue = {
  mode: CreditSourceMode;
  batchId: string;
  customUnitCost: string;
};

/* --------------------------------------------------------- Livro-Razão --- */

export const BILLING_EVENT_TYPES = ["new_subscription", "renewal"] as const;
export type BillingEventType = (typeof BILLING_EVENT_TYPES)[number];

export type BillingEvent = {
  id: string;
  customer_id: string | null;
  customer_name_snapshot: string;
  panel_id: string | null;
  panel_name_snapshot: string | null;
  event_type: BillingEventType;
  /** `YYYY-MM` */
  reference_month: string;
  /** `YYYY-MM-DD` */
  event_date: string;
  gross_amount: number;
  commission_amount: number;
  credit_cost: number;
  credits_used: number;
  credit_batch_id: string | null;
  is_reseller: boolean;
  is_internal: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

/* ------------------------------------------------------------- Despesas --- */

export const EXPENSE_CATEGORIES = [
  "panel_migration",
  "whatsapp_chip",
  "app_license",
  "marketing",
  "infrastructure",
  "internal_use",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  /** `YYYY-MM` */
  reference_month: string;
  /** `YYYY-MM-DD` */
  expense_date: string;
  customer_id: string | null;
  panel_id: string | null;
  credits_used: number;
  credit_batch_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

/* ----------------------------------------------------------- Financeiro --- */

/** Recorte de cliente usado pelo módulo financeiro (churn, importação, vínculos). */
export type FinanceCustomer = Pick<
  Customer,
  | "id"
  | "name"
  | "phone"
  | "plan_value"
  | "expires_at"
  | "created_at"
  | "canceled_at"
  | "is_internal"
  | "is_reseller"
  | "panel_id"
>;

export type FinanceData = {
  panels: Panel[];
  batches: PanelCreditBatch[];
  events: BillingEvent[];
  expenses: Expense[];
  customers: FinanceCustomer[];
};

export const FINANCE_TABS = ["overview", "evolution", "expenses", "panels"] as const;
export type FinanceTab = (typeof FINANCE_TABS)[number];

export function isFinanceTab(value: unknown): value is FinanceTab {
  return typeof value === "string" && (FINANCE_TABS as readonly string[]).includes(value);
}

/** Modo de importação retroativa de clientes para o Livro-Razão. */
export type ImportMode = "auto" | BillingEventType;

/* ------------------------------------------------------ Catálogo de Apps --- */

/** 1 = 1ª opção (alta) · 2 = reserva (média) · 3 = fim da fila (baixa) */
export type TvAppPriority = 1 | 2 | 3;

export type TvApp = {
  id: string;
  tv_brand: string;
  app_name: string;
  priority: TvAppPriority;
  is_favorite: boolean;
  license_info: string | null;
  activation_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Sugestão de app (deduplicada por nome) usada no formulário de clientes. */
export type AppSuggestion = {
  name: string;
  isFavorite: boolean;
  bestPriority: TvAppPriority;
  brands: string[];
};

export type PriorityDirection = "up" | "down";
