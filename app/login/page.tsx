import type { Metadata } from "next";
import { Tv } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesso restrito ao painel de gestão de assinaturas de TV.",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl animate-float"
      />

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent-violet shadow-xl shadow-primary/30 ring-1 ring-white/20">
            <Tv className="size-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-gradient">TV Manager</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acesso restrito aos administradores</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/80">
          Não há cadastro público. Usuários são criados pelo painel do Supabase.
        </p>
      </div>
    </main>
  );
}
