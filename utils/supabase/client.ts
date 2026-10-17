import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/utils/supabase/config";

/**
 * Cliente Supabase para Client Components.
 *
 * Importante: os cookies de sessão deste projeto são HttpOnly (ver
 * `sessionCookieOptions`), portanto este cliente NÃO enxerga a sessão do
 * usuário e opera como anônimo. Todas as leituras/escritas de clientes são
 * feitas via Server Actions (padrão BFF) — este cliente existe apenas para
 * recursos públicos futuros e nunca deve receber chaves privilegiadas.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
