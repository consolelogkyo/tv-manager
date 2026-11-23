import { redirect } from "next/navigation";
import { getCustomers } from "@/app/actions/customers";
import { getPanelCreditBatches, getPanels } from "@/app/actions/panels";
import { getTvApps } from "@/app/actions/tv-apps";
import { AppHeader } from "@/components/dashboard/app-header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { NotAuthorized } from "@/components/dashboard/not-authorized";
import { getAuthContext } from "@/lib/auth";
import { formatDateBR, getTodayISO } from "@/lib/date";
import { buildAppSuggestions } from "@/lib/tv-apps";

export default async function HomePage() {
  // Defesa em profundidade: o middleware já protege a rota, mas validamos de novo.
  const { user, role: userRole } = await getAuthContext();
  if (!user) redirect("/login");

  // Usuário autenticado, mas sem cargo válido em "admins" → RLS bloqueia tudo.
  if (!userRole) {
    return <NotAuthorized email={user.email ?? ""} />;
  }

  // As sugestões de apps são um bônus: se o catálogo falhar, o painel de clientes continua funcionando.
  // Painéis/lotes de crédito são exclusivos dos admins (nem são consultados para o revendedor).
  const [customers, tvApps, panels, batches] = await Promise.all([
    getCustomers(),
    getTvApps().catch(() => []),
    userRole === "admin" ? getPanels().catch(() => []) : Promise.resolve([]),
    userRole === "admin" ? getPanelCreditBatches().catch(() => []) : Promise.resolve([]),
  ]);
  const today = getTodayISO();
  const appSuggestions = buildAppSuggestions(tvApps);

  return (
    <>
      <AppHeader email={user.email ?? "admin"} role={userRole} />
      <main className="mx-auto max-w-7xl animate-enter px-4 pt-6 pb-28 sm:px-6 sm:pt-8 sm:pb-12 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-medium">{userRole === "reseller" ? "Meus clientes" : "Painel de assinaturas"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hoje é {formatDateBR(today)}</p>
        </div>
        <Dashboard
          customers={customers}
          today={today}
          appSuggestions={appSuggestions}
          userRole={userRole}
          panels={panels.map(({ id, name, credit_cost, is_active }) => ({ id, name, credit_cost, is_active }))}
          batches={batches}
        />
      </main>
    </>
  );
}
