"use server";

import { revalidatePath } from "next/cache";
import {
  GENERIC_ERROR,
  fetchCreditBatch,
  fetchPanelOption,
  isForeignKeyViolation,
  logDbError,
  type SupabaseServerClient,
} from "@/lib/action-utils";
import { getAuthContext } from "@/lib/auth";
import { RENEW_PERIOD_META, RESELLER_COMMISSION, getBillingAmounts, isInternalCustomer, round2 } from "@/lib/business";
import { formatDateBR, getTodayISO } from "@/lib/date";
import { formatCurrency, parseCurrency } from "@/lib/format";
import { getCurrentMonth } from "@/lib/month";
import type { ActionResult, BillingEventType, CreditSourceMode, Customer, PanelOption, UserRole } from "@/lib/types";
import {
  customerIdSchema,
  getCustomerFormSchema,
  renewCustomerInputSchema,
  toCustomerRow,
  type CustomerFormValues,
  type RenewCustomerInput,
} from "@/lib/validations";

const BASE_COLUMNS =
  "id, name, phone, mac_address, app_name, plan_value, expires_at, notes, created_by, created_at, updated_at, owner_id, is_reseller, canceled_at";

/**
 * Colunas exclusivas dos admins (`payment_date`, `panel_id`, `is_internal`)
 * nem são selecionadas para o revendedor.
 */
const COLUMNS_BY_ROLE: Record<UserRole, string> = {
  admin: `${BASE_COLUMNS}, payment_date, panel_id, is_internal`,
  reseller: BASE_COLUMNS,
};

const UNAUTHORIZED = "Sessão expirada. Faça login novamente.";
const FORBIDDEN = "Você não tem permissão para esta ação.";
const LEDGER_WARNING = " Atenção: o lançamento financeiro não foi registrado.";

type AuthOk = Extract<Awaited<ReturnType<typeof getAuthContext>>, { user: object }> & { role: UserRole };

/**
 * Toda Server Action é um endpoint público (POST): autentica no servidor
 * antes de qualquer acesso aos dados. O RLS no banco é a segunda barreira.
 * Fail-closed: sem cargo válido em `public.admins` → acesso negado.
 */
async function requireUser(): Promise<{ ok: true; ctx: AuthOk } | { ok: false; error: string }> {
  const ctx = await getAuthContext();
  if (!ctx.user) return { ok: false, error: UNAUTHORIZED };
  if (!ctx.role) return { ok: false, error: FORBIDDEN };
  return { ok: true, ctx: ctx as AuthOk };
}

function normalizeCustomer(row: Record<string, unknown>, role: UserRole): Customer {
  const isAdmin = role === "admin";
  return {
    ...(row as Customer),
    plan_value: Number(row.plan_value ?? 0),
    is_reseller: row.is_reseller === true,
    owner_id: typeof row.owner_id === "string" ? row.owner_id : null,
    canceled_at: typeof row.canceled_at === "string" ? row.canceled_at : null,
    payment_date: isAdmin && typeof row.payment_date === "string" ? row.payment_date : null,
    panel_id: isAdmin && typeof row.panel_id === "string" ? row.panel_id : null,
    is_internal: isAdmin && row.is_internal === true,
  };
}

function revalidateCustomers() {
  revalidatePath("/");
  revalidatePath("/finance");
}

/* ----------------------------------------------------- Livro-Razão (auto) --- */

type LedgerCustomer = Pick<Customer, "id" | "name" | "plan_value" | "is_reseller" | "is_internal" | "panel_id">;

type ResolvedCreditSource = {
  creditBatchId: string | null;
  unitCost: number;
  totalCost: number;
  batchLabel: string | null;
};

/**
 * Resolve a origem e o custo do crédito escolhido pelo admin:
 * - "batch": usa `unit_cost` do lote selecionado e vincula `credit_batch_id` (o banco baixa o estoque);
 * - "custom": usa o valor unitário digitado (inclusive R$ 0,00 para brinde), sem baixar estoque;
 * - "panel_default": usa o `credit_cost` padrão do painel, sem baixar estoque.
 */
