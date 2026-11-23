import "server-only";

import type {
  ActionResult,
  BillingEvent,
  Expense,
  FinanceCustomer,
  Panel,
  PanelCreditBatch,
  PanelOption,
} from "@/lib/types";
import { BILLING_EVENT_TYPES, EXPENSE_CATEGORIES } from "@/lib/types";
import type { createClient } from "@/utils/supabase/server";

/**
 * Utilitários compartilhados pelas Server Actions (normalização de linhas do
 * banco, logs sem dados sensíveis e respostas de erro genéricas).
 */

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente.";

type DbError = { code?: string; message?: string };

/** Detalhes ficam apenas no log do servidor; o usuário recebe mensagem genérica. */
export function logDbError(scope: string, error: DbError) {
  console.error(`[${scope}]`, { code: error.code, message: error.message });
}

/** Violação de FK (registro em uso / referência inexistente). */
export const isForeignKeyViolation = (error: DbError) => error.code === "23503";
/** Violação de UNIQUE. */
export const isUniqueViolation = (error: DbError) => error.code === "23505";

export function invalidForm(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): ActionResult {
  return { ok: false, error: "Verifique os campos destacados.", fieldErrors: error.flatten().fieldErrors };
}

const toNumber = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const toStringOrNull = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

/* --------------------------------------------------------------- Painéis --- */

export const PANEL_COLUMNS = "id, name, credit_cost, is_active, notes, created_at, updated_at";

export function normalizePanel(row: Record<string, unknown>): Panel {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    credit_cost: toNumber(row.credit_cost),
    is_active: row.is_active !== false,
    notes: toStringOrNull(row.notes),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Lê um painel (admin). `null` se não existir ou se a leitura falhar. */
export async function fetchPanelOption(supabase: SupabaseServerClient, id: string): Promise<PanelOption | null> {
  const { data, error } = await supabase
    .from("panels")
    .select("id, name, credit_cost, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logDbError("panels:fetch", error);
    return null;
  }
  if (!data) return null;
  const panel = normalizePanel(data as Record<string, unknown>);
  return { id: panel.id, name: panel.name, credit_cost: panel.credit_cost, is_active: panel.is_active };
}

/* ----------------------------------------------------- Lotes de Crédito --- */

export const CREDIT_BATCH_COLUMNS =
  "id, panel_id, label, unit_cost, quantity_total, quantity_remaining, purchased_at, is_active, notes, created_by, created_at, updated_at";

export function normalizeCreditBatch(row: Record<string, unknown>): PanelCreditBatch {
  const total = Math.max(1, Math.trunc(toNumber(row.quantity_total ?? 1)));
  const remaining = Math.min(total, Math.max(0, Math.trunc(toNumber(row.quantity_remaining ?? 0))));
  return {
    id: String(row.id),
    panel_id: String(row.panel_id ?? ""),
    label: String(row.label ?? ""),
    unit_cost: toNumber(row.unit_cost),
    quantity_total: total,
    quantity_remaining: remaining,
    purchased_at: String(row.purchased_at ?? ""),
    is_active: row.is_active !== false,
    notes: toStringOrNull(row.notes),
    created_by: toStringOrNull(row.created_by),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** Lê um lote de créditos (admin). `null` se não existir ou se a leitura falhar. */
export async function fetchCreditBatch(supabase: SupabaseServerClient, id: string): Promise<PanelCreditBatch | null> {
  const { data, error } = await supabase
    .from("panel_credit_batches")
    .select(CREDIT_BATCH_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logDbError("batches:fetch", error);
    return null;
  }
  if (!data) return null;
  return normalizeCreditBatch(data as Record<string, unknown>);
}

/* ---------------------------------------------------------- Livro-Razão --- */

export const BILLING_EVENT_COLUMNS =
  "id, customer_id, customer_name_snapshot, panel_id, panel_name_snapshot, event_type, reference_month, event_date, gross_amount, commission_amount, credit_cost, credits_used, credit_batch_id, is_reseller, is_internal, notes, created_by, created_at";

export function normalizeBillingEvent(row: Record<string, unknown>): BillingEvent {
  const type = row.event_type;
  return {
    id: String(row.id),
    customer_id: toStringOrNull(row.customer_id),
    customer_name_snapshot: String(row.customer_name_snapshot ?? ""),
    panel_id: toStringOrNull(row.panel_id),
    panel_name_snapshot: toStringOrNull(row.panel_name_snapshot),
    event_type: (BILLING_EVENT_TYPES as readonly unknown[]).includes(type) ? (type as BillingEvent["event_type"]) : "renewal",
    reference_month: String(row.reference_month ?? ""),
    event_date: String(row.event_date ?? ""),
    gross_amount: toNumber(row.gross_amount),
    commission_amount: toNumber(row.commission_amount),
    credit_cost: toNumber(row.credit_cost),
    credits_used: Math.max(1, Math.trunc(toNumber(row.credits_used ?? 1))),
    credit_batch_id: toStringOrNull(row.credit_batch_id),
    is_reseller: row.is_reseller === true,
    is_internal: row.is_internal === true,
    notes: toStringOrNull(row.notes),
    created_by: toStringOrNull(row.created_by),
    created_at: String(row.created_at ?? ""),
  };
}

/* ------------------------------------------------------------- Despesas --- */

export const EXPENSE_COLUMNS =
  "id, title, category, amount, reference_month, expense_date, customer_id, panel_id, credits_used, credit_batch_id, notes, created_by, created_at";

export function normalizeExpense(row: Record<string, unknown>): Expense {
  const category = row.category;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    category: (EXPENSE_CATEGORIES as readonly unknown[]).includes(category) ? (category as Expense["category"]) : "other",
    amount: toNumber(row.amount),
    reference_month: String(row.reference_month ?? ""),
    expense_date: String(row.expense_date ?? ""),
    customer_id: toStringOrNull(row.customer_id),
    panel_id: toStringOrNull(row.panel_id),
    credits_used: Math.max(0, Math.trunc(toNumber(row.credits_used ?? 0))),
    credit_batch_id: toStringOrNull(row.credit_batch_id),
    notes: toStringOrNull(row.notes),
    created_by: toStringOrNull(row.created_by),
    created_at: String(row.created_at ?? ""),
  };
}

/* ------------------------------------------------------------- Clientes --- */

export const FINANCE_CUSTOMER_COLUMNS =
  "id, name, phone, plan_value, expires_at, created_at, canceled_at, is_internal, is_reseller, panel_id";

export function normalizeFinanceCustomer(row: Record<string, unknown>): FinanceCustomer {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    phone: toStringOrNull(row.phone),
    plan_value: toNumber(row.plan_value),
    expires_at: String(row.expires_at ?? ""),
    created_at: String(row.created_at ?? ""),
    canceled_at: toStringOrNull(row.canceled_at),
    is_internal: row.is_internal === true,
    is_reseller: row.is_reseller === true,
    panel_id: toStringOrNull(row.panel_id),
  };
}
