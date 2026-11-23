"use server";

import { revalidatePath } from "next/cache";
import {
  CREDIT_BATCH_COLUMNS,
  GENERIC_ERROR,
  PANEL_COLUMNS,
  invalidForm,
  isForeignKeyViolation,
  isUniqueViolation,
  logDbError,
  normalizeCreditBatch,
  normalizePanel,
} from "@/lib/action-utils";
import { requireAdminOrRedirect } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import {
  creditBatchFormSchema,
  panelActiveSchema,
  panelFormSchema,
  toCreditBatchRow,
  toPanelRow,
  uuidSchema,
  type CreditBatchFormValues,
  type PanelFormValues,
} from "@/lib/finance-validations";
import type { ActionResult, Panel, PanelCreditBatch } from "@/lib/types";

/**
 * Painéis/servidores e custo do crédito — exclusivo dos admins.
 * Toda action valida a sessão e o cargo no servidor (revendedor → `/`);
 * o RLS de `public.panels` (somente admin) é a segunda barreira.
 */

const DUPLICATE_NAME = "Já existe um painel com esse nome.";

function revalidatePanels() {
  revalidatePath("/finance");
  // O dashboard de clientes usa os painéis (badge, select e custo de créditos).
  revalidatePath("/");
}

/* ------------------------------------------------------------------ READ --- */

export async function getPanels(): Promise<Panel[]> {
  const { supabase } = await requireAdminOrRedirect();
  const { data, error } = await supabase
    .from("panels")
    .select(PANEL_COLUMNS)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    logDbError("panels:get", error);
    throw new Error("Falha ao carregar painéis.");
  }
  return ((data ?? []) as Record<string, unknown>[]).map(normalizePanel);
}

/* ---------------------------------------------------------------- CREATE --- */

export async function createPanel(values: PanelFormValues): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const parsed = panelFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);
  const row = toPanelRow(parsed.data);

  const { error } = await supabase.from("panels").insert(row);
  if (error) {
    logDbError("panels:create", error);
    if (isUniqueViolation(error)) return { ok: false, error: DUPLICATE_NAME, fieldErrors: { name: [DUPLICATE_NAME] } };
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePanels();
  return { ok: true, message: `Painel ${row.name} criado (${formatCurrency(row.credit_cost)}/crédito).` };
}

/* ---------------------------------------------------------------- UPDATE --- */

export async function updatePanel(id: string, values: PanelFormValues): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Painel inválido." };
  const parsed = panelFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);

  const { data, error } = await supabase
    .from("panels")
    .update(toPanelRow(parsed.data))
    .eq("id", idParsed.data)
    .select("id");

  if (error) {
    logDbError("panels:update", error);
    if (isUniqueViolation(error)) return { ok: false, error: DUPLICATE_NAME, fieldErrors: { name: [DUPLICATE_NAME] } };
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Painel não encontrado." };

  revalidatePanels();
  return { ok: true, message: "Painel atualizado. O novo custo vale para os próximos lançamentos." };
}

export async function setPanelActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  const activeParsed = panelActiveSchema.safeParse(active);
  if (!idParsed.success || !activeParsed.success) return { ok: false, error: "Requisição inválida." };

  const { data, error } = await supabase
    .from("panels")
    .update({ is_active: activeParsed.data })
    .eq("id", idParsed.data)
    .select("id, name");

  if (error) {
    logDbError("panels:active", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Painel não encontrado." };

  revalidatePanels();
  const name = String((data[0] as Record<string, unknown>).name ?? "Painel");
  return { ok: true, message: activeParsed.data ? `${name} reativado.` : `${name} desativado.` };
}

/* ---------------------------------------------------------------- DELETE --- */

export async function deletePanel(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Painel inválido." };

  const { data, error } = await supabase.from("panels").delete().eq("id", idParsed.data).select("id");
  if (error) {
    logDbError("panels:delete", error);
    if (isForeignKeyViolation(error)) {
      return {
        ok: false,
        error: "Este painel tem clientes, lançamentos ou despesas vinculados. Desative-o em vez de excluir.",
      };
    }
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Painel não encontrado." };

  revalidatePanels();
  return { ok: true, message: "Painel excluído." };
}

/* ----------------------------------------------------- Lotes de Crédito --- */

/**
 * Lista todos os lotes de créditos ordenados por data de compra (FIFO: o mais
 * antigo aparece primeiro).
 */
export async function getPanelCreditBatches(): Promise<PanelCreditBatch[]> {
  const { supabase } = await requireAdminOrRedirect();
  const { data, error } = await supabase
    .from("panel_credit_batches")
    .select(CREDIT_BATCH_COLUMNS)
    .order("purchased_at", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    logDbError("batches:get", error);
    throw new Error("Falha ao carregar lotes de créditos.");
  }
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeCreditBatch);
}

export async function createCreditBatch(values: CreditBatchFormValues): Promise<ActionResult> {
  const { supabase, user } = await requireAdminOrRedirect();

  const parsed = creditBatchFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);
  const row = toCreditBatchRow(parsed.data);

  const { error } = await supabase.from("panel_credit_batches").insert({
    ...row,
    created_by: user.id,
  });

  if (error) {
    logDbError("batches:create", error);
    if (isForeignKeyViolation(error)) {
      return { ok: false, error: "Painel não encontrado.", fieldErrors: { panel_id: ["Painel não encontrado"] } };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePanels();
  return {
    ok: true,
    message: `Lote "${row.label}" registrado (${row.quantity_total} cr × ${formatCurrency(row.unit_cost)}/cr).`,
  };
}

export async function updateCreditBatch(id: string, values: CreditBatchFormValues): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Lote inválido." };
  const parsed = creditBatchFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);

  const { data, error } = await supabase
    .from("panel_credit_batches")
    .update(toCreditBatchRow(parsed.data))
    .eq("id", idParsed.data)
    .select("id");

  if (error) {
    logDbError("batches:update", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Lote não encontrado." };

  revalidatePanels();
  return { ok: true, message: "Lote atualizado" };
}

export async function archiveCreditBatch(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  const activeParsed = panelActiveSchema.safeParse(active);
  if (!idParsed.success || !activeParsed.success) return { ok: false, error: "Requisição inválida." };

  const { data, error } = await supabase
    .from("panel_credit_batches")
    .update({ is_active: activeParsed.data })
    .eq("id", idParsed.data)
    .select("id, label");

  if (error) {
    logDbError("batches:archive", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Lote não encontrado." };

  revalidatePanels();
  const label = String((data[0] as Record<string, unknown>).label ?? "Lote");
  return { ok: true, message: activeParsed.data ? `Lote "${label}" reativado.` : `Lote "${label}" arquivado.` };
}

export async function deleteCreditBatch(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Lote inválido." };

  const { data, error } = await supabase.from("panel_credit_batches").delete().eq("id", idParsed.data).select("id");
  if (error) {
    logDbError("batches:delete", error);
    if (isForeignKeyViolation(error)) {
      return {
        ok: false,
        error: "Este lote já foi usado em lançamentos ou despesas. Arquive-o em vez de excluir.",
      };
    }
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Lote não encontrado." };

  revalidatePanels();
  return { ok: true, message: "Lote excluído." };
}
