"use server";

import { revalidatePath } from "next/cache";
import {
  BILLING_EVENT_COLUMNS,
  CREDIT_BATCH_COLUMNS,
  EXPENSE_COLUMNS,
  FINANCE_CUSTOMER_COLUMNS,
  GENERIC_ERROR,
  PANEL_COLUMNS,
  fetchPanelOption,
  invalidForm,
  isForeignKeyViolation,
  logDbError,
  normalizeBillingEvent,
  normalizeCreditBatch,
  normalizeExpense,
  normalizeFinanceCustomer,
  normalizePanel,
} from "@/lib/action-utils";
import { fetchAllRows, requireAdminOrRedirect } from "@/lib/auth";
import { getBillingAmounts } from "@/lib/business";
import { getTodayISO, toAppDateISO } from "@/lib/date";
import {
  billingEventFormSchema,
  importCustomersSchema,
  toBillingEventRow,
  uuidSchema,
  type BillingEventFormValues,
  type ImportCustomersInput,
} from "@/lib/finance-validations";
import { formatCurrency } from "@/lib/format";
import { dayInMonth, formatMonthLabel, getCurrentMonth, monthOf } from "@/lib/month";
import type { ActionResult, BillingEventType, FinanceData } from "@/lib/types";

/**
 * Módulo financeiro (Livro-Razão mensal) — exclusivo dos admins.
 * Toda action valida sessão e cargo no servidor (revendedor → `/`); o RLS de
 * `billing_events`, `expenses` e `panels` é a segunda barreira.
 */

const CHUNK_SIZE = 100;

function chunk<T>(items: T[], size = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/");
}

/* ------------------------------------------------------------------ READ --- */

/**
 * Todos os dados do módulo em uma ida ao banco (consultas paralelas e
 * paginadas). Os recortes por mês são calculados no cliente, o que deixa a
 * troca de mês instantânea.
 */