async function resolveCreditSourceForAdmin(
  supabase: SupabaseServerClient,
  params: {
    panel: PanelOption | null;
    mode: CreditSourceMode;
    batchId: string;
    customUnitCost: string;
    creditsUsed: number;
  },
): Promise<ResolvedCreditSource> {
  const { panel, mode, batchId, customUnitCost, creditsUsed } = params;
  const qty = Math.max(0, creditsUsed);
  if (!panel) {
    return { creditBatchId: null, unitCost: 0, totalCost: 0, batchLabel: null };
  }

  if (mode === "batch" && batchId) {
    const batch = await fetchCreditBatch(supabase, batchId);
    if (batch && batch.panel_id === panel.id) {
      return {
        creditBatchId: batch.id,
        unitCost: batch.unit_cost,
        totalCost: round2(batch.unit_cost * qty),
        batchLabel: batch.label,
      };
    }
  }

  if (mode === "custom" && customUnitCost.trim() !== "") {
    const parsed = parseCurrency(customUnitCost);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return {
        creditBatchId: null,
        unitCost: round2(parsed),
        totalCost: round2(parsed * qty),
        batchLabel: null,
      };
    }
  }

  return {
    creditBatchId: null,
    unitCost: panel.credit_cost,
    totalCost: round2(panel.credit_cost * qty),
    batchLabel: null,
  };
}

/**
 * Lança automaticamente uma assinatura/renovação em `billing_events`.
 * - admin: envia `credit_batch_id`, `credits_used` e o `credit_cost` resolvido;
 * - reseller: envia `credit_cost: null` e `credit_batch_id: null` para a trigger
 *   do banco aplicar o FIFO/padrão automaticamente.
 * Retorna `false` se o INSERT falhar — o cadastro/renovação em si não é desfeito.
 */
async function recordBillingEvent(
  supabase: SupabaseServerClient,
  params: {
    role: UserRole;
    userId: string;
    customer: LedgerCustomer;
    panel: PanelOption | null;
    eventType: BillingEventType;
    today: string;
    eventDate?: string;
    grossAmountOverride?: number;
    commissionMultiplier?: number;
    creditsUsed?: number;
    creditBatchId?: string | null;
    creditCostOverride?: number;
    notes?: string | null;
  },
): Promise<boolean> {
  const {
    role,
    userId,
    customer,
    panel,
    eventType,
    today,
    eventDate = today,
    grossAmountOverride,
    commissionMultiplier = 1,
    creditsUsed = 1,
    creditBatchId = null,
    creditCostOverride,
    notes = null,
  } = params;

  const defaults = getBillingAmounts(customer);
  const internal = isInternalCustomer(customer);
  const grossAmount = internal
    ? 0
    : grossAmountOverride !== undefined
      ? round2(Math.max(0, grossAmountOverride))
      : defaults.gross_amount;
  const commissionAmount =
    !internal && customer.is_reseller ? round2(RESELLER_COMMISSION * Math.max(1, commissionMultiplier)) : 0;
  const expectedCreditCost =
    creditCostOverride !== undefined
      ? round2(Math.max(0, creditCostOverride))
      : round2((panel?.credit_cost ?? 0) * Math.max(0, creditsUsed));

  const base = {
    customer_id: customer.id,
    customer_name_snapshot: customer.name,
    panel_id: customer.panel_id,
    event_type: eventType,
    reference_month: getCurrentMonth(eventDate),
    event_date: eventDate,
    gross_amount: grossAmount,
    commission_amount: commissionAmount,
    credits_used: Math.max(1, creditsUsed),
    is_internal: defaults.is_internal,
    is_reseller: role === "reseller" ? true : defaults.is_reseller,
    notes,
    created_by: userId,
  };

  // Para o revendedor, enviamos explicitamente credit_cost: null e credit_batch_id: null
  // para que a trigger do Supabase aplique o FIFO automaticamente.
  const row: Record<string, unknown> =
    role === "admin"
      ? {
          ...base,
          credit_cost: expectedCreditCost,
          credit_batch_id: creditBatchId,
          panel_name_snapshot: panel?.name ?? null,
        }
      : {
          ...base,
          credit_cost: null,
          credit_batch_id: null,
        };

  const { error } = await supabase.from("billing_events").insert(row);
  if (error) {
    logDbError("customers:ledger", error);
    return false;
  }
  return true;
}

