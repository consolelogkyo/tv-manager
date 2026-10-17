import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabaseUrl.replace(/^http/, "ws");

  const directives = [
    `default-src 'self'`,
    // Nonce por requisição + strict-dynamic: só scripts emitidos pelo Next rodam.
    // 'unsafe-eval' apenas em dev (exigido pelo React Refresh).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // TODO(security): 'unsafe-inline' em estilos é necessário porque Radix UI e
    // Sonner aplicam estilos inline em tempo de execução. Não permite execução
    // de scripts; reavaliar se essas libs passarem a suportar nonce.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${supabaseUrl} ${supabaseWs}${isDev ? " ws:" : ""}`.trim(),
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Repassa nonce + CSP no request para o Next.js aplicar o nonce nos scripts.
  const response = await updateSession(request, {
    "x-nonce": nonce,
    "Content-Security-Policy": csp,
  });

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Todas as rotas, exceto assets estáticos e otimização de imagens.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
