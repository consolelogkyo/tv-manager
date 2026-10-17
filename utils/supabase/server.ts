import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv, sessionCookieOptions } from "@/utils/supabase/config";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a sessão do usuário (cookies) — as policies RLS valem normalmente.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...sessionCookieOptions }),
          );
        } catch {
          // Chamado a partir de um Server Component (cookies somente leitura).
          // Seguro ignorar: o middleware é responsável por renovar a sessão.
        }
      },
    },
  });
}
