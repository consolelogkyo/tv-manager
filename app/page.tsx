import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { getCustomers } from "@/app/actions/customers";
import { AppHeader } from "@/components/dashboard/app-header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Button } from "@/components/ui/button";
import { formatDateBR, getTodayISO } from "@/lib/date";
import { createClient } from "@/utils/supabase/server";

export default async function HomePage() {
  // Defesa em profundidade: o middleware já protege a rota, mas validamos de novo.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Usuário autenticado, mas fora da allow-list "admins" → RLS bloqueia tudo.
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) {
    return <NotAuthorized email={user.email ?? ""} />;
  }

  const [customers, today] = [await getCustomers(), getTodayISO()];

  return (
    <>
      <AppHeader email={user.email ?? "admin"} />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 sm:pb-12 lg:px-8">
        <div className="mb-6 animate-fade-up">
          <p className="text-sm text-muted-foreground">Hoje é {formatDateBR(today)}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-gradient">Painel de assinaturas</span>
          </h1>
        </div>
        <Dashboard customers={customers} today={today} />
      </main>
    </>
  );
}

function NotAuthorized({ email }: { email: string }) {
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
