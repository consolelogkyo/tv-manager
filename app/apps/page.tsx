import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTvApps } from "@/app/actions/tv-apps";
import { AppHeader } from "@/components/dashboard/app-header";
import { NotAuthorized } from "@/components/dashboard/not-authorized";
import { TvAppsCatalog } from "@/components/tv-apps/tv-apps-catalog";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Apps & TVs · TV Manager",
  description: "Guia de prioridade de aplicativos por marca e sistema de TV.",
};

export default async function AppsPage() {
  // Defesa em profundidade: o middleware já protege a rota, mas validamos de novo.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError || isAdmin !== true) {
    return <NotAuthorized email={user.email ?? ""} />;
  }

  const apps = await getTvApps();

  return (
    <>
      <AppHeader email={user.email ?? "admin"} />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 sm:pb-12 lg:px-8">
        <div className="mb-6 animate-fade-up">
          <p className="text-sm text-muted-foreground">Guia de prioridade por marca/sistema</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-gradient">Catálogo de Apps por TV</span>
          </h1>
        </div>
        <TvAppsCatalog apps={apps} />
      </main>
    </>
  );
}
