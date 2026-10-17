"use server";

import { revalidatePath } from "next/cache";
import { addDaysISO, addMonthsISO, formatDateBR, getDaysRemaining, getTodayISO } from "@/lib/date";
import type { ActionResult, Customer, RenewMode } from "@/lib/types";
import {
  customerFormSchema,
  customerIdSchema,
  renewModeSchema,
  toCustomerRow,
  type CustomerFormValues,
} from "@/lib/validations";
import { createClient } from "@/utils/supabase/server";

const CUSTOMER_COLUMNS =
  "id, name, phone, mac_address, app_name, plan_value, expires_at, notes, created_by, created_at, updated_at";

const GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente.";
const UNAUTHORIZED = "Sessão expirada. Faça login novamente.";

/**
 * Toda Server Action é um endpoint público (POST): autentica no servidor
 * antes de qualquer acesso aos dados. O RLS no banco é a segunda barreira.
 */
async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null } as const;
  return { supabase, user: data.user } as const;
}

function normalizeCustomer(row: Record<string, unknown>): Customer {
  return { ...(row as Customer), plan_value: Number(row.plan_value ?? 0) };
}

function logDbError(scope: string, error: { code?: string; message?: string }) {
  // Detalhes ficam apenas no log do servidor; o usuário recebe mensagem genérica.
  console.error(`[customers:${scope}]`, { code: error.code, message: error.message });
}

/* ------------------------------------------------------------------ READ --- */

export async function getCustomers(): Promise<Customer[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .order("expires_at", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logDbError("get", error);
    throw new Error("Falha ao carregar clientes.");
  }

  return (data ?? []).map((row) => normalizeCustomer(row as Record<string, unknown>));
}

/* ---------------------------------------------------------------- CREATE --- */

export async function createCustomer(values: CustomerFormValues): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const parsed = customerFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase.from("customers").insert({
    ...toCustomerRow(parsed.data),
    // Definido no servidor — nunca confiamos no valor vindo do cliente.
    created_by: user.email ?? null,
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
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const idParsed = customerIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Cliente inválido." };

  const parsed = customerFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { data, error } = await supabase
    .from("customers")
    .update(toCustomerRow(parsed.data))
    .eq("id", idParsed.data)
    .select("id");

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
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const idParsed = customerIdSchema.safeParse(id);
  const modeParsed = renewModeSchema.safeParse(mode);
  if (!idParsed.success || !modeParsed.success) return { ok: false, error: "Requisição inválida." };

  const { data: current, error: readError } = await supabase
    .from("customers")
    .select("id, name, expires_at")
    .eq("id", idParsed.data)
    .maybeSingle();

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

  const { data: updated, error } = await supabase
    .from("customers")
    .update({ expires_at: newExpiresAt })
    .eq("id", idParsed.data)
    // Controle de concorrência otimista: evita renovar 2x se os dois sócios
    // clicarem ao mesmo tempo.
    .eq("expires_at", current.expires_at)
    .select("id");

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
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const idParsed = customerIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Cliente inválido." };

  const { data, error } = await supabase.from("customers").delete().eq("id", idParsed.data).select("id");

  if (error) {
    logDbError("delete", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Cliente não encontrado." };

  revalidatePath("/");
  return { ok: true, message: "Cliente excluído." };
}
