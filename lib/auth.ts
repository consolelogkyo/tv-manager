import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
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

/**
 * Guarda das áreas financeiras (página `/finance` e Server Actions de painéis,
 * despesas e Livro-Razão). Fail-closed:
 * - sem sessão → `/login`;
 * - qualquer cargo diferente de `admin` (inclusive revendedor) → `/`.
 */
export async function requireAdminOrRedirect() {
  const ctx = await getAuthContext();
  if (!ctx.user) redirect("/login");
  if (ctx.role !== "admin") redirect("/");
  return { supabase: ctx.supabase, user: ctx.user };
}

type QueryPage = PromiseLike<{ data: unknown[] | null; error: { code?: string; message?: string } | null }>;

/**
 * Lê todas as linhas de uma consulta em páginas (o PostgREST limita cada
 * resposta, por padrão a 1000 linhas). `maxPages` evita laços infinitos.
 */
export async function fetchAllRows(
  build: (from: number, to: number) => QueryPage,
  { pageSize = 1000, maxPages = 50 }: { pageSize?: number; maxPages?: number } = {},
): Promise<{ data: Record<string, unknown>[]; error: { code?: string; message?: string } | null }> {
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return { data: rows, error: null };
}

