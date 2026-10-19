"use server";

import { revalidatePath } from "next/cache";
import { toPriority } from "@/lib/tv-apps";
import type { ActionResult, PriorityDirection, TvApp, TvAppPriority } from "@/lib/types";
import {
  favoriteValueSchema,
  priorityDirectionSchema,
  toTvAppRow,
  tvAppFormSchema,
  tvAppIdSchema,
  type TvAppFormValues,
} from "@/lib/validations";
import { createClient } from "@/utils/supabase/server";

const TV_APP_COLUMNS =
  "id, tv_brand, app_name, priority, is_favorite, license_info, activation_url, notes, created_at, updated_at";

const GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente.";
const UNAUTHORIZED = "Sessão expirada. Faça login novamente.";
const NOT_FOUND = "App não encontrado.";

/**
 * Toda Server Action é um endpoint público (POST): autentica no servidor
 * antes de qualquer acesso aos dados. O RLS (is_admin) no banco é a 2ª barreira.
 * TODO(security): sem rate limit dedicado — mesmo padrão das actions de clientes
 * (acesso restrito a 2 admins autenticados + limites do próprio Supabase).
 */
async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null } as const;
  return { supabase, user: data.user } as const;
}

function normalizeTvApp(row: Record<string, unknown>): TvApp {
  return {
    ...(row as TvApp),
    priority: toPriority(row.priority),
    is_favorite: Boolean(row.is_favorite),
  };
}

function logDbError(scope: string, error: { code?: string; message?: string }) {
  // Detalhes ficam apenas no log do servidor; o usuário recebe mensagem genérica.
  console.error(`[tv-apps:${scope}]`, { code: error.code, message: error.message });
}

function revalidateCatalog() {
  revalidatePath("/apps");
  // O formulário de clientes usa os apps como sugestão.
  revalidatePath("/");
}

function invalidForm(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): ActionResult {
  return { ok: false, error: "Verifique os campos destacados.", fieldErrors: error.flatten().fieldErrors };
}

/* ------------------------------------------------------------------ READ --- */

export async function getTvApps(): Promise<TvApp[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("tv_apps")
    .select(TV_APP_COLUMNS)
    .order("tv_brand", { ascending: true })
    .order("is_favorite", { ascending: false })
    .order("priority", { ascending: true })
    .order("app_name", { ascending: true });

  if (error) {
    logDbError("get", error);
    throw new Error("Falha ao carregar o catálogo de apps.");
  }

  return (data ?? []).map((row) => normalizeTvApp(row as Record<string, unknown>));
}

/* ---------------------------------------------------------------- CREATE --- */

export async function createTvApp(values: TvAppFormValues): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const parsed = tvAppFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);

  const { error } = await supabase.from("tv_apps").insert(toTvAppRow(parsed.data));
  if (error) {
    logDbError("create", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidateCatalog();
  return { ok: true, message: `${parsed.data.app_name} adicionado em ${parsed.data.tv_brand}!` };
}

/* ---------------------------------------------------------------- UPDATE --- */

export async function updateTvApp(id: string, values: TvAppFormValues): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const idParsed = tvAppIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "App inválido." };

  const parsed = tvAppFormSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error);

  const { data, error } = await supabase
    .from("tv_apps")
    .update(toTvAppRow(parsed.data))
    .eq("id", idParsed.data)
    .select("id");

  if (error) {
    logDbError("update", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };

  revalidateCatalog();
  return { ok: true, message: "Alterações salvas!" };
}

/* -------------------------------------------------------------- FAVORITE --- */

/** Recebe o valor desejado (idempotente) em vez de inverter às cegas. */
export async function toggleFavoriteTvApp(id: string, isFavorite: boolean): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const idParsed = tvAppIdSchema.safeParse(id);
  const favParsed = favoriteValueSchema.safeParse(isFavorite);
  if (!idParsed.success || !favParsed.success) return { ok: false, error: "Requisição inválida." };

  const { data, error } = await supabase
    .from("tv_apps")
    .update({ is_favorite: favParsed.data })
    .eq("id", idParsed.data)
    .select("app_name");

  if (error) {
    logDbError("favorite", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };

  revalidateCatalog();
  return {
    ok: true,
    message: favParsed.data ? `${data[0].app_name} marcado como favorito ⭐` : `${data[0].app_name} removido dos favoritos`,
  };
}

/* -------------------------------------------------------------- PRIORITY --- */

/** "up" = sobe na fila (prioridade 3 → 2 → 1) · "down" = desce (1 → 2 → 3). */
export async function changePriorityTvApp(
  id: string,
  direction: PriorityDirection,
): Promise<ActionResult<{ priority: TvAppPriority }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const idParsed = tvAppIdSchema.safeParse(id);
  const dirParsed = priorityDirectionSchema.safeParse(direction);
  if (!idParsed.success || !dirParsed.success) return { ok: false, error: "Requisição inválida." };

  const { data: current, error: readError } = await supabase
    .from("tv_apps")
    .select("id, app_name, priority")
    .eq("id", idParsed.data)
    .maybeSingle();

  if (readError) {
    logDbError("priority-read", readError);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!current) return { ok: false, error: NOT_FOUND };

  const currentPriority = toPriority(current.priority);
  const next = toPriority(dirParsed.data === "up" ? currentPriority - 1 : currentPriority + 1);
  const outOfRange = dirParsed.data === "up" ? currentPriority === 1 : currentPriority === 3;
  if (outOfRange) {
    return {
      ok: false,
      error: dirParsed.data === "up" ? "Este app já é a 1ª opção." : "Este app já está no fim da fila.",
    };
  }

  const { data: updated, error } = await supabase
    .from("tv_apps")
    .update({ priority: next })
    .eq("id", idParsed.data)
    // Concorrência otimista: evita pular 2 níveis se os dois sócios clicarem juntos.
    .eq("priority", current.priority)
    .select("id");

  if (error) {
    logDbError("priority", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!updated || updated.length === 0) {
    revalidateCatalog();
    return { ok: false, error: "Este app acabou de ser alterado por outra pessoa. A lista foi atualizada." };
  }

  revalidateCatalog();
  const label = next === 1 ? "1ª opção" : next === 2 ? "2ª opção (reserva)" : "fim da fila";
  return { ok: true, message: `${current.app_name} agora é ${label}`, data: { priority: next } };
}

/* ---------------------------------------------------------------- DELETE --- */

export async function deleteTvApp(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: UNAUTHORIZED };

  const idParsed = tvAppIdSchema.safeParse(id);
  if (!idParsed.success) return { ok: false, error: "App inválido." };

  const { data, error } = await supabase.from("tv_apps").delete().eq("id", idParsed.data).select("id");

  if (error) {
    logDbError("delete", error);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data || data.length === 0) return { ok: false, error: NOT_FOUND };

  revalidateCatalog();
  return { ok: true, message: "App removido do catálogo." };
}