/** Valida o painel escolhido pelo admin. Painel inativo só é aceito se já era o painel do cliente. */
async function resolvePanelForAdmin(
  supabase: SupabaseServerClient,
  panelId: string | null,
  currentPanelId: string | null,
): Promise<{ ok: true; panel: PanelOption | null } | { ok: false; result: ActionResult }> {
  if (!panelId) return { ok: true, panel: null };
  const panel = await fetchPanelOption(supabase, panelId);
  if (!panel) {
    return { ok: false, result: { ok: false, error: "Painel não encontrado.", fieldErrors: { panel_id: ["Painel não encontrado"] } } };
  }
  if (!panel.is_active && panel.id !== currentPanelId) {
    return { ok: false, result: { ok: false, error: "Este painel está inativo.", fieldErrors: { panel_id: ["Painel inativo"] } } };
  }
  return { ok: true, panel };
}

/* ------------------------------------------------------------------ READ --- */

export async function getCustomers(): Promise<Customer[]> {
  const auth = await requireUser();
  if (!auth.ok) return [];
  const { supabase, user, role } = auth.ctx;

  let query = supabase.from("customers").select(COLUMNS_BY_ROLE[role]);
  // Reforço do RLS: o revendedor só enxerga os próprios clientes.
  if (role === "reseller") query = query.eq("owner_id", user.id);

  const { data, error } = await query
    .order("expires_at", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logDbError("customers:get", error);
    throw new Error("Falha ao carregar clientes.");
  }

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => normalizeCustomer(row, role));
}

/* ---------------------------------------------------------------- CREATE --- */

