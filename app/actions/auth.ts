"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { signInSchema } from "@/lib/validations";
import { createClient } from "@/utils/supabase/server";

export type SignInState = { error?: string; email?: string } | undefined;

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";

/**
 * Login com e-mail e senha.
 * - CSRF: Server Actions do Next.js só aceitam POST e validam o header Origin
 *   contra o Host (proteção nativa, não desabilitada).
 * - Credenciais nunca são logadas nem enviadas por URL.
 */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  const rawEmail = typeof formData.get("email") === "string" ? String(formData.get("email")).slice(0, 254) : "";

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_LOGIN_ERROR, email: rawEmail };
  }

  const { email, password } = parsed.data;

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const limiterKey = `login:${ip}:${email}`;
  const limit = rateLimit(limiterKey, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return { error: `Muitas tentativas. Tente novamente em ${minutes} min.`, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Log sem dados sensíveis (sem e-mail/senha).
    console.warn("[auth] falha de login", { status: error.status, code: error.code });
    return { error: GENERIC_LOGIN_ERROR, email };
  }

  resetRateLimit(limiterKey);
  // TODO(security): considere habilitar MFA (TOTP) no Supabase Auth para os admins.
  // TODO(security): ative "Leaked password protection" no Supabase Auth (plano Pro).
  redirect("/");
}

/** Encerra a sessão (escopo global: invalida as sessões do usuário em todos os dispositivos). */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
