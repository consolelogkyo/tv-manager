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
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 animate-enter">
        <AlertOctagon className="mb-4 size-6 text-destructive" strokeWidth={1.75} aria-hidden="true" />
        <h1 className="text-lg font-medium">Algo deu errado</h1>
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
