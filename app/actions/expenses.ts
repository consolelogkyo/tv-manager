"use server";

import { revalidatePath } from "next/cache";
import { GENERIC_ERROR, invalidForm, isForeignKeyViolation, logDbError } from "@/lib/action-utils";
import { requireAdminOrRedirect } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { expenseFormSchema, toExpenseRow, uuidSchema, type ExpenseFormValues } from "@/lib/finance-validations";
import type { ActionResult } from "@/lib/types";

/**
 * Despesas extras / custos invisíveis — exclusivo dos admins.
 * Sessão e cargo validados no servidor (revendedor → `/`); RLS de
 * `public.expenses` (somente admin) é a segunda barreira. A leitura acontece
 * em `getFinanceData` (app/actions/finance.ts).
 */

const INVALID_LINK = "Cliente ou painel vinculado não existe mais.";

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/");
}

export async function createExpense(values: ExpenseFormValues): Promise<ActionResult> {
  const { supabase, user } = await requireAdminOrRedirect();

  const parsed = expenseFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);
  const row = toExpenseRow(parsed.data);

  // `created_by` é definido no servidor, nunca vem do formulário.
  const { error } = await supabase.from("expenses").insert({ ...row, created_by: user.id });
  if (error) {
    logDbError("expenses:create", error);
    return { ok: false, error: isForeignKeyViolation(error) ? INVALID_LINK : GENERIC_ERROR };
  }

  revalidateFinance();
  return { ok: true, message: `Despesa de ${formatCurrency(row.amount)} lançada.` };
}

export async function updateExpense(id: string, values: ExpenseFormValues): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Despesa inválida." };
  const parsed = expenseFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);

  const { data, error } = await supabase
    .from("expenses")
    .update(toExpenseRow(parsed.data))
    .eq("id", idParsed.data)
    .select("id");

  if (error) {
    logDbError("expenses:update", error);
    return { ok: false, error: isForeignKeyViolation(error) ? INVALID_LINK : GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Despesa não encontrada." };

  revalidateFinance();
  return { ok: true, message: "Despesa atualizada" };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdminOrRedirect();

  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Despesa inválida." };

  const { data, error } = await supabase.from("expenses").delete().eq("id", idParsed.data).select("id");
  if (error) {
    logDbError("expenses:delete", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: "Despesa não encontrada." };

  revalidateFinance();
  return { ok: true, message: "Despesa excluída." };
}
