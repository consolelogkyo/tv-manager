import { redirect } from "next/navigation";
import { getCustomers } from "@/app/actions/customers";
import { getTvApps } from "@/app/actions/tv-apps";
import { AppHeader } from "@/components/dashboard/app-header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { NotAuthorized } from "@/components/dashboard/not-authorized";
import { formatDateBR, getTodayISO } from "@/lib/date";
import { buildAppSuggestions } from "@/lib/tv-apps";
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

  // As sugestões de apps são um bônus: se o catálogo falhar, o painel de clientes continua funcionando.
  const [customers, tvApps] = await Promise.all([getCustomers(), getTvApps().catch(() => [])]);
  const today = getTodayISO();
  const appSuggestions = buildAppSuggestions(tvApps);

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
        <Dashboard customers={customers} today={today} appSuggestions={appSuggestions} />
      </main>
    </>
  );
}
