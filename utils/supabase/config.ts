import type { CookieOptions } from "@supabase/ssr";

/**
 * Lê as variáveis públicas do Supabase. Falha de forma explícita (fail-closed)
 * se não estiverem configuradas — nunca usamos valores padrão/fallback.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas. Veja .env.example.",
    );
  }
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL deve usar HTTPS em produção.");
  }

  return { url, anonKey };
}

/**
 * Cookies de sessão endurecidos. Toda a autenticação acontece no servidor
 * (Server Actions + middleware), então os cookies podem ser HttpOnly e o
 * token nunca fica acessível ao JavaScript do navegador.
 *
 * TODO(security): em produção (HTTPS) considere usar o prefixo `__Host-` no
 * nome do cookie (`name: "__Host-sb-auth"`). Não é aplicado por padrão porque
 * exige `Secure`, o que quebra o login em http://localhost durante o dev em
 * alguns navegadores (ex.: Safari).
 */
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
