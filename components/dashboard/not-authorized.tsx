import { ShieldAlert } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function NotAuthorized({ email }: { email: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 animate-enter">
        <ShieldAlert className="mb-4 size-6 text-warning" strokeWidth={1.75} aria-hidden="true" />
        <h1 className="text-lg font-medium">Acesso não autorizado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A conta <strong className="text-foreground">{email}</strong> não está liberada como administradora. Adicione o
          usuário na tabela <code className="rounded bg-muted px-1">admins</code> pelo SQL Editor do Supabase.
        </p>
        <form action={signOut} className="mt-6">
          <Button id="unauthorized-sign-out" type="submit" variant="outline">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
