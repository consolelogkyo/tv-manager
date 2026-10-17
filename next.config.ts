import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Cabeçalhos de segurança globais. A Content-Security-Policy (com nonce por
 * requisição) é definida no middleware.ts.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Páginas com dados sensíveis não devem ficar em cache (botão "voltar" após logout).
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Payload dos formulários é pequeno; limite baixo reduz superfície de DoS.
      bodySizeLimit: "100kb",
    },
  },
};

export default nextConfig;
