"use client";

import { useEffect } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Apenas o identificador — sem dados sensíveis.
    console.error("[app] erro de renderização", { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/70 p-8 text-center shadow-2xl backdrop-blur-xl animate-fade-up">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-destructive/15 ring-1 ring-destructive/30">
          <AlertOctagon className="size-7 text-destructive" />
        </div>
        <h1 className="font-display text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não foi possível carregar os dados agora. Verifique sua conexão e tente novamente. Se persistir, confirme se
          seu usuário está na tabela <code className="rounded bg-muted px-1">admins</code> do Supabase.
        </p>
        <Button id="error-retry" className="mt-6" onClick={reset}>
          <RefreshCw /> Tentar novamente
        </Button>
      </div>
    </main>
  );
}