export async function getFinanceData(): Promise<FinanceData> {
  const { supabase } = await requireAdminOrRedirect();

  const [panelsRes, batchesRes, eventsRes, expensesRes, customersRes] = await Promise.all([
    supabase.from("panels").select(PANEL_COLUMNS).order("is_active", { ascending: false }).order("name", { ascending: true }),
    supabase
      .from("panel_credit_batches")
      .select(CREDIT_BATCH_COLUMNS)
      .order("purchased_at", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    fetchAllRows((from, to) =>
      supabase
        .from("billing_events")
        .select(BILLING_EVENT_COLUMNS)
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("expenses")
        .select(EXPENSE_COLUMNS)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("customers")
        .select(FINANCE_CUSTOMER_COLUMNS)
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const failed = [
    ["panels", panelsRes.error],
    ["batches", batchesRes.error],
    ["events", eventsRes.error],
    ["expenses", expensesRes.error],
    ["customers", customersRes.error],
  ] as const;
  for (const [scope, error] of failed) {
    if (error) {
      logDbError(`finance:get-${scope}`, error);
      throw new Error("Falha ao carregar os dados financeiros.");
    }
  }

  return {
    panels: ((panelsRes.data ?? []) as Record<string, unknown>[]).map(normalizePanel),
    batches: ((batchesRes.data ?? []) as Record<string, unknown>[]).map(normalizeCreditBatch),
    events: eventsRes.data.map(normalizeBillingEvent),
    expenses: expensesRes.data.map(normalizeExpense),
    customers: customersRes.data.map(normalizeFinanceCustomer),
  };
}

/* ------------------------------------------------- Lançamento manual (CRUD) --- */

async function resolvePanelSnapshot(
  supabase: Awaited<ReturnType<typeof requireAdminOrRedirect>>["supabase"],
  panelId: string | null,
): Promise<{ ok: true; name: string | null } | { ok: false; result: ActionResult }> {
  if (!panelId) return { ok: true, name: null };
  const panel = await fetchPanelOption(supabase, panelId);
  if (!panel) {
    return {
      ok: false,
      result: { ok: false, error: "Painel não encontrado.", fieldErrors: { panel_id: ["Painel não encontrado"] } },
    };
  }
  return { ok: true, name: panel.name };
}

export async function createBillingEvent(values: BillingEventFormValues): Promise<ActionResult> {
  const { supabase, user } = await requireAdminOrRedirect();

  const parsed = billingEventFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);
  const row = toBillingEventRow(parsed.data);

  const snapshot = await resolvePanelSnapshot(supabase, row.panel_id);
  if (!snapshot.ok) return snapshot.result;

  const { error } = await supabase
    .from("billing_events")
    .insert({ ...row, panel_name_snapshot: snapshot.name, created_by: user.id });

  if (error) {
    logDbError("finance:create-event", error);
    return { ok: false, error: isForeignKeyViolation(error) ? "Cliente ou painel não existe mais." : GENERIC_ERROR };
  }

  revalidateFinance();
  return {
    ok: true,
    message: `Lançamento de ${formatCurrency(row.gross_amount)} registrado em ${formatMonthLabel(row.reference_month)}.`,
  };
}

export async function updateBillingEvent(id: string, values: BillingEventFormValues): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Lançamento inválido." };
  const parsed = billingEventFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);
  const row = toBillingEventRow(parsed.data);

  const snapshot = await resolvePanelSnapshot(supabase, row.panel_id);
  if (!snapshot.ok) return snapshot.result;

  const { data, error } = await supabase
    .from("billing_events")
    .update({ ...row, panel_name_snapshot: snapshot.name })
    .eq("id", idParsed.data)
    .select("id");

  if (error) {
    logDbError("finance:update-event", error);
    return { ok: false, error: isForeignKeyViolation(error) ? "Cliente ou painel não existe mais." : GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Lançamento não encontrado." };

  revalidateFinance();
  return { ok: true, message: "Lançamento atualizado" };
}

export async function deleteBillingEvent(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Lançamento inválido." };

  const { data, error } = await supabase.from("billing_events").delete().eq("id", idParsed.data).select("id");
  if (error) {
    logDbError("finance:delete-event", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Lançamento não encontrado." };

  revalidateFinance();
  return { ok: true, message: "Lançamento excluído." };
}

/* ------------------------------------------------ Importação retroativa --- */

/**
 * "Sincronizar clientes atuais neste mês": cria 1 lançamento por cliente
 * selecionado que ainda não tenha registro no mês. Os valores são lidos do
 * banco (nunca do navegador) e a deduplicação é refeita aqui no servidor.
 */
export async function importCustomersToMonth(input: ImportCustomersInput): Promise<ActionResult<{ imported: number }>> {
  const { supabase, user } = await requireAdminOrRedirect();

  const parsed = importCustomersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Requisição inválida." };
  const { month, mode } = parsed.data;
  const ids = [...new Set(parsed.data.customerIds)];

  const customerRows: Record<string, unknown>[] = [];
  const existing = new Set<string>();
  for (const part of chunk(ids)) {
    const [customersRes, eventsRes] = await Promise.all([
      supabase.from("customers").select(FINANCE_CUSTOMER_COLUMNS).in("id", part),
      supabase.from("billing_events").select("customer_id").eq("reference_month", month).in("customer_id", part),
    ]);
    if (customersRes.error || eventsRes.error) {
      logDbError("finance:import-read", (customersRes.error ?? eventsRes.error)!);
      return { ok: false, error: GENERIC_ERROR };
    }
    customerRows.push(...((customersRes.data ?? []) as Record<string, unknown>[]));
    for (const e of (eventsRes.data ?? []) as Record<string, unknown>[]) {
      if (typeof e.customer_id === "string") existing.add(e.customer_id);
    }
  }

  const { data: panelData, error: panelError } = await supabase.from("panels").select(PANEL_COLUMNS);
  if (panelError) {
    logDbError("finance:import-panels", panelError);
    return { ok: false, error: GENERIC_ERROR };
  }
  const panels = new Map(((panelData ?? []) as Record<string, unknown>[]).map((r) => [String(r.id), normalizePanel(r)]));

  const today = getTodayISO();
  const isCurrentMonth = month === getCurrentMonth(today);

  const rows = customerRows
    .map(normalizeFinanceCustomer)
    .filter((c) => !existing.has(c.id))
    .map((c) => {
      const panel = c.panel_id ? panels.get(c.panel_id) : undefined;
      const eventType: BillingEventType =
        mode === "auto" ? (monthOf(toAppDateISO(c.created_at)) === month ? "new_subscription" : "renewal") : mode;
      // Data do lançamento = dia do ciclo do cliente dentro do mês (nunca no futuro do mês atual).
      let eventDate = dayInMonth(month, Number(c.expires_at.slice(8, 10)));
      if (isCurrentMonth && eventDate > today) eventDate = today;
      return {
        customer_id: c.id,
        customer_name_snapshot: c.name,
        panel_id: panel ? panel.id : null,
        panel_name_snapshot: panel ? panel.name : null,
        event_type: eventType,
        reference_month: month,
        event_date: eventDate,
        ...getBillingAmounts(c),
        credit_cost: panel ? panel.credit_cost : 0,
        credits_used: 1,
        credit_batch_id: null,
        notes: "Importação retroativa",
        created_by: user.id,
      };
    });

  if (rows.length === 0) {
    return { ok: true, message: "Todos os clientes selecionados já tinham lançamento neste mês.", data: { imported: 0 } };
  }

  let imported = 0;
  for (const part of chunk(rows)) {
    const { error } = await supabase.from("billing_events").insert(part);
    if (error) {
      logDbError("finance:import-insert", error);
      if (imported > 0) revalidateFinance();
      return {
        ok: false,
        error:
          imported > 0
            ? `Importação parcial: ${imported} lançamento(s) criados antes de uma falha. Tente novamente para completar.`
            : GENERIC_ERROR,
      };
    }
    imported += part.length;
  }

  revalidateFinance();
  const skipped = ids.length - imported;
  return {
    ok: true,
    message: `${imported} cliente(s) importado(s) em ${formatMonthLabel(month)}${skipped > 0 ? ` · ${skipped} ignorado(s)` : ""}.`,
    data: { imported },
  };
}
