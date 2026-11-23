import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesso restrito ao painel de gestão de assinaturas de TV.",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-enter">
        <div className="mb-8">
          <Logo tagline className="mb-8" />
          <h1 className="text-2xl font-medium">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Assinaturas, vencimentos e financeiro da operação</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-xs text-subtle-foreground">
          Não há cadastro público. Usuários são criados pelo painel do Supabase.
        </p>
      </div>
    </main>
  );
}
