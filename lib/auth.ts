import "server-only";

import { cache } from "react";
import { isUserRole, type UserRole } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Lê o cargo (`admin` | `reseller`) do usuário na tabela `public.admins`.
 * Depende da policy que permite ao usuário autenticado ler apenas a própria linha.
 * Fail-closed: erro, ausência de linha ou valor desconhecido → `null` (sem acesso).
 */
async function fetchRole(supabase: SupabaseServerClient, userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase.from("admins").select("role").eq("user_id", userId).maybeSingle();

  if (error) {
    // Sem dados sensíveis no log (nem e-mail, nem token).
    console.error("[auth:role]", { code: error.code, message: error.message });
    return null;
  }
  const role: unknown = data?.role;
  return isUserRole(role) ? role : null;
}

/**
 * Contexto de autenticação do request atual: cliente Supabase (sessão do
 * usuário, RLS ativo), usuário validado no servidor (`getUser`, não `getSession`)
 * e cargo. Memoizado por request com `cache` para evitar consultas repetidas
 * entre a página e as Server Actions de leitura chamadas por ela.
 */
export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null, role: null } as const;

  const role = await fetchRole(supabase, data.user.id);
  return { supabase, user: data.user, role } as const;
});

/** Cargo do usuário autenticado, ou `null` se não autenticado / fora da allow-list. */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const { role } = await getAuthContext();
  return role;
}

