"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { DEFAULT_CREDIT_UNIT_COST, MAX_CREDIT_UNIT_COST, MIN_CREDIT_UNIT_COST } from "@/lib/business";
import { formatCurrency } from "@/lib/format";
import type { ActionResult } from "@/lib/types";
import { creditUnitCostSchema } from "@/lib/validations";

/** `public.app_settings` tem uma única linha de configuração. */
const SETTINGS_ROW_ID = 1;

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente.";

function logDbError(scope: string, error: { code?: string; message?: string }) {
  // Detalhes apenas no log do servidor; o usuário recebe mensagem genérica.
  console.error(`[settings:${scope}]`, { code: error.code, message: error.message });
}

/**
 * Configurações financeiras são exclusivas dos admins principais.
 * O cargo é lido do banco a cada chamada — nunca vem do cliente.
 */
async function requireAdmin() {
  const ctx = await getAuthContext();
  if (!ctx.user) return { ok: false, error: "Sessão expirada. Faça login novamente." } as const;
  if (ctx.role !== "admin") return { ok: false, error: "Você não tem permissão para esta ação." } as const;
  return { ok: true, supabase: ctx.supabase } as const;
}

function toValidCost(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= MIN_CREDIT_UNIT_COST && n <= MAX_CREDIT_UNIT_COST ? n : null;
}

/* ------------------------------------------------------------------ READ --- */

/** Custo unitário do crédito (R$). Fallback: R$ 5,00 se a linha não existir ou a leitura falhar. */
export async function getCreditUnitCost(): Promise<number> {
  const auth = await requireAdmin();
  if (!auth.ok) return DEFAULT_CREDIT_UNIT_COST;

  const { data, error } = await auth.supabase
    .from("app_settings")
    .select("credit_unit_cost")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    logDbError("get", error);
    return DEFAULT_CREDIT_UNIT_COST;
  }
  return toValidCost(data?.credit_unit_cost) ?? DEFAULT_CREDIT_UNIT_COST;
}

/* ---------------------------------------------------------------- UPDATE --- */

export async function updateCreditUnitCost(value: number): Promise<ActionResult<{ credit_unit_cost: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = creditUnitCostSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Valor inválido." };
  }
  const cost = parsed.data;
  const row = { credit_unit_cost: cost, updated_at: new Date().toISOString() };

  const { data, error } = await auth.supabase
    .from("app_settings")
    .update(row)
    .eq("id", SETTINGS_ROW_ID)
    .select("id");

  if (error) {
    logDbError("update", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  // Linha ainda não criada: tenta inserir (depende de policy de INSERT para admins).
  if (!data || data.length === 0) {
    const { error: insertError } = await auth.supabase.from("app_settings").insert({ id: SETTINGS_ROW_ID, ...row });
    if (insertError) {
      logDbError("insert", insertError);
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  revalidatePath("/");
  return {
    ok: true,
    message: `Custo do crédito atualizado para ${formatCurrency(cost)}`,
    data: { credit_unit_cost: cost },
  };
}

