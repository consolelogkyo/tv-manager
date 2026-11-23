import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTvApps } from "@/app/actions/tv-apps";
import { AppHeader } from "@/components/dashboard/app-header";
import { NotAuthorized } from "@/components/dashboard/not-authorized";
import { TvAppsCatalog } from "@/components/tv-apps/tv-apps-catalog";
import { getAuthContext } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Apps & TVs · TV Manager",
  description: "Guia de prioridade de aplicativos por marca e sistema de TV.",
};

export default async function AppsPage() {
  // Defesa em profundidade: o middleware já protege a rota, mas validamos de novo.
  const { user, role } = await getAuthContext();
  if (!user) redirect("/login");

  // Admins e revendedor têm acesso total ao catálogo; sem cargo válido → bloqueado.
  if (!role) {
    return <NotAuthorized email={user.email ?? ""} />;
  }

  const apps = await getTvApps();

  return (
    <>
      <AppHeader email={user.email ?? "admin"} role={role} />
      <main className="mx-auto max-w-7xl animate-enter px-4 pt-6 pb-28 sm:px-6 sm:pt-8 sm:pb-12 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-medium">Catálogo de Apps por TV</h1>
          <p className="mt-1 text-sm text-muted-foreground">Guia de prioridade por marca/sistema</p>
        </div>
        <TvAppsCatalog apps={apps} />
      </main>
    </>
  );
}