export async function createCustomer(values: CustomerFormValues): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user, role } = auth.ctx;

  // Schema escolhido pelo cargo lido do banco — nunca por algo enviado pelo cliente.
  const parsed = getCustomerFormSchema(role).safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const row = toCustomerRow(parsed.data, role);

  let panel: PanelOption | null = null;
  if (role === "admin" && "panel_id" in row) {
    const resolved = await resolvePanelForAdmin(supabase, row.panel_id, null);
    if (!resolved.ok) return resolved.result;
    panel = resolved.panel;
  }

  const isReseller = role === "reseller";
  const { data: inserted, error } = await supabase
    .from("customers")
    .insert({
      ...row,
      // Definidos no servidor — nunca confiamos no valor vindo do cliente.
      created_by: user.email ?? null,
      owner_id: user.id,
      is_reseller: isReseller,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error) logDbError("customers:create", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  const creditSource =
    role === "admin"
      ? await resolveCreditSourceForAdmin(supabase, {
          panel,
          mode: parsed.data.credit_source_mode,
          batchId: parsed.data.credit_batch_id,
          customUnitCost: parsed.data.custom_credit_cost,
          creditsUsed: 1,
        })
      : null;

  const ledgerOk = await recordBillingEvent(supabase, {
    role,
    userId: user.id,
    customer: {
      id: String(inserted.id),
      name: row.name,
      plan_value: row.plan_value,
      is_reseller: isReseller,
      is_internal: "is_internal" in row ? row.is_internal : false,
      panel_id: "panel_id" in row ? row.panel_id : null,
    },
    panel,
    eventType: "new_subscription",
    today: getTodayISO(),
    creditsUsed: 1,
    creditBatchId: creditSource?.creditBatchId ?? null,
    creditCostOverride: creditSource?.totalCost,
  });

  revalidateCustomers();
  return { ok: true, message: `Cliente ${parsed.data.name} cadastrado${ledgerOk ? "" : `.${LEDGER_WARNING}`}` };
}

/* ---------------------------------------------------------------- UPDATE --- */

export async function updateCustomer(id: string, values: CustomerFormValues): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user, role } = auth.ctx;

  const idParsed = customerIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Cliente inválido." };

  const parsed = getCustomerFormSchema(role).safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const row = toCustomerRow(parsed.data, role);

  // Admin: lê o painel atual para validar a troca e lançar o custo invisível.
  let previousPanelId: string | null = null;
  let newPanel: PanelOption | null = null;
  if (role === "admin" && "panel_id" in row) {
    const { data: current, error: readError } = await supabase
      .from("customers")
      .select("id, panel_id")
      .eq("id", idParsed.data)
      .maybeSingle();
    if (readError) {
      logDbError("customers:update-read", readError);
      return { ok: false, error: GENERIC_ERROR };
    }
    if (!current) return { ok: false, error: "Cliente não encontrado." };
    previousPanelId = typeof current.panel_id === "string" ? current.panel_id : null;

    const resolved = await resolvePanelForAdmin(supabase, row.panel_id, previousPanelId);
    if (!resolved.ok) return resolved.result;
    newPanel = resolved.panel;
  }

  // `owner_id` e `is_reseller` não fazem parte do UPDATE: a posse do cliente é imutável pelo app.
  let query = supabase.from("customers").update(row).eq("id", idParsed.data);
  if (role === "reseller") query = query.eq("owner_id", user.id);

  const { data, error } = await query.select("id");

  if (error) {
    logDbError("customers:update", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Cliente não encontrado." };

  // Troca de painel com crédito extra → despesa "panel_migration" no mês atual.
  let extra = "";
  const panelChanged = Boolean(previousPanelId && newPanel && newPanel.id !== previousPanelId);
  if (role === "admin" && parsed.data.charge_panel_migration && panelChanged && newPanel) {
    const migrationCredit = await resolveCreditSourceForAdmin(supabase, {
      panel: newPanel,
      mode: parsed.data.credit_source_mode,
      batchId: parsed.data.credit_batch_id,
      customUnitCost: parsed.data.custom_credit_cost,
      creditsUsed: 1,
    });

    if (migrationCredit.totalCost <= 0) {
      extra = " Custo do crédito da troca é R$ 0,00 — nenhuma despesa lançada.";
    } else {
      const oldPanel = previousPanelId ? await fetchPanelOption(supabase, previousPanelId) : null;
      const today = getTodayISO();
      const title = `Troca de painel - ${row.name} (${oldPanel?.name ?? "Painel anterior"} → ${newPanel.name})`.slice(0, 120);
      const { error: expenseError } = await supabase.from("expenses").insert({
        title,
        category: "panel_migration",
        amount: migrationCredit.totalCost,
        reference_month: getCurrentMonth(today),
        expense_date: today,
        customer_id: idParsed.data,
        panel_id: newPanel.id,
        credits_used: 1,
        credit_batch_id: migrationCredit.creditBatchId,
        notes: migrationCredit.batchLabel ? `Lote: ${migrationCredit.batchLabel}` : null,
        created_by: user.id,
      });
      if (expenseError) {
        logDbError("customers:migration-expense", expenseError);
        extra = " Atenção: a despesa da troca de painel não foi lançada.";
      } else {
        extra = ` Despesa de ${formatCurrency(migrationCredit.totalCost)} lançada (troca de painel).`;
      }
    }
  }

  revalidateCustomers();
  return { ok: true, message: `Alterações salvas${extra ? `.${extra}` : ""}` };
}

/* ----------------------------------------------------------------- RENEW --- */

/**
 * Renovação configurável (também reativa clientes cancelados):
 * - permite escolher período (1, 2, 3, 6, 12 meses), telas, valor cobrado,
 *   data do novo vencimento, data do pagamento e créditos consumidos no painel;
 * - opcionalmente atualiza `plan_value` no cadastro do cliente;
 * - registra o lançamento `renewal` no Livro-Razão do mês da data de pagamento.
 */
export async function renewCustomer(input: RenewCustomerInput): Promise<ActionResult<{ expires_at: string }>> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user, role } = auth.ctx;

  const parsed = renewCustomerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Requisição inválida." };
  }
  const {
    customerId,
    months,
    screens,
    expires_at: newExpiresAt,
    payment_date: paymentDate,
    gross_amount: grossInput,
    credits_used: creditsInput,
    update_plan_value: shouldUpdatePlanValue,
    credit_source_mode: creditSourceMode,
    credit_batch_id: creditBatchIdInput,
    custom_credit_cost: customCreditCostInput,
  } = parsed.data;

  // Campos financeiros são lidos apenas no servidor para montar o lançamento.
  let readQuery = supabase
    .from("customers")
    .select("id, name, expires_at, plan_value, is_reseller, is_internal, panel_id, canceled_at")
    .eq("id", customerId);
  if (role === "reseller") readQuery = readQuery.eq("owner_id", user.id);
  const { data: current, error: readError } = await readQuery.maybeSingle();

  if (readError) {
    logDbError("customers:renew-read", readError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!current) return { ok: false, error: "Cliente não encontrado." };

  const today = getTodayISO();
  const wasCanceled = Boolean(current.canceled_at);
  const isInternal = current.is_internal === true || Number(current.plan_value ?? 0) < 0;
  const grossAmount = isInternal ? 0 : round2(Math.max(0, parseCurrency(grossInput)));
  const creditsUsed = role === "admin" ? creditsInput : months;

  const updatePayload: Record<string, unknown> = {
    expires_at: newExpiresAt,
    canceled_at: null,
  };
  if (shouldUpdatePlanValue && !isInternal) {
    updatePayload.plan_value = grossAmount;
  }

  let updateQuery = supabase
    .from("customers")
    // Renovar um cliente cancelado o traz de volta para a carteira.
    .update(updatePayload)
    .eq("id", customerId)
    // Controle de concorrência otimista: evita renovar 2x se os dois sócios
    // clicarem ao mesmo tempo.
    .eq("expires_at", current.expires_at);
  if (role === "reseller") updateQuery = updateQuery.eq("owner_id", user.id);
  const { data: updated, error } = await updateQuery.select("id");

  if (error) {
    logDbError("customers:renew", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!updated || updated.length === 0) {
    revalidateCustomers();
    return { ok: false, error: "Este cliente acabou de ser alterado por outra pessoa. A lista foi atualizada." };
  }

  const panelId = typeof current.panel_id === "string" ? current.panel_id : null;
  const panel = role === "admin" && panelId ? await fetchPanelOption(supabase, panelId) : null;
  const creditSource =
    role === "admin"
      ? await resolveCreditSourceForAdmin(supabase, {
          panel,
          mode: creditSourceMode,
          batchId: creditBatchIdInput,
          customUnitCost: customCreditCostInput,
          creditsUsed,
        })
      : null;

  const periodLabel = RENEW_PERIOD_META[months].short;
  const screensLabel = `${screens} ${screens === 1 ? "tela" : "telas"}`;
  const creditsLabel = `${creditsUsed} ${creditsUsed === 1 ? "crédito" : "créditos"}`;
  const ledgerNotes = `${periodLabel} · ${screensLabel} · ${creditsLabel}`;

  const ledgerOk = await recordBillingEvent(supabase, {
    role,
    userId: user.id,
    customer: {
      id: String(current.id),
      name: String(current.name),
      plan_value: grossAmount,
      is_reseller: current.is_reseller === true,
      is_internal: isInternal,
      panel_id: panelId,
    },
    panel,
    eventType: "renewal",
    today,
    eventDate: paymentDate,
    grossAmountOverride: grossAmount,
    commissionMultiplier: months,
    creditsUsed,
    creditBatchId: creditSource?.creditBatchId ?? null,
    creditCostOverride: creditSource?.totalCost,
    notes: ledgerNotes,
  });

  revalidateCustomers();
  return {
    ok: true,
    message: `${current.name} ${wasCanceled ? "reativado e renovado" : "renovado"} (${periodLabel}) até ${formatDateBR(newExpiresAt)}${ledgerOk ? "" : `.${LEDGER_WARNING}`}`,
    data: { expires_at: newExpiresAt },
  };
}

/* ---------------------------------------------------------- CANCEL/CHURN --- */

/**
 * Cancela a assinatura (churn) sem apagar o histórico: preenche `canceled_at`
 * com a data de hoje. O cliente pode ser reativado pelo botão "+30 dias".
 */
export async function cancelCustomer(id: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user, role } = auth.ctx;

  const idParsed = customerIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Cliente inválido." };

  const today = getTodayISO();
  let query = supabase
    .from("customers")
    .update({ canceled_at: today })
    .eq("id", idParsed.data)
    .is("canceled_at", null);
  if (role === "reseller") query = query.eq("owner_id", user.id);
  const { data, error } = await query.select("id, name");

  if (error) {
    logDbError("customers:cancel", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) {
    revalidateCustomers();
    return { ok: false, error: "Cliente não encontrado ou já cancelado." };
  }

  revalidateCustomers();
  const name = String((data[0] as Record<string, unknown>).name ?? "Cliente");
  return { ok: true, message: `${name} cancelado em ${formatDateBR(today)}. Use "Renovar" para reativar.` };
}

/* ---------------------------------------------------------------- DELETE --- */

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user, role } = auth.ctx;

  const idParsed = customerIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Cliente inválido." };

  let query = supabase.from("customers").delete().eq("id", idParsed.data);
  if (role === "reseller") query = query.eq("owner_id", user.id);
  const { data, error } = await query.select("id");

  if (error) {
    logDbError("customers:delete", error);
    if (isForeignKeyViolation(error)) {
      return {
        ok: false,
        error: "Este cliente já possui lançamentos financeiros. Use \"Cancelar / Churn\" para preservar o histórico.",
      };
    }
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Cliente não encontrado." };

  revalidateCustomers();
  return { ok: true, message: "Cliente excluído permanentemente." };
}
