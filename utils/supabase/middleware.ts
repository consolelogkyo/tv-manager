import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, sessionCookieOptions } from "@/utils/supabase/config";

const PUBLIC_ROUTES = ["/login"];

/**
 * Renova a sessão do Supabase a cada requisição e aplica a proteção de rotas.
 * `extraRequestHeaders` permite repassar o nonce da CSP para o Next.js.
 */
export async function updateSession(
  request: NextRequest,
  extraRequestHeaders: Record<string, string> = {},
) {
  const buildNext = () => {
    const headers = new Headers(request.headers);
    for (const [key, value] of Object.entries(extraRequestHeaders)) headers.set(key, value);
    return NextResponse.next({ request: { headers } });
  };

  let response = buildNext();
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = buildNext();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, { ...options, ...sessionCookieOptions }),
        );
      },
    },
  });

  // Não coloque código entre createServerClient e getUser(): getUser valida o
  // JWT junto ao servidor de Auth (não confia apenas no cookie).
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Fail-closed: qualquer erro de validação é tratado como "não logado".
    user = null;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const redirectTo = (path: string) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    const redirect = NextResponse.redirect(target);
    // Preserva cookies de sessão eventualmente renovados/limpos.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && !isPublic) return redirectTo("/login");
  if (user && pathname === "/login") return redirectTo("/");

  return response;
}
