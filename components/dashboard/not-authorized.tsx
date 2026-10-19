import { ShieldAlert } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function NotAuthorized({ email }: { email: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/70 p-8 text-center shadow-2xl backdrop-blur-xl animate-fade-up">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-warning/15 ring-1 ring-warning/30">
          <ShieldAlert className="size-7 text-warning" />
        </div>
        <h1 className="font-display text-xl font-semibold">Acesso não autorizado</h1>
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
