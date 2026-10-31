"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { addDaysISO, addMonthsISO, formatDateBR, getDaysRemaining, getTodayISO } from "@/lib/date";
import type { ActionResult, Customer, RenewMode, UserRole } from "@/lib/types";
import {
  customerIdSchema,
  getCustomerFormSchema,
  renewModeSchema,
  toCustomerRow,
  type CustomerFormValues,
} from "@/lib/validations";

const BASE_COLUMNS =
  "id, name, phone, mac_address, app_name, plan_value, expires_at, notes, created_by, created_at, updated_at, owner_id, is_reseller";

/** `payment_date` é exclusivo dos admins: nem é selecionado para o revendedor. */
const COLUMNS_BY_ROLE: Record<UserRole, string> = {
  admin: `${BASE_COLUMNS}, payment_date`,
  reseller: BASE_COLUMNS,
};

const GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente.";
const UNAUTHORIZED = "Sessão expirada. Faça login novamente.";
const FORBIDDEN = "Você não tem permissão para esta ação.";

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
  return {
    ...(row as Customer),
    plan_value: Number(row.plan_value ?? 0),
    is_reseller: row.is_reseller === true,
    owner_id: typeof row.owner_id === "string" ? row.owner_id : null,
    payment_date: role === "admin" && typeof row.payment_date === "string" ? row.payment_date : null,
  };
}

function logDbError(scope: string, error: { code?: string; message?: string }) {
  // Detalhes ficam apenas no log do servidor; o usuário recebe mensagem genérica.
  console.error(`[customers:${scope}]`, { code: error.code, message: error.message });
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
    logDbError("get", error);
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

  const { error } = await supabase.from("customers").insert({
    ...toCustomerRow(parsed.data, role),
    // Definidos no servidor — nunca confiamos no valor vindo do cliente.
    created_by: user.email ?? null,
    owner_id: user.id,
    is_reseller: role === "reseller",
  });

  if (error) {
    logDbError("create", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath("/");
  return { ok: true, message: `Cliente ${parsed.data.name} cadastrado!` };
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

  // `owner_id` e `is_reseller` não fazem parte do UPDATE: a posse do cliente é imutável pelo app.
  let query = supabase.from("customers").update(toCustomerRow(parsed.data, role)).eq("id", idParsed.data);
  if (role === "reseller") query = query.eq("owner_id", user.id);

  const { data, error } = await query.select("id");

  if (error) {
    logDbError("update", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Cliente não encontrado." };

  revalidatePath("/");
  return { ok: true, message: "Alterações salvas!" };
}

/* ----------------------------------------------------------------- RENEW --- */

/**
 * Renovação rápida.
 * - Cliente em dia/vencendo: +1 mês a partir do vencimento atual.
 * - Cliente vencido:
 *     "auto" / "from_today"  → hoje + 30 dias
 *     "from_expiry"          → vencimento original + 1 mês (mantém o ciclo)
 * A data atual é sempre lida do banco (não confiamos na data enviada pelo cliente).
 */
export async function renewCustomer(id: string, mode: RenewMode = "auto"): Promise<ActionResult<{ expires_at: string }>> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, user, role } = auth.ctx;

  const idParsed = customerIdSchema.safeParse(id);
  const modeParsed = renewModeSchema.safeParse(mode);
  if (!idParsed.success || !modeParsed.success) return { ok: false, error: "Requisição inválida." };

  let readQuery = supabase.from("customers").select("id, name, expires_at").eq("id", idParsed.data);
  if (role === "reseller") readQuery = readQuery.eq("owner_id", user.id);
  const { data: current, error: readError } = await readQuery.maybeSingle();

  if (readError) {
    logDbError("renew-read", readError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!current) return { ok: false, error: "Cliente não encontrado." };

  const today = getTodayISO();
  const isExpired = getDaysRemaining(current.expires_at, today) < 0;

  let newExpiresAt: string;
  if (isExpired && modeParsed.data !== "from_expiry") {
    newExpiresAt = addDaysISO(today, 30);
  } else {
    newExpiresAt = addMonthsISO(current.expires_at, 1);
  }

  let updateQuery = supabase
    .from("customers")
    .update({ expires_at: newExpiresAt })
    .eq("id", idParsed.data)
    // Controle de concorrência otimista: evita renovar 2x se os dois sócios
    // clicarem ao mesmo tempo.
    .eq("expires_at", current.expires_at);
  if (role === "reseller") updateQuery = updateQuery.eq("owner_id", user.id);
  const { data: updated, error } = await updateQuery.select("id");

  if (error) {
    logDbError("renew", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!updated || updated.length === 0) {
    revalidatePath("/");
    return { ok: false, error: "Este cliente acabou de ser alterado por outra pessoa. A lista foi atualizada." };
  }

  revalidatePath("/");
  return {
    ok: true,
    message: `${current.name} renovado até ${formatDateBR(newExpiresAt)}`,
    data: { expires_at: newExpiresAt },
  };
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
    logDbError("delete", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Cliente não encontrado." };

  revalidatePath("/");
  return { ok: true, message: "Cliente excluído." };
}
